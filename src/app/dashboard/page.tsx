import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/data/profile";
import { signOut } from "./actions";

export default async function DashboardPage() {
  const { user, company } = await getSessionProfile();

  // 로그인하지 않았으면 로그인 화면으로.
  if (!user) redirect("/");
  // 아직 회사 설정 전이면 온보딩으로.
  if (!company) redirect("/onboarding");

  return (
    <main className="flex min-h-full flex-col bg-slate-50">
      {/* 상단 바 */}
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          공
        </div>
        <span className="font-semibold text-slate-900">공구허브</span>
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

      {/* 본문 */}
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            {company.name} · {company.role}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{user.email}</span>{" "}
            님, 환영합니다.
          </p>
          <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
            회사·역할 설정이 끝났습니다. 이제부터 만드는 모든 화면(제품·공구·정산)은{" "}
            <b>{company.name}</b> 회사의 데이터만 보이게 됩니다. 다음 단계에서{" "}
            <b>제품·공구 화면</b>을 채워 갑니다.
          </p>
        </div>
      </div>
    </main>
  );
}
