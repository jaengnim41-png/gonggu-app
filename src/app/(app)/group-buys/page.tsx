import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createGroupBuy } from "./actions";

type GroupBuyRow = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  group_buy_items: { count: number }[];
};

const FILTERS = ["진행중", "예정", "정산대기", "종료", "전체"];
const STATUS_OPTIONS = ["예정", "진행중", "종료", "정산대기", "완료"];

function statusClass(s: string) {
  if (s === "진행중") return "bg-indigo-50 text-indigo-700";
  if (s === "예정") return "bg-emerald-50 text-emerald-700";
  if (s === "정산대기") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-600";
}

export default async function GroupBuysPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const active = sp.status ?? "진행중";

  const supabase = await createClient();
  let query = supabase
    .from("group_buys")
    .select("id, title, status, start_date, end_date, group_buy_items(count)")
    .order("created_at", { ascending: false });
  if (active !== "전체") query = query.eq("status", active);
  const { data } = await query;
  const rows = (data ?? []) as GroupBuyRow[];

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">공구</h1>
      <p className="mt-1 text-sm text-slate-500">
        공구를 등록하고, 제품별 배정 수량을 정합니다.
      </p>

      {/* 새 공구 등록 */}
      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
          ＋ 새 공구 등록
        </summary>
        <form action={createGroupBuy} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            공구명 *
            <input name="title" required placeholder="예: 커넥신 케어백 1+1 공구" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            상태
            <select name="status" defaultValue="예정" className={inputCls}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            정산일(종료 후 며칠)
            <input name="settle_days" inputMode="numeric" defaultValue={14} className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            시작일
            <input name="start_date" type="date" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            종료일
            <input name="end_date" type="date" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            메모
            <input name="memo" placeholder="이벤트·특이사항" className={inputCls} />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              공구 등록
            </button>
          </div>
        </form>
      </details>

      {sp.error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {sp.error === "title" ? "공구명을 입력해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      {/* 상태 필터 */}
      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/group-buys?status=${encodeURIComponent(f)}`}
            className={
              "rounded-full px-3 py-1.5 text-sm font-medium transition " +
              (active === f
                ? "bg-indigo-600 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50")
            }
          >
            {f}
          </Link>
        ))}
      </div>

      {/* 목록 */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            {active === "전체" ? "등록된 공구가 없습니다." : `‘${active}’ 상태의 공구가 없습니다.`}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">공구명</th>
                <th className="px-4 py-3">기간</th>
                <th className="px-4 py-3 text-right">제품</th>
                <th className="px-4 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/group-buys/${g.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                    >
                      {g.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {g.start_date ?? "—"} ~ {g.end_date ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {g.group_buy_items?.[0]?.count ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + statusClass(g.status)}>
                      {g.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
