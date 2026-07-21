-- ============================================================
-- 공구허브 스키마 #8 : 거래처(셀러/벤더) + 공구에 셀러/벤더 연결
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.contacts (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  kind             text not null check (kind in ('셀러','벤더')),
  name             text not null,
  instagram        text,
  followers        int,
  contact_info     text,                 -- 담당·연락(오픈채팅 등)
  linked_vendor_id uuid references public.contacts(id) on delete set null,  -- 셀러가 소속된 벤더
  memo             text,
  created_at       timestamptz not null default now()
);
create index if not exists contacts_company_idx on public.contacts(company_id);
create index if not exists contacts_vendor_idx on public.contacts(linked_vendor_id);

alter table public.contacts enable row level security;
drop policy if exists "contacts_all_mine" on public.contacts;
create policy "contacts_all_mine" on public.contacts
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- 공구에 진행 셀러/벤더 연결(선택)
alter table public.group_buys
  add column if not exists seller_contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists vendor_contact_id uuid references public.contacts(id) on delete set null;
