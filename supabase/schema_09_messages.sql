-- ============================================================
-- 공구허브 스키마 #9 : 메시지 (공구별 · 거래처별 대화방)
--  - message_threads : 대화방 (공구 1개당 1방, 거래처 1곳당 1방)
--  - messages        : 메시지 (작성자 = 우리 직원 또는 승인된 게스트)
--  - thread_reads    : 로그인 사용자의 마지막 읽음 시각 (안읽음 배지용)
-- Supabase SQL Editor에 붙여넣고 Run. 여러 번 실행해도 안전.
-- ============================================================

create table if not exists public.message_threads (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  kind         text not null check (kind in ('공구','거래처')),
  group_buy_id uuid references public.group_buys(id) on delete cascade,
  contact_id   uuid references public.contacts(id) on delete cascade,
  created_at   timestamptz not null default now(),
  check (
    (kind = '공구'   and group_buy_id is not null and contact_id is null) or
    (kind = '거래처' and contact_id   is not null and group_buy_id is null)
  )
);
-- 공구 1개당 1방, 거래처 1곳당 1방
create unique index if not exists message_threads_gb_uniq
  on public.message_threads(group_buy_id) where group_buy_id is not null;
create unique index if not exists message_threads_contact_uniq
  on public.message_threads(contact_id) where contact_id is not null;
create index if not exists message_threads_company_idx
  on public.message_threads(company_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies(id) on delete cascade,
  thread_id       uuid not null references public.message_threads(id) on delete cascade,
  author_side     text not null check (author_side in ('회사','게스트')),
  author_user_id  uuid references auth.users(id) on delete set null,
  author_guest_id uuid,                -- schema_10의 guests.id (게스트가 쓴 글)
  author_name     text not null,       -- 표시명 스냅샷 (나중에 이름이 바뀌어도 기록 유지)
  body            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists messages_thread_idx on public.messages(thread_id, created_at);
create index if not exists messages_company_idx on public.messages(company_id);

create table if not exists public.thread_reads (
  thread_id    uuid not null references public.message_threads(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

-- ---------- RLS : 우리 회사 것만 ----------
alter table public.message_threads enable row level security;
drop policy if exists "threads_all_mine" on public.message_threads;
create policy "threads_all_mine" on public.message_threads
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

alter table public.messages enable row level security;
drop policy if exists "messages_all_mine" on public.messages;
create policy "messages_all_mine" on public.messages
  for all using (company_id = public.my_company_id())
  with check (company_id = public.my_company_id());

alter table public.thread_reads enable row level security;
drop policy if exists "thread_reads_mine" on public.thread_reads;
create policy "thread_reads_mine" on public.thread_reads
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------- 방 가져오기(없으면 생성) ----------
-- 공구 상세 / 거래처 상세에서 "메시지" 누르면 호출.
create or replace function public.get_or_create_thread(
  p_kind text,
  p_group_buy_id uuid default null,
  p_contact_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company uuid := public.my_company_id();
  v_id uuid;
begin
  if v_company is null then
    raise exception '회사 정보가 없습니다.';
  end if;

  -- 대상이 우리 회사 것인지 확인
  if p_kind = '공구' then
    if not exists (select 1 from public.group_buys
                   where id = p_group_buy_id and company_id = v_company) then
      raise exception '권한이 없습니다.';
    end if;
    select id into v_id from public.message_threads where group_buy_id = p_group_buy_id;
  elsif p_kind = '거래처' then
    if not exists (select 1 from public.contacts
                   where id = p_contact_id and company_id = v_company) then
      raise exception '권한이 없습니다.';
    end if;
    select id into v_id from public.message_threads where contact_id = p_contact_id;
  else
    raise exception '잘못된 방 종류입니다.';
  end if;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.message_threads (company_id, kind, group_buy_id, contact_id)
  values (v_company, p_kind,
          case when p_kind = '공구' then p_group_buy_id end,
          case when p_kind = '거래처' then p_contact_id end)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.get_or_create_thread(text, uuid, uuid) to authenticated;
