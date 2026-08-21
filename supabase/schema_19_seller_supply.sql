-- 공급가 2종 분리: 기존 supply_price = 벤더 공급가, 셀러 공급가 컬럼 추가
-- (Supabase SQL Editor에서 실행)

alter table public.product_options
  add column if not exists seller_supply_price integer;

comment on column public.product_options.supply_price is '벤더 공급가(vat포함)';
comment on column public.product_options.seller_supply_price is '셀러 공급가(vat포함)';
