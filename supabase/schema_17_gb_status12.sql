-- ============================================================
-- 공구허브 스키마 #17 : 공구 상태 12단계 (기획서 6장)
--  ①제안접수 ②제안서전달 ③조건협의 ④셀러승인 ⑤샘플발송 ⑥콘텐츠제작
--  ⑦공구오픈 ⑧진행중 ⑨공구종료 ⑩정산대기 ⑪최종정산 ⑫완료
--  기존 5단계(예정/진행중/종료/정산대기/완료) 값은 12단계로 자동 매핑.
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

-- 1) 기존 상태 제약 제거 (컬럼명 확인 후 안전하게)
do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname = 'public' and rel.relname = 'group_buys' and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.group_buys drop constraint %I', c.conname);
  end loop;
end $$;

-- 2) 기존 값 → 12단계 매핑
update public.group_buys set status = '⑦공구오픈'  where status = '예정';
update public.group_buys set status = '⑧진행중'    where status = '진행중';
update public.group_buys set status = '⑨공구종료'  where status = '종료';
update public.group_buys set status = '⑩정산대기'  where status = '정산대기';
update public.group_buys set status = '⑫완료'      where status = '완료';

-- 3) 새 제약: 12단계만 허용
alter table public.group_buys
  add constraint group_buys_status_check check (status in (
    '①제안접수','②제안서전달','③조건협의','④셀러승인','⑤샘플발송','⑥콘텐츠제작',
    '⑦공구오픈','⑧진행중','⑨공구종료','⑩정산대기','⑪최종정산','⑫완료'
  ));

alter table public.group_buys alter column status set default '①제안접수';
