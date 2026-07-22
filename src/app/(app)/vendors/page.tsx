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
};
type GB = { id: string; status: string; vendor_contact_id: string | null };
type Item = { store_product_no: string | null; gonggu_price: number | null };
type Order = { group_buy_id: string; store_product_no: string | null; quantity: number; order_status: string | null };

function won(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: cData }, { data: gbData }, { data: itemData }, { data: orderData }] =
    await Promise.all([
      supabase.from("contacts").select("id, kind, name, instagram, followers, contact_info, linked_vendor_id").order("created_at", { ascending: false }),
      supabase.from("group_buys").select("id, status, vendor_contact_id"),
      supabase.from("group_buy_items").select("store_product_no, gonggu_price"),
      supabase.from("orders").select("group_buy_id, store_product_no, quantity, order_status"),
    ]);

  const contacts = (cData ?? []) as Contact[];
  const vendors = contacts.filter((c) => c.kind === "벤더");
  const sellers = contacts.filter((c) => c.kind === "셀러");

  const sellerCountByVendor = new Map<string, number>();
  for (const s of sellers) {
    if (s.linked_vendor_id)
      sellerCountByVendor.set(s.linked_vendor_id, (sellerCountByVendor.get(s.linked_vendor_id) ?? 0) + 1);
  }

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
    const vid = g.vendor_contact_id;
    if (!vid) continue;
    gbCount.set(vid, (gbCount.get(vid) ?? 0) + 1);
    if (g.status === "진행중") liveCount.set(vid, (liveCount.get(vid) ?? 0) + 1);
    revenue.set(vid, (revenue.get(vid) ?? 0) + (revenueByGb.get(g.id) ?? 0));
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">벤더</h1>
      <p className="mt-1 text-sm text-slate-500">
        거래하는 벤더 명단을 관리합니다. 셀러 등록 시 벤더를 연결하면 소속 관계가 표시됩니다.
      </p>

      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 벤더 등록</summary>
        <form action={createContact} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="kind" value="벤더" />
          <label className="text-sm font-medium text-slate-700">
            이름 *
            <input name="name" required placeholder="예: 레몬트리커뮤니케이션" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            연락처·담당
            <input name="contact_info" placeholder="오픈채팅 링크 등" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
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
        {vendors.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            아직 등록된 벤더가 없습니다. 위 “＋ 벤더 등록”으로 추가해 보세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">벤더</th>
                  <th className="px-4 py-3">연락처·담당</th>
                  <th className="px-4 py-3 text-right">연결 셀러</th>
                  <th className="px-4 py-3 text-right">공구</th>
                  <th className="px-4 py-3 text-right">진행중</th>
                  <th className="px-4 py-3 text-right">매출</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/contacts/${v.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {v.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{v.contact_info ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sellerCountByVendor.get(v.id) ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{gbCount.get(v.id) ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{liveCount.get(v.id) ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{won(revenue.get(v.id) ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteContact}>
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="kind" value="벤더" />
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
    </div>
  );
}
