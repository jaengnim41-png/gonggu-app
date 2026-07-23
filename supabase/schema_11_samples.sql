-- ============================================================
-- 공구허브 스키마 #11 : 샘플 발송 기록
--  - 대부분 "보내면 끝". 회수는 가끔이라 체크 하나로만 둔다.
--  - 제품을 앱에 등록하지 않았어도 이름을 직접 적어 보낼 수 있다(item_text).
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.sample_shipments (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  contact_id        uuid references public.contacts(id) on delete set null,  -- 받는 셀러/벤더
  product_id        uuid references public.products(id) on delete set null,
  product_option_id uuid references public.product_options(id) on delete set null,
  item_text         text,          -- 미등록 제품이면 직접 입력
  quantity          int not null default 1,
  sent_at           date not null default current_date,
  courier           text,          -- 택배사
  tracking_no       text,          -- 송장번호
  returned          boolean not null default false,
  returned_at       date,
  memo              text,          -- 특이사항
  created_at        timestamptz not null default now()
);
create index if not exists samples_company_idx on public.sample_shipments(company_id, sent_at desc);
create index if not exists samples_contact_idx on public.sample_shipments(contact_id);

alter table public.sample_shipments enable row level security;
drop policy if exists "samples_all_mine" on public.sample_shipments;
create policy "samples_all_mine" on public.sample_shipments
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
