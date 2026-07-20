import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인하지 않았으면 로그인 화면으로 되돌립니다.
  if (!user) {
    redirect("/");
  }

  return (
    <main className="flex min-h-full flex-col bg-slate-50">
      {/* 상단 바 */}
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          공
        </div>
        <span className="font-semibold text-slate-900">공구허브</span>
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

      {/* 본문 */}
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            로그인 성공 🎉
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{user.email}</span>{" "}
            님, 환영합니다.
          </p>
          <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            여기가 로그인 후 들어오는 자리입니다. 다음 단계에서 <b>회사·역할 설정</b>과{" "}
            <b>공구·제품 화면</b>을 이 안에 채워 갑니다.
          </p>
        </div>
      </div>
    </main>
  );
}
