-- ============================================================
-- 공구허브 스키마 #7 : 비로그인 공유 링크
--  - share_links : 공구별 공유 토큰
--  - shared_group_buy(token) : 로그인 없이 그 공구 판매현황을 읽는 함수
--    (SECURITY DEFINER로 RLS 우회, 단 유효한 토큰에 한해서만 노출)
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.share_links (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  group_buy_id uuid not null references public.group_buys(id) on delete cascade,
  token        text not null unique,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (group_buy_id)
);

alter table public.share_links enable row level security;

drop policy if exists "share_links_all_mine" on public.share_links;
create policy "share_links_all_mine" on public.share_links
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

-- 공개 읽기 함수: 유효한 토큰이면 그 공구의 판매현황용 데이터(JSON)를 반환.
-- 정산은 포함하지 않음(정산은 로그인 필수).
create or replace function public.shared_group_buy(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gb uuid;
  v_result jsonb;
begin
  select group_buy_id into v_gb
    from public.share_links
    where token = p_token and active = true;
  if v_gb is null then
    return null;
  end if;

  select jsonb_build_object(
    'group_buy', (
      select to_jsonb(g) from (
        select id, title, status, start_date, end_date
        from public.group_buys where id = v_gb
      ) g
    ),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i)) from (
        select product_name, store_product_no, allocated_qty, gonggu_price
        from public.group_buy_items where group_buy_id = v_gb
        order by created_at
      ) i
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(to_jsonb(o)) from (
        select option_info, store_product_no, quantity, order_status
        from public.orders where group_buy_id = v_gb
      ) o
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.shared_group_buy(text) to anon, authenticated;
