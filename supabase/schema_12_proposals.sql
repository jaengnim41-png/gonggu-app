-- ============================================================
-- 공구허브 스키마 #12 : 제안서
--  - proposal_settings : 회사 1개당 공통 정보(공급업체 정보 + 하단 안내). 매번 재사용.
--  - proposals         : 제안서 1건(받는 벤더/셀러 지정, 공유 토큰)
--  - proposal_items    : 제안서에 담은 제품(가격 스냅샷, 제품별 열람 on/off)
--  - proposal_public(token) : 로그인 없이 제안서를 읽는 함수(활성 토큰만)
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

-- 회사 공통 제안서 정보 (①공급업체 정보 + ③하단 안내)
create table if not exists public.proposal_settings (
  company_id     uuid primary key references public.companies(id) on delete cascade,
  brand_name     text,
  store_url      text,
  courier        text,
  base_ship_fee  numeric,
  extra_ship_fee numeric,
  return_fee     numeric,
  same_day       text,     -- 당일배송 조건
  sample_support text,     -- 샘플지원 여부
  cs_note        text,     -- 고객센터/CS
  ship_from      text,     -- 출고/반품지
  progress_note  text,     -- 공구 진행 방법
  settle_note    text,     -- 정산 안내
  event_note     text,     -- 이벤트
  contact_note   text,     -- 담당자 연락(오픈채팅 등)
  updated_at     timestamptz not null default now()
);

alter table public.proposal_settings enable row level security;
drop policy if exists "proposal_settings_mine" on public.proposal_settings;
create policy "proposal_settings_mine" on public.proposal_settings
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- 제안서 1건
create table if not exists public.proposals (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  token        text not null unique,
  title        text not null,
  recipient_contact_id uuid references public.contacts(id) on delete set null,
  recipient_name text,                 -- 거래처 미등록이면 직접 입력
  fee_rate_default numeric not null default 0.25,   -- 기본 벤더 수수료율
  settle_fee_rate  numeric not null default 3.495,  -- 최종정산 네이버 수수료(%)
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists proposals_company_idx on public.proposals(company_id, created_at desc);

alter table public.proposals enable row level security;
drop policy if exists "proposals_all_mine" on public.proposals;
create policy "proposals_all_mine" on public.proposals
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- 제안서에 담은 제품(추가 시점의 가격을 스냅샷으로 저장 → 나중에 제품가가 바뀌어도 보낸 제안서는 유지)
create table if not exists public.proposal_items (
  id                uuid primary key default gen_random_uuid(),
  proposal_id       uuid not null references public.proposals(id) on delete cascade,
  product_id        uuid references public.products(id) on delete set null,
  product_option_id uuid references public.product_options(id) on delete set null,
  name              text not null,        -- 상품명(스냅샷)
  option_label      text,                 -- 옵션명/구성(스냅샷)
  detail_url        text,
  normal_price      numeric,              -- 정상판매가
  gonggu_price      numeric,              -- 공구판매가
  fee_rate          numeric,              -- 벤더 수수료(비율, 예: 0.25)
  sort_order        int not null default 0,
  visible           boolean not null default true,  -- 제품별 열람 on/off
  created_at        timestamptz not null default now()
);
create index if not exists proposal_items_proposal_idx on public.proposal_items(proposal_id, sort_order);

alter table public.proposal_items enable row level security;
drop policy if exists "proposal_items_mine" on public.proposal_items;
create policy "proposal_items_mine" on public.proposal_items
  for all using (
    proposal_id in (select id from public.proposals where company_id = public.my_company_id())
  )
  with check (
    proposal_id in (select id from public.proposals where company_id = public.my_company_id())
  );

-- ============================================================
-- 공개 읽기: 활성 토큰이면 제안서 전체(회사정보+상품 visible만)를 반환
-- ============================================================
create or replace function public.proposal_public(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop public.proposals;
  v_company uuid;
  v_items jsonb;
  v_result jsonb;
begin
  select * into v_prop from public.proposals where token = p_token and active = true;
  if v_prop.id is null then
    return null;
  end if;
  v_company := v_prop.company_id;

  -- 열람 켜진 상품만, 담은 순서대로
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'name',         i.name,
               'option_label', i.option_label,
               'detail_url',   i.detail_url,
               'normal_price', i.normal_price,
               'gonggu_price', i.gonggu_price,
               'fee_rate',     i.fee_rate
             )
             order by i.sort_order, i.created_at
           ),
           '[]'::jsonb
         )
    into v_items
    from public.proposal_items i
   where i.proposal_id = v_prop.id
     and i.visible = true;

  select jsonb_build_object(
    'proposal', jsonb_build_object(
      'title', v_prop.title,
      'recipient_name', coalesce(
        v_prop.recipient_name,
        (select name from public.contacts where id = v_prop.recipient_contact_id)
      ),
      'fee_rate_default', v_prop.fee_rate_default,
      'settle_fee_rate', v_prop.settle_fee_rate,
      'created_at', v_prop.created_at
    ),
    'company_name', (select name from public.companies where id = v_company),
    'settings', coalesce(
      (select to_jsonb(s) from public.proposal_settings s where s.company_id = v_company),
      '{}'::jsonb
    ),
    'items', v_items
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.proposal_public(text) to anon, authenticated;
