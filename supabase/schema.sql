-- ============================================================
-- 공구허브 스키마 #1 : 회사(companies) + 프로필(profiles)
-- 멀티테넌시(회사별 칸막이)의 뿌리. Supabase SQL Editor에 붙여넣고 Run.
-- 여러 번 실행해도 안전하도록 작성.
-- ============================================================

-- 1) 회사 테이블
create table if not exists public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text not null check (role in ('브랜드','벤더','셀러')),
  created_at timestamptz not null default now()
);

-- 2) 프로필 테이블 (로그인 사용자 1명 = 프로필 1개)
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  name       text,
  created_at timestamptz not null default now()
);

-- 3) RLS(행 수준 보안) 켜기 — 이게 회사 칸막이의 핵심
alter table public.companies enable row level security;
alter table public.profiles  enable row level security;

-- 4) 프로필 정책: 본인 프로필만 보고 수정
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- 5) 회사 정책: 내가 속한 회사만 보고 수정
drop policy if exists "companies_select_mine" on public.companies;
create policy "companies_select_mine" on public.companies
  for select using (
    id = (select company_id from public.profiles where id = auth.uid())
  );

drop policy if exists "companies_update_mine" on public.companies;
create policy "companies_update_mine" on public.companies
  for update using (
    id = (select company_id from public.profiles where id = auth.uid())
  );

-- 6) 최초 온보딩: 회사 생성 + 내 프로필 연결을 한 번에(원자적).
--    RLS를 안전하게 우회하기 위해 security definer 함수로 처리.
create or replace function public.setup_company(p_name text, p_role text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  if exists (
    select 1 from public.profiles
    where id = auth.uid() and company_id is not null
  ) then
    raise exception '이미 회사가 설정되어 있습니다';
  end if;

  insert into public.companies (name, role)
    values (p_name, p_role)
    returning id into v_company_id;

  insert into public.profiles (id, company_id)
    values (auth.uid(), v_company_id)
    on conflict (id) do update set company_id = excluded.company_id;

  return v_company_id;
end;
$$;

grant execute on function public.setup_company(text, text) to authenticated;
