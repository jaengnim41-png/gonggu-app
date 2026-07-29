import { createClient } from "@/lib/supabase/server";
import { calcGroupBuyTotals, type TotalsItem, type TotalsOrder } from "@/lib/group-buys/totals";
import { createContact, bulkUploadContacts } from "../contacts/actions";
import { ContactTable, type ContactRow } from "@/components/contact-table";

type Contact = {
  id: string;
  kind: string;
  name: string;
  instagram: string | null;
  followers: number | null;
  phone: string | null;
  address: string | null;
  contact_info: string | null;
  memo: string | null;
};
type GB = { id: string; status: string; seller_contact_id: string | null };
type Item = { store_product_no: string | null; gonggu_price: number | null };
type Order = { group_buy_id: string; store_product_no: string | null; quantity: number; order_status: string | null };
type Link = { seller_id: string; vendor_id: string };

export default async function SellersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; uok?: string; uerror?: string }>;
}) {
  const { error, uok, uerror } = await searchParams;
  const supabase = await createClient();

  const [{ data: cData }, { data: gbData }, { data: itemData }, { data: orderData }, { data: linkData }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, kind, name, instagram, followers, phone, address, contact_info, memo, sort_order")
        .order("sort_order", { ascending: true }),
      supabase.from("group_buys").select("id, status, seller_contact_id"),
      supabase
        .from("group_buy_items")
        .select("id, group_buy_id, store_product_no, gonggu_price, margin_unit, manual_sold_qty"),
      supabase.from("orders").select("group_buy_id, store_product_no, option_info, quantity, order_status"),
      supabase.from("contact_links").select("seller_id, vendor_id"),
    ]);

  const contacts = (cData ?? []) as Contact[];
  const sellers = contacts.filter((c) => c.kind === "셀러");
  const vendors = contacts.filter((c) => c.kind === "벤더");
  const vendorName = new Map(vendors.map((v) => [v.id, v.name]));
  const links = (linkData ?? []) as Link[];

  const vendorsBySeller = new Map<string, string[]>();
  for (const l of links) {
    const arr = vendorsBySeller.get(l.seller_id) ?? [];
    arr.push(l.vendor_id);
    vendorsBySeller.set(l.seller_id, arr);
  }

  // 매출 집계 (판매수량 직접 입력분 포함 — 공통 규칙)
  const totals = calcGroupBuyTotals(
    (itemData ?? []) as TotalsItem[],
    (orderData ?? []) as TotalsOrder[]
  );
  const revenueByGb = new Map([...totals].map(([k, v]) => [k, v.revenue]));
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

  const rows: ContactRow[] = sellers.map((s) => {
    const vids = vendorsBySeller.get(s.id) ?? [];
    return {
      id: s.id,
      name: s.name,
      instagram: s.instagram,
      followers: s.followers,
      phone: s.phone,
      address: s.address,
      contact_info: s.contact_info,
      memo: s.memo,
      vendorIds: vids,
      linkedNames: vids.map((v) => vendorName.get(v)).filter((x): x is string => !!x),
      gbCount: gbCount.get(s.id) ?? 0,
      liveCount: liveCount.get(s.id) ?? 0,
      revenue: revenue.get(s.id) ?? 0,
    };
  });

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">셀러</h1>
      <p className="mt-1 text-sm text-slate-500">
        셀러 명단을 관리합니다. 공구에 연결하면 실적이 자동 집계되고, 벤더는 여러 곳 연결할 수 있습니다.
      </p>

      {/* 엑셀 도구 */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">엑셀로 한 번에 관리</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href="/api/contacts-template?kind=셀러" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">📄 샘플 양식</a>
          <a href="/api/contacts-export?kind=셀러" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">⬇ 전체 내려받기</a>
          <form action={bulkUploadContacts} className="flex items-center gap-2">
            <input type="hidden" name="kind" value="셀러" />
            <input type="file" name="file" accept=".xlsx,.xls" required className="text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100" />
            <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">일괄 등록</button>
          </form>
        </div>
        {uok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">일괄 등록 완료 — 새 셀러 {uok}명 반영됐습니다.</p>}
        {uerror && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{uerror === "file" ? "엑셀 파일을 선택해 주세요." : "양식을 읽지 못했어요."}</p>}
      </div>

      {/* 셀러 하나 직접 등록 */}
      <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 셀러 하나 직접 등록</summary>
        <form action={createContact} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="kind" value="셀러" />
          <label className="text-sm font-medium text-slate-700">이름 *<input name="name" required placeholder="예: 호담또담" className={inputCls} /></label>
          <label className="text-sm font-medium text-slate-700">인스타<input name="instagram" placeholder="@hodam.ddam" className={inputCls} /></label>
          <label className="text-sm font-medium text-slate-700">팔로워 수<input name="followers" inputMode="numeric" placeholder="52300" className={inputCls} /></label>
          <label className="text-sm font-medium text-slate-700">연락처(택배)<input name="phone" placeholder="010-0000-0000" className={inputCls} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">주소(택배 발송)<input name="address" placeholder="배송 주소" className={inputCls} /></label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">메모<input name="memo" className={inputCls} /></label>
          <fieldset className="sm:col-span-2">
            <legend className="text-sm font-medium text-slate-700">연결 벤더 (여러 곳 선택 가능)</legend>
            <div className="mt-1 flex flex-wrap gap-2 rounded-lg border border-slate-200 p-2">
              {vendors.length === 0 && <span className="text-xs text-slate-400">등록된 벤더가 없습니다.</span>}
              {vendors.map((v) => (
                <label key={v.id} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700">
                  <input type="checkbox" name="vendor_ids" value={v.id} /> {v.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">등록</button>
          </div>
        </form>
      </details>

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">{error === "input" ? "이름을 입력해 주세요." : "저장에 실패했어요."}</p>}

      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400 shadow-sm">아직 등록된 셀러가 없습니다.</div>
        ) : (
          <ContactTable kind="셀러" rows={rows} vendors={vendors.map((v) => ({ id: v.id, name: v.name }))} />
        )}
      </div>
    </div>
  );
}
