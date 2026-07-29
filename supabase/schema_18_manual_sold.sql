-- ============================================================
-- 공구허브 스키마 #18 : 판매 수량 직접 입력
--  - group_buy_items.manual_sold_qty : 값이 있으면 주문 집계 대신 이 수량을 씁니다.
--    · 주문 엑셀 없이 테스트하거나, 업로드 결과가 틀렸을 때 앱에서 바로 잡을 때 사용
--    · 비워두면(null) 지금처럼 주문 업로드 기준으로 자동 계산
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

alter table public.group_buy_items
  add column if not exists manual_sold_qty int;

comment on column public.group_buy_items.manual_sold_qty is
  '판매수량 직접 입력값. null이면 orders 집계 사용';
