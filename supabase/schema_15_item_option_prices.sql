-- ============================================================
-- 공구허브 스키마 #15 : 공구상품 옵션별 가격 예외
--  한 상품번호 안에서 옵션마다 공구가·마진이 다른 경우를 지원.
--  (예: 케어백1 = 대부분 16,900이지만 '봉투만 구매'는 14,000)
--  지정하지 않은 옵션은 공구상품의 기본 공구가·마진단가를 그대로 사용.
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.group_buy_item_prices (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies(id) on delete cascade,
  group_buy_item_id uuid not null references public.group_buy_items(id) on delete cascade,
  option_info       text not null,          -- 주문 엑셀의 옵션정보 글자 (정확히 일치)
  gonggu_price      numeric,                -- 이 옵션의 공구가
  margin_unit       numeric,                -- 이 옵션의 마진단가
  created_at        timestamptz not null default now(),
  unique (group_buy_item_id, option_info)
);
create index if not exists gbip_item_idx on public.group_buy_item_prices(group_buy_item_id);

alter table public.group_buy_item_prices enable row level security;
drop policy if exists "gbip_all_mine" on public.group_buy_item_prices;
create policy "gbip_all_mine" on public.group_buy_item_prices
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
