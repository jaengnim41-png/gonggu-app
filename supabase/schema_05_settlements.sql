-- ============================================================
-- 공구허브 스키마 #5 : 정산(settlements) + 공구상품에 마진단가 추가
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

-- 1) 공구상품에 마진단가(옵션 1개당 벤더/셀러 마진) 컬럼 추가
alter table public.group_buy_items
  add column if not exists margin_unit numeric;

-- 2) 정산 표 (공구 1건당 1개)
create table if not exists public.settlements (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  group_buy_id uuid not null references public.group_buys(id) on delete cascade,
  fee_rate     numeric not null default 3.495,   -- 결제 수수료율(%)
  vat_included boolean not null default true,
  status       text not null default '검토중'
               check (status in ('검토중','승인','전달')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (group_buy_id)
);

alter table public.settlements enable row level security;

drop policy if exists "settlements_all_mine" on public.settlements;
create policy "settlements_all_mine" on public.settlements
  for all
  using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());
