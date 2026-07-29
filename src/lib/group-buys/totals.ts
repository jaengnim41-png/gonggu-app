import { isLive } from "@/lib/orders/parse";

export type TotalsItem = {
  id: string;
  group_buy_id: string;
  store_product_no: string | null;
  gonggu_price: number | null;
  margin_unit: number | null;
  manual_sold_qty: number | null;
};
export type TotalsOrder = {
  group_buy_id: string;
  store_product_no: string | null;
  option_info: string | null;
  quantity: number;
  order_status: string | null;
};
export type TotalsOptionPrice = {
  group_buy_item_id: string;
  option_info: string;
  gonggu_price: number | null;
  margin_unit: number | null;
};

export type GroupBuyTotals = { qty: number; revenue: number; margin: number };

/**
 * 공구별 판매수량·매출·마진을 한 규칙으로 계산합니다.
 *
 * 공구상품마다:
 *  - 판매수량을 직접 입력했으면(manual_sold_qty) 그 수량 × 상품 기본 단가로 계산합니다.
 *  - 비어 있으면 주문 업로드 기록에서 집계하고, 옵션별 단가 예외가 있으면 그 값을 씁니다.
 *
 * 화면(공구 상세·셀러/벤더 실적·대시보드)이 모두 이 함수를 쓰므로 숫자가 어긋나지 않습니다.
 */
export function calcGroupBuyTotals(
  items: TotalsItem[],
  orders: TotalsOrder[],
  optionPrices: TotalsOptionPrice[] = []
): Map<string, GroupBuyTotals> {
  const out = new Map<string, GroupBuyTotals>();
  const add = (gbId: string, t: GroupBuyTotals) => {
    const cur = out.get(gbId) ?? { qty: 0, revenue: 0, margin: 0 };
    cur.qty += t.qty;
    cur.revenue += t.revenue;
    cur.margin += t.margin;
    out.set(gbId, cur);
  };

  // 옵션 예외: (공구상품id|옵션글자) → 단가
  const overrides = new Map<string, { gonggu: number | null; margin: number | null }>();
  for (const p of optionPrices) {
    overrides.set(`${p.group_buy_item_id}|${p.option_info}`, {
      gonggu: p.gonggu_price,
      margin: p.margin_unit,
    });
  }

  // 상품번호 → 공구상품 (공구별로 구분)
  const itemByKey = new Map<string, TotalsItem>();
  for (const it of items) {
    if (it.store_product_no) itemByKey.set(`${it.group_buy_id}|${it.store_product_no}`, it);
  }

  // 1) 수동 입력한 상품 먼저
  const manualItemIds = new Set<string>();
  for (const it of items) {
    if (it.manual_sold_qty == null) continue;
    manualItemIds.add(it.id);
    const q = it.manual_sold_qty;
    add(it.group_buy_id, {
      qty: q,
      revenue: q * (it.gonggu_price ?? 0),
      margin: q * (it.margin_unit ?? 0),
    });
  }

  // 2) 나머지는 주문 기록으로
  for (const o of orders) {
    if (!isLive(o.order_status)) continue;
    const it = itemByKey.get(`${o.group_buy_id}|${String(o.store_product_no ?? "")}`);
    if (!it || manualItemIds.has(it.id)) continue; // 수동 입력한 상품은 주문 무시
    const ov = overrides.get(`${it.id}|${o.option_info ?? ""}`);
    const price = ov?.gonggu ?? it.gonggu_price ?? 0;
    const margin = ov?.margin ?? it.margin_unit ?? 0;
    const q = o.quantity ?? 0;
    add(o.group_buy_id, { qty: q, revenue: q * price, margin: q * margin });
  }

  return out;
}

/** 공구상품별 판매수량 (수동 입력 우선) */
export function calcSoldByItem(
  items: TotalsItem[],
  orders: TotalsOrder[]
): Map<string, number> {
  const sold = new Map<string, number>();
  const itemByKey = new Map<string, TotalsItem>();
  for (const it of items) {
    if (it.manual_sold_qty != null) sold.set(it.id, it.manual_sold_qty);
    if (it.store_product_no) itemByKey.set(`${it.group_buy_id}|${it.store_product_no}`, it);
  }
  for (const o of orders) {
    if (!isLive(o.order_status)) continue;
    const it = itemByKey.get(`${o.group_buy_id}|${String(o.store_product_no ?? "")}`);
    if (!it || it.manual_sold_qty != null) continue;
    sold.set(it.id, (sold.get(it.id) ?? 0) + (o.quantity ?? 0));
  }
  return sold;
}
