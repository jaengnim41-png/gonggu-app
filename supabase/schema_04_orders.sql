-- ============================================================
-- 공구허브 스키마 #4 : 주문(orders)
-- 스마트스토어 주문 엑셀을 올리면 여기에 저장됩니다.
-- 상품주문번호로 중복 방지(멱등) — 같은 파일 여러 번 올려도 안전.
-- Supabase SQL Editor에 붙여넣고 Run.
-- ============================================================

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies(id) on delete cascade,
  group_buy_id     uuid references public.group_buys(id) on delete cascade,
  product_order_no text not null,   -- 상품주문번호 (멱등 키)
  order_no         text,            -- 주문번호
  store_product_no text,            -- 상품번호 (공구상품 매칭 열쇠)
  product_name     text,
  option_info      text,            -- 옵션정보
  quantity         int not null default 0,
  order_status     text,            -- 주문상태 (취소/반품 제외용)
  paid_at          text,            -- 결제일(원본 문자열)
  created_at       timestamptz not null default now(),
  unique (company_id, product_order_no)
);
create index if not exists orders_group_buy_idx on public.orders(group_buy_id);
create index if not exists orders_company_idx on public.orders(company_id);

alter table public.orders enable row level security;

drop policy if exists "orders_all_mine" on public.orders;
create policy "orders_all_mine" on public.orders
  for all
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
