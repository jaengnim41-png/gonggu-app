-- ============================================================
-- 공구허브 스키마 #3 : 공구(group_buys) + 공구상품(group_buy_items)
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

-- 1) 공구
create table if not exists public.group_buys (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  title       text not null,
  status      text not null default '예정'
              check (status in ('예정','진행중','종료','정산대기','완료')),
  start_date  date,
  end_date    date,
  settle_days int not null default 14,
  memo        text,
  created_at  timestamptz not null default now()
);
create index if not exists group_buys_company_idx on public.group_buys(company_id);

-- 2) 공구상품 (한 공구에 제품 여러 개 + 상품번호 + 배정 수량)
create table if not exists public.group_buy_items (
  id              uuid primary key default gen_random_uuid(),
  group_buy_id    uuid not null references public.group_buys(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  product_name    text not null,           -- 제품 삭제돼도 남도록 이름 보관
  store_product_no text,                    -- 스마트스토어 상품번호(주문 매칭 열쇠)
  allocated_qty   int,                      -- 배정 수량 (예: 100)
  gonggu_price    numeric,
  created_at      timestamptz not null default now()
);
create index if not exists group_buy_items_gb_idx on public.group_buy_items(group_buy_id);

-- 3) RLS
alter table public.group_buys      enable row level security;
alter table public.group_buy_items enable row level security;

-- 4) 공구 정책: 내 회사 공구만
drop policy if exists "group_buys_all_mine" on public.group_buys;
create policy "group_buys_all_mine" on public.group_buys
  for all
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- 5) 공구상품 정책: 내 회사 공구에 속한 것만
drop policy if exists "group_buy_items_all_mine" on public.group_buy_items;
create policy "group_buy_items_all_mine" on public.group_buy_items
  for all
  using (
    group_buy_id in (select id from public.group_buys where company_id = public.my_company_id())
  )
  with check (
    group_buy_id in (select id from public.group_buys where company_id = public.my_company_id())
  );
