import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setGuestStatus } from "../contacts/actions";

type Guest = {
  id: string;
  display_name: string;
  status: string;
  requested_at: string;
  last_seen_at: string | null;
  contact_id: string;
  contacts: { name: string; kind: string } | null;
};

export default async function GuestsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guests")
    .select("id, display_name, status, requested_at, last_seen_at, contact_id, contacts(name, kind)")
    .order("requested_at", { ascending: false });

  const guests = (data ?? []) as unknown as Guest[];
  const pending = guests.filter((g) => g.status === "대기");
  const rest = guests.filter((g) => g.status !== "대기");

  function Row({ g }: { g: Guest }) {
    return (
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-4 py-3 font-medium text-slate-900">{g.display_name}</td>
        <td className="px-4 py-3">
          <Link href={`/contacts/${g.contact_id}`} className="text-slate-600 hover:text-indigo-600">
            {g.contacts?.name ?? "—"}
            <span className="ml-1 text-xs text-slate-400">{g.contacts?.kind}</span>
          </Link>
        </td>
        <td className="px-4 py-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              g.status === "승인"
                ? "bg-emerald-50 text-emerald-700"
                : g.status === "차단"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-amber-50 text-amber-700"
            }`}
          >
            {g.status}
          </span>
        </td>
        <td className="px-4 py-3 text-xs text-slate-500">
          {g.requested_at?.slice(0, 16).replace("T", " ")}
        </td>
        <td className="px-4 py-3">
          <div className="flex justify-end gap-1.5">
            {g.status !== "승인" && (
              <form action={setGuestStatus}>
                <input type="hidden" name="guest_id" value={g.id} />
                <input type="hidden" name="status" value="승인" />
                <input type="hidden" name="back" value="/guests" />
                <button className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                  승인
                </button>
              </form>
            )}
            {g.status !== "차단" && (
              <form action={setGuestStatus}>
                <input type="hidden" name="guest_id" value={g.id} />
                <input type="hidden" name="status" value="차단" />
                <input type="hidden" name="back" value="/guests" />
                <button className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600">
                  차단
                </button>
              </form>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">게스트 승인</h1>
      <p className="mt-1 text-sm text-slate-500">
        초대 링크로 들어온 사람입니다. <b>승인해야만</b> 공구 일정·판매현황·정산서·메시지를 볼 수 있습니다.
      </p>

      <h2 className="mt-6 text-sm font-semibold text-amber-700">승인 대기 ({pending.length})</h2>
      <div className="mt-2 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
        {pending.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">대기 중인 요청이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>{pending.map((g) => <Row key={g.id} g={g} />)}</tbody>
          </table>
        )}
      </div>

      <h2 className="mt-8 text-sm font-semibold text-slate-700">전체 ({rest.length})</h2>
      <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {rest.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">아직 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">거래처</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">요청</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>{rest.map((g) => <Row key={g.id} g={g} />)}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
