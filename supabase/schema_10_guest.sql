-- ============================================================
-- 공구허브 스키마 #10 : 게스트 초대 링크 + 승인제 포털
--  - guest_links : 거래처(셀러/벤더) 1곳당 초대 링크 1개
--  - guests      : 그 링크로 들어온 사람(기기) — 대기 → 승인해야 열람 가능
--  - 게스트는 로그인 없이 아래 3가지만: 공구 일정 / 판매·정산 / 메시지
--    (RLS를 우회하는 SECURITY DEFINER 함수로만 접근. 승인 안 되면 아무것도 안 나감)
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.guest_links (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  token      text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (contact_id)
);

create table if not exists public.guests (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  link_id      uuid not null references public.guest_links(id) on delete cascade,
  device_key   text not null,               -- 브라우저(기기) 식별용 무작위 키
  display_name text not null,               -- 첫 입장 때 본인이 적은 이름
  status       text not null default '대기'
               check (status in ('대기','승인','차단')),
  user_id      uuid references auth.users(id) on delete set null,  -- 나중에 가입하면 연결
  requested_at timestamptz not null default now(),
  approved_at  timestamptz,
  last_seen_at timestamptz,
  last_read_at timestamptz,
  unique (link_id, device_key)
);
create index if not exists guests_company_idx on public.guests(company_id, status);
create index if not exists guests_contact_idx on public.guests(contact_id);

alter table public.guest_links enable row level security;
drop policy if exists "guest_links_all_mine" on public.guest_links;
create policy "guest_links_all_mine" on public.guest_links
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

alter table public.guests enable row level security;
drop policy if exists "guests_all_mine" on public.guests;
create policy "guests_all_mine" on public.guests
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- ============================================================
-- 내부 헬퍼 : 토큰+기기키로 승인된 게스트 찾기 (없으면 null)
-- ============================================================
create or replace function public.guest_resolve(p_token text, p_device_key text)
returns public.guests
language sql
security definer
set search_path = public
stable
as $$
  select g.*
    from public.guests g
    join public.guest_links l on l.id = g.link_id
   where l.token = p_token
     and l.active = true
     and g.device_key = p_device_key
     and g.status = '승인'
   limit 1;
$$;

-- ============================================================
-- 1) 첫 입장 / 상태 확인
--    이름을 주면 승인 요청을 만들고, 이미 있으면 현재 상태만 알려준다.
--    반환: {state: '이름필요'|'대기'|'승인'|'차단'|'없음', contact_name, company_name, display_name}
-- ============================================================
create or replace function public.guest_enter(
  p_token text,
  p_device_key text,
  p_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.guest_links;
  v_guest public.guests;
  v_contact_name text;
  v_company_name text;
begin
  select * into v_link from public.guest_links
   where token = p_token and active = true;
  if v_link.id is null then
    return jsonb_build_object('state', '없음');
  end if;

  select name into v_contact_name from public.contacts where id = v_link.contact_id;
  select name into v_company_name from public.companies where id = v_link.company_id;

  select * into v_guest from public.guests
   where link_id = v_link.id and device_key = p_device_key;

  -- 처음 온 기기
  if v_guest.id is null then
    if p_name is null or btrim(p_name) = '' then
      return jsonb_build_object(
        'state', '이름필요',
        'contact_name', v_contact_name,
        'company_name', v_company_name
      );
    end if;
    insert into public.guests (company_id, contact_id, link_id, device_key, display_name)
    values (v_link.company_id, v_link.contact_id, v_link.id, p_device_key, btrim(p_name))
    returning * into v_guest;
  end if;

  update public.guests set last_seen_at = now() where id = v_guest.id;

  return jsonb_build_object(
    'state', v_guest.status,
    'contact_name', v_contact_name,
    'company_name', v_company_name,
    'display_name', v_guest.display_name
  );
end;
$$;

-- ============================================================
-- 2) 포털 데이터 — 승인된 게스트에게만
--    그 거래처가 연결된 공구의 일정 / 판매현황(옵션별·일자별) / 정산(전달된 것만) / 메시지
-- ============================================================
create or replace function public.guest_portal(p_token text, p_device_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests;
  v_result jsonb;
  v_thread uuid;
begin
  select * into v_guest from public.guest_resolve(p_token, p_device_key);
  if v_guest.id is null then
    return null;                       -- 승인 전이면 아무것도 주지 않는다
  end if;

  -- 거래처 대화방(없으면 만든다)
  select id into v_thread from public.message_threads where contact_id = v_guest.contact_id;
  if v_thread is null then
    insert into public.message_threads (company_id, kind, contact_id)
    values (v_guest.company_id, '거래처', v_guest.contact_id)
    returning id into v_thread;
  end if;

  with gb as (
    select g.*
      from public.group_buys g
     where g.company_id = v_guest.company_id
       and (g.seller_contact_id = v_guest.contact_id
         or g.vendor_contact_id = v_guest.contact_id)
  ),
  it as (
    select i.* from public.group_buy_items i
     where i.group_buy_id in (select id from gb)
  ),
  ord as (
    select o.group_buy_id,
           o.option_info,
           o.quantity,
           left(coalesce(o.paid_at, ''), 10) as day,
           coalesce(i.gonggu_price, 0) as price,
           coalesce(i.margin_unit, 0)  as margin
      from public.orders o
      left join it i on i.store_product_no = o.store_product_no
                    and i.group_buy_id = o.group_buy_id
     where o.group_buy_id in (select id from gb)
       and (o.order_status is null
            or (o.order_status not like '%취소%' and o.order_status not like '%반품%'))
  )
  select jsonb_build_object(
    'guest_name', v_guest.display_name,
    'contact', (select to_jsonb(c) from (
        select name, kind from public.contacts where id = v_guest.contact_id
      ) c),
    'company_name', (select name from public.companies where id = v_guest.company_id),
    'thread_id', v_thread,
    'group_buys', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.start_date desc nulls last) from (
        select id, title, status, start_date, end_date, settle_days, memo from gb
      ) x
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select group_buy_id, product_name, store_product_no, allocated_qty, gonggu_price
          from it
      ) x
    ), '[]'::jsonb),
    'by_option', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.qty desc) from (
        select group_buy_id, option_info,
               sum(quantity)::int as qty,
               sum(quantity * price)::numeric as amount
          from ord group by group_buy_id, option_info
      ) x
    ), '[]'::jsonb),
    'by_day', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.day) from (
        select group_buy_id, day,
               sum(quantity)::int as qty,
               sum(quantity * price)::numeric as amount
          from ord where day <> '' group by group_buy_id, day
      ) x
    ), '[]'::jsonb),
    -- 정산은 '전달' 상태만 공개 (검토중·승인 단계는 내부용)
    'settlements', coalesce((
      select jsonb_agg(to_jsonb(x)) from (
        select s.group_buy_id, s.fee_rate,
               (select sum(o2.quantity * o2.price)  from ord o2 where o2.group_buy_id = s.group_buy_id) as revenue,
               (select sum(o2.quantity * o2.margin) from ord o2 where o2.group_buy_id = s.group_buy_id) as margin_total
          from public.settlements s
         where s.group_buy_id in (select id from gb) and s.status = '전달'
      ) x
    ), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at) from (
        select author_side, author_name, body, created_at
          from public.messages where thread_id = v_thread
          order by created_at desc limit 200
      ) x
    ), '[]'::jsonb)
  ) into v_result;

  update public.guests set last_seen_at = now() where id = v_guest.id;
  return v_result;
