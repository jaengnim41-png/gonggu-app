-- ============================================================
-- 공구허브 스키마 #13 : 제품 정렬 순서
--  - products.sort_order 추가 → 목록에서 순서 변경 가능
--  - 기존 제품은 만든 순서대로 초기 번호 부여
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

alter table public.products
  add column if not exists sort_order int not null default 0;

-- 기존 제품에 순서 부여(이미 값이 있으면 건드리지 않음: 전부 0일 때만)
do $$
begin
  if not exists (select 1 from public.products where sort_order <> 0) then
    with ranked as (
      select id, row_number() over (partition by company_id order by created_at) - 1 as rn
        from public.products
    )
    update public.products p
       set sort_order = r.rn
      from ranked r
     where p.id = r.id;
  end if;
end $$;

create index if not exists products_sort_idx on public.products(company_id, sort_order);
