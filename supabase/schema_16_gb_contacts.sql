-- ============================================================
-- 공구허브 스키마 #16 : 공구에 셀러·벤더 여러 곳 연결
--  기존 group_buys.seller_contact_id / vendor_contact_id (각 1개)를
--  group_buy_contacts (여러 개)로 확장. 기존 값은 자동 이관.
--  ※ 기존 컬럼은 지우지 않습니다(과거 화면 호환). 새 화면은 이 표를 씁니다.
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.group_buy_contacts (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  group_buy_id uuid not null references public.group_buys(id) on delete cascade,
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  role         text not null check (role in ('셀러','벤더')),
  created_at   timestamptz not null default now(),
  unique (group_buy_id, contact_id)
);
create index if not exists gbc_gb_idx on public.group_buy_contacts(group_buy_id);
create index if not exists gbc_contact_idx on public.group_buy_contacts(contact_id);

alter table public.group_buy_contacts enable row level security;
drop policy if exists "gbc_all_mine" on public.group_buy_contacts;
create policy "gbc_all_mine" on public.group_buy_contacts
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- 기존 단일 연결 이관 (중복 안 생김)
insert into public.group_buy_contacts (company_id, group_buy_id, contact_id, role)
select g.company_id, g.id, g.seller_contact_id, '셀러'
  from public.group_buys g
 where g.seller_contact_id is not null
on conflict (group_buy_id, contact_id) do nothing;

insert into public.group_buy_contacts (company_id, group_buy_id, contact_id, role)
select g.company_id, g.id, g.vendor_contact_id, '벤더'
  from public.group_buys g
 where g.vendor_contact_id is not null
on conflict (group_buy_id, contact_id) do nothing;
