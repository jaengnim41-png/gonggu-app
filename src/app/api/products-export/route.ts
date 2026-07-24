import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

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

  const [{ data: products }, { data: options }] = await Promise.all([
    supabase.from("products").select("id, name, category, detail_url, sort_order").order("sort_order"),
    supabase
      .from("product_options")
      .select("product_id, name, option_key, normal_price, gonggu_price, supply_price, sort_order")
      .order("sort_order"),
  ]);

  const optsByProduct = new Map<string, typeof options>();
  for (const o of options ?? []) {
    if (!optsByProduct.has(o.product_id)) optsByProduct.set(o.product_id, []);
    optsByProduct.get(o.product_id)!.push(o);
  }

  const rows: Record<string, unknown>[] = [];
  for (const p of products ?? []) {
    const opts = optsByProduct.get(p.id) ?? [];
    if (opts.length === 0) {
      rows.push({ 제품명: p.name, 카테고리: p.category ?? "", 상세URL: p.detail_url ?? "", 옵션명: "", SKU: "", 정상가: "", 공구가: "", 공급가: "" });
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
        공급가: o.supply_price ?? "",
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ 제품명: "", 카테고리: "", 상세URL: "", 옵션명: "", SKU: "", 정상가: "", 공구가: "", 공급가: "" }]
  );
  ws["!cols"] = [
    { wch: 16 }, { wch: 12 }, { wch: 34 }, { wch: 22 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
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
