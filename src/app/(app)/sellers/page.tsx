import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/orders/parse";
import { createContact, deleteContact } from "../contacts/actions";

type Contact = {
  id: string;
  kind: string;
  name: string;
  instagram: string | null;
  followers: number | null;
  contact_info: string | null;
  linked_vendor_id: string | null;
  memo: string | null;
};
type GB = { id: string; status: string; seller_contact_id: string | null };
type Item = { store_product_no: string | null; gonggu_price: number | null };
type Order = { group_buy_id: string; store_product_no: string | null; quantity: number; order_status: string | null };

function won(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}
function num(n: number | null) {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: cData }, { data: gbData }, { data: itemData }, { data: orderData }] =
    await Promise.all([
      supabase.from("contacts").select("id, kind, name, instagram, followers, contact_info, linked_vendor_id, memo").order("created_at", { ascending: false }),
      supabase.from("group_buys").select("id, status, seller_contact_id"),
      supabase.from("group_buy_items").select("store_product_no, gonggu_price"),
      supabase.from("orders").select("group_buy_id, store_product_no, quantity, order_status"),
    ]);

  const contacts = (cData ?? []) as Contact[];
  const sellers = contacts.filter((c) => c.kind === "셀러");
  const vendors = contacts.filter((c) => c.kind === "벤더");
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));

  // 공구별 매출 → 셀러별 집계
  const priceByPno = new Map<string, number>();
  for (const it of (itemData ?? []) as Item[]) {
    if (it.store_product_no) priceByPno.set(it.store_product_no, it.gonggu_price ?? 0);
  }
  const revenueByGb = new Map<string, number>();
  for (const o of (orderData ?? []) as Order[]) {
    if (!isLive(o.order_status)) continue;
    const amt = (o.quantity ?? 0) * (priceByPno.get(String(o.store_product_no ?? "")) ?? 0);
    revenueByGb.set(o.group_buy_id, (revenueByGb.get(o.group_buy_id) ?? 0) + amt);
  }
  const gbCount = new Map<string, number>();
  const liveCount = new Map<string, number>();
  const revenue = new Map<string, number>();
  for (const g of (gbData ?? []) as GB[]) {
    const sid = g.seller_contact_id;
    if (!sid) continue;
    gbCount.set(sid, (gbCount.get(sid) ?? 0) + 1);
    if (g.status === "진행중") liveCount.set(sid, (liveCount.get(sid) ?? 0) + 1);
    revenue.set(sid, (revenue.get(sid) ?? 0) + (revenueByGb.get(g.id) ?? 0));
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">셀러</h1>
      <p className="mt-1 text-sm text-slate-500">
        거래하는 셀러 명단을 관리합니다. 공구에 셀러를 연결하면 실적이 자동 집계됩니다.
      </p>

      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 셀러 등록</summary>
        <form action={createContact} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="kind" value="셀러" />
          <label className="text-sm font-medium text-slate-700">
            이름 *
            <input name="name" required placeholder="예: 호담또담" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            인스타
            <input name="instagram" placeholder="예: @hodam.ddam" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            팔로워 수
            <input name="followers" inputMode="numeric" placeholder="예: 52300" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            연결 벤더
            <select name="linked_vendor_id" defaultValue="" className={inputCls}>
              <option value="">단독 (벤더 없음)</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            연락처·담당
            <input name="contact_info" placeholder="오픈채팅 링크 등" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            메모
            <input name="memo" className={inputCls} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              등록
            </button>
          </div>
        </form>
      </details>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "input" ? "이름을 입력해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {sellers.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            아직 등록된 셀러가 없습니다. 위 “＋ 셀러 등록”으로 추가해 보세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">셀러</th>
                  <th className="px-4 py-3">인스타</th>
                  <th className="px-4 py-3 text-right">팔로워</th>
                  <th className="px-4 py-3">연결 벤더</th>
                  <th className="px-4 py-3 text-right">공구</th>
                  <th className="px-4 py-3 text-right">진행중</th>
                  <th className="px-4 py-3 text-right">매출</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${s.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {s.name}
                      </Link>
                      {s.memo && (
                        <p className="mt-0.5 max-w-56 truncate text-xs text-slate-400" title={s.memo}>
                          {s.memo}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.instagram ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{num(s.followers)}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.linked_vendor_id ? (vendorName.get(s.linked_vendor_id) ?? "—") : <span className="text-slate-400">단독</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{gbCount.get(s.id) ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{liveCount.get(s.id) ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{won(revenue.get(s.id) ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteContact}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="kind" value="셀러" />
                        <button type="submit" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600">
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        공구·매출은 공구 상세에서 셀러를 연결하면 자동 집계됩니다. 팔로워 수는 직접 입력(인스타 자동 수집은 다음 단계).
      </p>
    </div>
  );
}
