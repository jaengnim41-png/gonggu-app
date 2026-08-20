import { createClient } from "@/lib/supabase/server";
import { calcGroupBuyTotals, type TotalsItem, type TotalsOrder, type TotalsOptionPrice } from "@/lib/group-buys/totals";
import { createGroupBuy } from "./actions";
import { GroupBuyFilter, type GBRow } from "./group-buy-filter";

/** 공구 진행 흐름 12단계 (기획서 6장) */
const STATUS_OPTIONS = [
  "①제안접수", "②제안서전달", "③조건협의", "④셀러승인", "⑤샘플발송", "⑥콘텐츠제작",
  "⑦공구오픈", "⑧진행중", "⑨공구종료", "⑩정산대기", "⑪최종정산", "⑫완료",
];

export default async function GroupBuysPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; status?: string; product?: string; seller?: string; vendor?: string }>;
}) {
  const sp = await searchParams;

  const supabase = await createClient();
  const [{ data: gbData }, { data: itemData }, { data: gbcData }, { data: contactData }, { data: orderData }, { data: opData }] =
    await Promise.all([
      supabase
        .from("group_buys")
        .select("id, title, status, start_date, end_date")
        .order("start_date", { ascending: false, nullsFirst: false }),
      supabase
        .from("group_buy_items")
        .select("id, group_buy_id, product_name, store_product_no, gonggu_price, margin_unit, manual_sold_qty"),
      supabase.from("group_buy_contacts").select("group_buy_id, role, contact_id"),
      supabase.from("contacts").select("id, name"),
      supabase.from("orders").select("group_buy_id, store_product_no, option_info, quantity, order_status"),
      supabase.from("group_buy_item_prices").select("group_buy_item_id, option_info, gonggu_price, margin_unit"),
    ]);

  // 공구별 매출(직접 입력분·옵션별 단가 예외 포함 — 공통 규칙)
  const totals = calcGroupBuyTotals(
    (itemData ?? []) as TotalsItem[],
    (orderData ?? []) as TotalsOrder[],
    (opData ?? []) as TotalsOptionPrice[]
  );

  const contactName = new Map(((contactData ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
  const productsByGb = new Map<string, Set<string>>();
  const itemCountByGb = new Map<string, number>();
  for (const it of (itemData ?? []) as { group_buy_id: string; product_name: string }[]) {
    if (!productsByGb.has(it.group_buy_id)) productsByGb.set(it.group_buy_id, new Set());
    productsByGb.get(it.group_buy_id)!.add(it.product_name);
    itemCountByGb.set(it.group_buy_id, (itemCountByGb.get(it.group_buy_id) ?? 0) + 1);
  }
  const sellersByGb = new Map<string, string[]>();
  const vendorsByGb = new Map<string, string[]>();
  for (const gc of (gbcData ?? []) as { group_buy_id: string; role: string; contact_id: string }[]) {
    const name = contactName.get(gc.contact_id);
    if (!name) continue;
    const map = gc.role === "셀러" ? sellersByGb : vendorsByGb;
    const arr = map.get(gc.group_buy_id) ?? [];
    arr.push(name);
    map.set(gc.group_buy_id, arr);
  }

  const rows: GBRow[] = ((gbData ?? []) as { id: string; title: string; status: string; start_date: string | null; end_date: string | null }[]).map((g) => ({
    id: g.id,
    title: g.title,
    status: g.status,
    start_date: g.start_date,
    end_date: g.end_date,
    itemCount: itemCountByGb.get(g.id) ?? 0,
    revenue: totals.get(g.id)?.revenue ?? 0,
    products: [...(productsByGb.get(g.id) ?? [])],
    sellers: sellersByGb.get(g.id) ?? [],
    vendors: vendorsByGb.get(g.id) ?? [],
  }));

  const allProducts = [...new Set(rows.flatMap((r) => r.products))].sort();
  const allSellers = [...new Set(rows.flatMap((r) => r.sellers))].sort();
  const allVendors = [...new Set(rows.flatMap((r) => r.vendors))].sort();

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <h1 className="text-lg font-bold text-slate-900">공구</h1>
      <p className="mt-1 text-sm text-slate-500">
        공구를 등록하고, 제품·셀러·벤더별로 기간을 골라 볼 수 있습니다.
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
            <select name="status" defaultValue="①제안접수" className={inputCls}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
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
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
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

      {/* 필터 + 목록 */}
      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400 shadow-sm">
            아직 등록된 공구가 없습니다. 위 “＋ 새 공구 등록”으로 시작하세요.
          </div>
        ) : (
          <GroupBuyFilter
            rows={rows}
            products={allProducts}
            sellers={allSellers}
            vendors={allVendors}
            initialStatus={sp.status ?? ""}
            initialProduct={sp.product ?? ""}
            initialSeller={sp.seller ?? ""}
            initialVendor={sp.vendor ?? ""}
          />
        )}
      </div>
    </div>
  );
}
