-- ============================================================
-- 공구허브 스키마 #14 : 셀러/벤더 확장
--  - contacts에 연락처·주소 추가(택배 발송용)
--  - contact_links : 셀러 ↔ 벤더 다대다 연결(양쪽 어디서든 연결)
--  - vendor_managers : 벤더사 담당자 여러 명
--  - 기존 linked_vendor_id 값을 contact_links로 이관
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

-- 1) 연락처·주소 (셀러=택배 발송용, 벤더=벤더사 정보)
alter table public.contacts
  add column if not exists phone   text,
  add column if not exists address text,
  add column if not exists sort_order int not null default 0;

-- 기존 거래처 정렬번호 초기화(전부 0일 때만)
do $$
begin
  if not exists (select 1 from public.contacts where sort_order <> 0) then
    with r as (
      select id, row_number() over (partition by company_id, kind order by created_at) - 1 as rn
        from public.contacts
    )
    update public.contacts c set sort_order = r.rn from r where c.id = r.id;
  end if;
end $$;

-- 2) 셀러 ↔ 벤더 다대다 연결
create table if not exists public.contact_links (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  seller_id  uuid not null references public.contacts(id) on delete cascade,
  vendor_id  uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (seller_id, vendor_id)
);
create index if not exists contact_links_seller_idx on public.contact_links(seller_id);
create index if not exists contact_links_vendor_idx on public.contact_links(vendor_id);

alter table public.contact_links enable row level security;
drop policy if exists "contact_links_mine" on public.contact_links;
create policy "contact_links_mine" on public.contact_links
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- 기존 linked_vendor_id → contact_links 이관(중복 안 생김)
insert into public.contact_links (company_id, seller_id, vendor_id)
select c.company_id, c.id, c.linked_vendor_id
  from public.contacts c
 where c.linked_vendor_id is not null
on conflict (seller_id, vendor_id) do nothing;

-- 3) 벤더사 담당자 여러 명
create table if not exists public.vendor_managers (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  vendor_id  uuid not null references public.contacts(id) on delete cascade,
  name       text not null,
  phone      text,
  memo       text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists vendor_managers_vendor_idx on public.vendor_managers(vendor_id);

alter table public.vendor_managers enable row level security;
drop policy if exists "vendor_managers_mine" on public.vendor_managers;
create policy "vendor_managers_mine" on public.vendor_managers
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
