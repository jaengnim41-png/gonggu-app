-- ============================================================
-- 공구허브 스키마 #2 : 제품(products) + 하위 옵션(product_options)
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

-- 0) 내 회사 id를 돌려주는 헬퍼(정책을 짧게 쓰기 위함)
create or replace function public.my_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- 1) 제품(대분류)
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  name          text not null,
  category      text,
  detail_url    text,
  normal_price  numeric,
  supply_price  numeric,
  selling_point text,
  caution       text,
  status        text not null default '판매중' check (status in ('판매중','중지')),
  created_at    timestamptz not null default now()
);
create index if not exists products_company_idx on public.products(company_id);

-- 2) 하위 옵션
create table if not exists public.product_options (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  name         text not null,
  option_key   text,
  normal_price numeric,
  gonggu_price numeric,
  supply_price numeric,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists product_options_product_idx on public.product_options(product_id);

-- 3) RLS 켜기
alter table public.products        enable row level security;
alter table public.product_options enable row level security;

-- 4) 제품 정책: 내 회사 제품만 (조회/추가/수정/삭제)
drop policy if exists "products_all_mine" on public.products;
create policy "products_all_mine" on public.products
  for all
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- 5) 옵션 정책: 내 회사 제품에 속한 옵션만
drop policy if exists "product_options_all_mine" on public.product_options;
create policy "product_options_all_mine" on public.product_options
  for all
  using (
    product_id in (select id from public.products where company_id = public.my_company_id())
  )
  with check (
    product_id in (select id from public.products where company_id = public.my_company_id())
  );
