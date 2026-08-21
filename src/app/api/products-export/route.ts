import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/orders/parse";

/**
 * 현재 등록된 제품·옵션을 엑셀로 내려받습니다(RLS: 내 회사만).
 * 일괄 등록 양식과 같은 컬럼이라, 내려받아 수정 후 다시 올리면 갱신됩니다.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  // seller_supply_price 컬럼이 아직 없을 수 있어(스키마 19 미적용) 실패 시 없이 다시 조회
  let optRes = await supabase
    .from("product_options")
    .select("id, product_id, name, option_key, normal_price, gonggu_price, supply_price, seller_supply_price, sort_order")
    .order("sort_order");
  if (optRes.error) {
    optRes = (await supabase
      .from("product_options")
      .select("id, product_id, name, option_key, normal_price, gonggu_price, supply_price, sort_order")
      .order("sort_order")) as unknown as typeof optRes;
  }
  const options = (optRes.data ?? []) as {
    id: string; product_id: string; name: string; option_key: string | null;
    normal_price: number | null; gonggu_price: number | null; supply_price: number | null;
    seller_supply_price?: number | null;
  }[];

  const [{ data: products }, { data: ins }, { data: invOrders }] = await Promise.all([
    supabase.from("products").select("id, name, category, detail_url, sort_order").order("sort_order"),
    supabase.from("stock_ins").select("product_option_id, quantity"),
    supabase.from("inventory_orders").select("product_option_id, quantity, order_status"),
  ]);

  // 옵션별 현재재고(가용 = 입고합 − 판매합)
  const availByOpt = new Map<string, number>();
  for (const r of ins ?? []) {
    availByOpt.set(r.product_option_id, (availByOpt.get(r.product_option_id) ?? 0) + (r.quantity ?? 0));
  }
  for (const o of invOrders ?? []) {
    if (!o.product_option_id || !isLive(o.order_status)) continue;
    availByOpt.set(o.product_option_id, (availByOpt.get(o.product_option_id) ?? 0) - (o.quantity ?? 0));
  }

  const optsByProduct = new Map<string, typeof options>();
  for (const o of options) {
    if (!optsByProduct.has(o.product_id)) optsByProduct.set(o.product_id, []);
    optsByProduct.get(o.product_id)!.push(o);
  }

  const empty = { 제품명: "", 카테고리: "", 상세URL: "", 옵션명: "", SKU: "", 정상가: "", 공구가: "", 벤더공급가: "", 셀러공급가: "", 현재재고: "" };
  const rows: Record<string, unknown>[] = [];
  for (const p of products ?? []) {
    const opts = optsByProduct.get(p.id) ?? [];
    if (opts.length === 0) {
      rows.push({ ...empty, 제품명: p.name, 카테고리: p.category ?? "", 상세URL: p.detail_url ?? "" });
      continue;
    }
    for (const o of opts) {
      rows.push({
        제품명: p.name,
        카테고리: p.category ?? "",
        상세URL: p.detail_url ?? "",
        옵션명: o.name,
        SKU: o.option_key ?? "",
        정상가: o.normal_price ?? "",
        공구가: o.gonggu_price ?? "",
        벤더공급가: o.supply_price ?? "",
        셀러공급가: o.seller_supply_price ?? "",
        현재재고: availByOpt.get(o.id) ?? 0,
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [empty]);
  ws["!cols"] = [
    { wch: 16 }, { wch: 12 }, { wch: 34 }, { wch: 22 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "제품목록");

  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent("제품목록")}-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
