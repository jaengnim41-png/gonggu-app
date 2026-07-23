-- ============================================================
-- 공구허브 스키마 #12b : proposal_public 함수만 교체(버그 수정)
--  증상: 공개 제안서 링크가 "열 수 없는 제안서입니다"로 뜸
--  원인: 정렬 기준(sort_order)을 조회 목록에 넣지 않아 오류
-- 이 파일만 SQL Editor에 붙여넣고 Run 하면 됩니다. 표는 건드리지 않습니다.
-- ============================================================

create or replace function public.proposal_public(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop    public.proposals;
  v_company uuid;
  v_items   jsonb;
  v_result  jsonb;
begin
  select * into v_prop from public.proposals where token = p_token and active = true;
  if v_prop.id is null then
    return null;
  end if;
  v_company := v_prop.company_id;

  -- 열람 켜진 상품만, 담은 순서대로
  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'name',         i.name,
               'option_label', i.option_label,
               'detail_url',   i.detail_url,
               'normal_price', i.normal_price,
               'gonggu_price', i.gonggu_price,
               'fee_rate',     i.fee_rate
             )
             order by i.sort_order, i.created_at
           ),
           '[]'::jsonb
         )
    into v_items
    from public.proposal_items i
   where i.proposal_id = v_prop.id
     and i.visible = true;

  select jsonb_build_object(
    'proposal', jsonb_build_object(
      'title', v_prop.title,
      'recipient_name', coalesce(
        v_prop.recipient_name,
        (select c.name from public.contacts c where c.id = v_prop.recipient_contact_id)
      ),
      'fee_rate_default', v_prop.fee_rate_default,
      'settle_fee_rate',  v_prop.settle_fee_rate,
      'created_at',       v_prop.created_at
    ),
    'company_name', (select co.name from public.companies co where co.id = v_company),
    'settings', coalesce(
      (select to_jsonb(s) from public.proposal_settings s where s.company_id = v_company),
      '{}'::jsonb
    ),
    'items', v_items
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.proposal_public(text) to anon, authenticated;
