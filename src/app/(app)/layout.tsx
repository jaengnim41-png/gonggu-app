import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/data/profile";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";
import { signOut } from "./actions";

type BadgeMsg = { thread_id: string; author_user_id: string | null; created_at: string };
type BadgeRead = { thread_id: string; last_read_at: string };

/** 사이드바 배지용: 안읽은 메시지 수 · 승인 대기 게스트 수 (프로필 조회와 동시에 실행) */
async function fetchBadgeData() {
  const supabase = await createClient();
  return Promise.all([
    supabase
      .from("messages")
      .select("thread_id, author_user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("thread_reads").select("thread_id, last_read_at"),
    supabase.from("guests").select("id", { count: "exact", head: true }).eq("status", "대기"),
  ]);
}

function countUnread(msgs: BadgeMsg[], reads: BadgeRead[], userId: string) {
  const readAt = new Map(reads.map((r) => [r.thread_id, r.last_read_at]));
  let unread = 0;
  for (const m of msgs) {
    if (m.author_user_id === userId) continue;
    const seen = readAt.get(m.thread_id);
    if (!seen || m.created_at > seen) unread++;
  }
  return unread;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 프로필과 배지 데이터를 동시에 요청합니다(순차 왕복 제거).
  const [{ user, company }, badges] = await Promise.all([
    getSessionProfile(),
    fetchBadgeData(),
  ]);
  if (!user) redirect("/");
  if (!company) redirect("/onboarding");

  const [{ data: msgs }, { data: reads }, { count: pendingCount }] = badges;
  const unread = countUnread((msgs ?? []) as BadgeMsg[], (reads ?? []) as BadgeRead[], user.id);
  const pending = pendingCount ?? 0;

  return (
    <div className="flex min-h-full">
      <Sidebar unreadMessages={unread} pendingGuests={pending} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* 상단 바 */}
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
          <span className="font-semibold text-slate-900">{company.name}</span>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            {company.role}
          </span>
          <span className="ml-auto text-sm text-slate-500">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              로그아웃
            </button>
          </form>
        </header>

        <main className="flex-1 bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
