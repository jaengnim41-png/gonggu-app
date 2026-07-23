import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createProposal } from "./actions";

type Proposal = {
  id: string;
  title: string;
  recipient_contact_id: string | null;
  recipient_name: string | null;
  active: boolean;
  created_at: string;
};

export default async function ProposalsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: pData }, { data: cData }, { data: iData }, { data: sData }] = await Promise.all([
    supabase
      .from("proposals")
      .select("id, title, recipient_contact_id, recipient_name, active, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("contacts").select("id, name, kind").order("name"),
    supabase.from("proposal_items").select("proposal_id"),
    supabase.from("proposal_settings").select("company_id").maybeSingle(),
  ]);

  const proposals = (pData ?? []) as Proposal[];
  const contacts = (cData ?? []) as { id: string; name: string; kind: string }[];
  const contactName = new Map(contacts.map((c) => [c.id, c.name]));
  const itemCount = new Map<string, number>();
  for (const it of (iData ?? []) as { proposal_id: string }[]) {
    itemCount.set(it.proposal_id, (itemCount.get(it.proposal_id) ?? 0) + 1);
  }
  const hasSettings = !!sData;

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold text-slate-900">제안서</h1>
        <Link
          href="/proposals/settings"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ⚙ 공통 정보 {hasSettings ? "" : "· 먼저 설정"}
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        제품을 골라 담으면 공구가·할인율·마진이 자동 계산됩니다. 링크로 보내면 벤더·셀러가 가입 없이 봅니다.
      </p>

      {!hasSettings && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          먼저 <Link href="/proposals/settings" className="font-semibold underline">공통 정보</Link>(택배비·정산·공구 진행방법 등)를 한 번 설정하면 모든 제안서에 자동으로 들어갑니다.
        </p>
      )}

      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 새 제안서</summary>
        <form action={createProposal} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            제안서 제목 *
            <input name="title" required placeholder="예: 10월 UDDYU 상품 제안서" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            받는 곳 (등록된 거래처)
            <select name="recipient_contact_id" defaultValue="" className={inputCls}>
              <option value="">— 선택 안 함</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            또는 직접 입력
            <input name="recipient_name" placeholder="예: 레몬트리커뮤니케이션" className={inputCls} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              만들고 제품 담기 →
            </button>
          </div>
        </form>
      </details>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "input" ? "제목을 입력해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {proposals.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            아직 제안서가 없습니다. 위 “＋ 새 제안서”로 시작하세요.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">제안서</th>
                <th className="px-4 py-3">받는 곳</th>
                <th className="px-4 py-3 text-right">품목</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">만든 날</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/proposals/${p.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.recipient_contact_id
                      ? contactName.get(p.recipient_contact_id) ?? "—"
                      : p.recipient_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{itemCount.get(p.id) ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.active ? "링크 활성" : "비활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{p.created_at?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
