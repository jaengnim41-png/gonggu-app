import { getSessionProfile } from "@/lib/data/profile";

export default async function DashboardPage() {
  // 인증·회사 확인은 (app)/layout.tsx에서 이미 처리됩니다.
  const { company } = await getSessionProfile();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">
        {company?.name} 대시보드
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        여기에 이번 달 매출·랭킹·알림이 들어옵니다. 지금은 1물결 뼈대를 만드는 중이에요.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <a
          href="/products"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-400"
        >
          <div className="text-sm font-semibold text-slate-900">제품 관리 →</div>
          <p className="mt-1 text-xs text-slate-500">
            제품과 하위 옵션을 등록·수정하고 목록을 관리합니다.
          </p>
        </a>
        <a
          href="/group-buys"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-400"
        >
          <div className="text-sm font-semibold text-slate-900">공구 관리 →</div>
          <p className="mt-1 text-xs text-slate-500">
            공구를 등록하고 제품별 배정 수량을 정합니다.
          </p>
        </a>
      </div>
    </div>
  );
}
