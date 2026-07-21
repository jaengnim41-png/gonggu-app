-- ============================================================
-- 공구허브 스키마 #6 : 재고(브랜드 전용, 자동 차감)
--  - inventory_orders : 전체 주문 파일(재고 차감용). 상품주문번호로 멱등.
--  - stock_ins        : 입고 기록
--  - option_matches   : (상품번호+옵션정보) → 제품옵션 연결 기억(한 번 이으면 자동)
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

-- 1) 전체 주문(재고 차감용)
create table if not exists public.inventory_orders (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  product_order_no  text not null,
  order_no          text,
  store_product_no  text,
  option_info       text,
  quantity          int not null default 0,
  order_status      text,
  product_option_id uuid references public.product_options(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (company_id, product_order_no)
);
create index if not exists inv_orders_company_idx on public.inventory_orders(company_id);
create index if not exists inv_orders_option_idx on public.inventory_orders(product_option_id);

-- 2) 입고
create table if not exists public.stock_ins (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  product_option_id uuid not null references public.product_options(id) on delete cascade,
  quantity          int not null default 0,
  note              text,
  created_at        timestamptz not null default now()
);
create index if not exists stock_ins_option_idx on public.stock_ins(product_option_id);

-- 3) 옵션 연결 기억
create table if not exists public.option_matches (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  store_product_no  text not null,
  option_info       text not null,
  product_option_id uuid not null references public.product_options(id) on delete cascade,
  unique (company_id, store_product_no, option_info)
);

-- RLS
alter table public.inventory_orders enable row level security;
alter table public.stock_ins        enable row level security;
alter table public.option_matches   enable row level security;

drop policy if exists "inv_orders_all_mine" on public.inventory_orders;
create policy "inv_orders_all_mine" on public.inventory_orders
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

drop policy if exists "stock_ins_all_mine" on public.stock_ins;
create policy "stock_ins_all_mine" on public.stock_ins
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

drop policy if exists "option_matches_all_mine" on public.option_matches;
create policy "option_matches_all_mine" on public.option_matches
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
