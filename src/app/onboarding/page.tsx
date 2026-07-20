import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/data/profile";
import { setupCompany } from "./actions";

const ROLES: { value: string; desc: string }[] = [
  { value: "브랜드", desc: "제품·재고를 보유하고 공구를 공급" },
  { value: "벤더", desc: "브랜드와 셀러를 잇고 공구를 진행" },
  { value: "셀러", desc: "인스타 등 채널에서 직접 판매" },
];

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { user, company } = await getSessionProfile();
  if (!user) redirect("/");
  if (company) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">
            공
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">회사 설정</h1>
            <p className="mt-1 text-sm text-slate-500">
              한 번만 설정하면 됩니다. 회사 이름과 역할을 정해 주세요.
            </p>
          </div>
        </div>

        <form
          action={setupCompany}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-medium text-slate-700">
            회사 이름
            <input
              name="name"
              type="text"
              required
              placeholder="예: uddyu"
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-slate-700">역할</legend>
            <div className="mt-2 flex flex-col gap-2">
              {ROLES.map((r, i) => (
                <label
                  key={r.value}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 px-3 py-2.5 has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    defaultChecked={i === 0}
                    className="mt-0.5 accent-indigo-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {r.value}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {r.desc}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            시작하기
          </button>

          {error && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-center text-xs font-medium text-rose-700">
              {error === "input"
                ? "회사 이름과 역할을 확인해 주세요."
                : "저장에 실패했어요. 잠시 후 다시 시도해 주세요."}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