end;
$$;

-- ============================================================
-- 3) 게스트가 메시지 보내기
-- ============================================================
create or replace function public.guest_post_message(
  p_token text,
  p_device_key text,
  p_body text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guests;
  v_thread uuid;
begin
  select * into v_guest from public.guest_resolve(p_token, p_device_key);
  if v_guest.id is null or btrim(coalesce(p_body, '')) = '' then
    return false;
  end if;

  select id into v_thread from public.message_threads where contact_id = v_guest.contact_id;
  if v_thread is null then
    insert into public.message_threads (company_id, kind, contact_id)
    values (v_guest.company_id, '거래처', v_guest.contact_id)
    returning id into v_thread;
  end if;

  insert into public.messages (company_id, thread_id, author_side, author_guest_id, author_name, body)
  values (v_guest.company_id, v_thread, '게스트', v_guest.id, v_guest.display_name, btrim(p_body));

  return true;
end;
$$;

-- ============================================================
-- 4) 가입 후 링크 다시 입력 → 게스트 이력을 내 계정에 연결
--    (가입 전에 보던 일정·정산·메시지가 그대로 이어짐)
-- ============================================================
create or replace function public.guest_claim(p_token text, p_device_key text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.guest_links;
  v_count int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'reason', '로그인이 필요합니다.');
  end if;

  select * into v_link from public.guest_links where token = p_token and active = true;
  if v_link.id is null then
    return jsonb_build_object('ok', false, 'reason', '유효하지 않은 링크입니다.');
  end if;

  update public.guests
     set user_id = auth.uid()
   where link_id = v_link.id
     and status = '승인'
     and (p_device_key is null or device_key = p_device_key);
  get diagnostics v_count = row_count;

  if v_count = 0 then
    return jsonb_build_object('ok', false, 'reason', '아직 승인되지 않았거나 연결할 기록이 없습니다.');
  end if;

  return jsonb_build_object('ok', true, 'linked', v_count);
end;
$$;

grant execute on function public.guest_enter(text, text, text)        to anon, authenticated;
grant execute on function public.guest_portal(text, text)             to anon, authenticated;
grant execute on function public.guest_post_message(text, text, text) to anon, authenticated;
grant execute on function public.guest_claim(text, text)              to authenticated;
-- guest_resolve는 내부 헬퍼 — 직접 호출 금지
revoke execute on function public.guest_resolve(text, text) from anon, authenticated;
