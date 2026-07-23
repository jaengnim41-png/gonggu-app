import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";
import { calcRow } from "@/lib/proposals/calc";

/**
 * 제안서 하나를 엑셀 파일로 내보냅니다.
 * 로그인한 회사의 제안서만(RLS). 상품 구성 표 + 마진 계산 포함.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  const { data: proposal } = await supabase
    .from("proposals")
    .select("id, title, settle_fee_rate")
    .eq("token", token)
    .maybeSingle();
  if (!proposal) return NextResponse.redirect(new URL("/proposals", request.url));

  const { data: items } = await supabase
    .from("proposal_items")
    .select("name, option_label, normal_price, gonggu_price, fee_rate, visible, sort_order")
    .eq("proposal_id", proposal.id)
    .eq("visible", true)
    .order("sort_order");

  const rows = (items ?? []).map((it, i) => {
    const r = calcRow(it);
    return {
      NO: i + 1,
      상품명: it.name,
      "옵션/구성": it.option_label ?? "",
      정상판매가: it.normal_price ?? "",
      공구판매가: it.gonggu_price ?? "",
      "정가대비할인": r.normal > 0 ? Math.round(r.discount * 1000) / 1000 : "",
      "벤더공급가(VAT포함)": r.supply,
      벤더수수료: r.fee,
      "벤더마진(VAT포함)": r.margin,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 안내: "표시할 상품이 없습니다" }]);
  XLSX.utils.book_append_sheet(wb, ws, "상품 구성안");

  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const safeTitle = proposal.title.replace(/[\\/:*?"<>|]/g, "_");

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safeTitle)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
