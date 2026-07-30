import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

/**
 * 로그인한 회사의 전체 데이터를 엑셀 한 파일(여러 시트)로 내보냅니다.
 * RLS 덕분에 내 회사 데이터만 담깁니다.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const [
    products, options, groupBuys, items, orders, settlements,
    contacts, contactLinks, vendorManagers, samples, proposals, proposalItems,
    stockIns, inventoryOrders,
  ] = await Promise.all([
    supabase.from("products").select("*"),
    supabase.from("product_options").select("*"),
    supabase.from("group_buys").select("*"),
    supabase.from("group_buy_items").select("*"),
    supabase.from("orders").select("*"),
    supabase.from("settlements").select("*"),
    supabase.from("contacts").select("*"),
    supabase.from("contact_links").select("*"),
    supabase.from("vendor_managers").select("*"),
    supabase.from("sample_shipments").select("*"),
    supabase.from("proposals").select("*"),
    supabase.from("proposal_items").select("*"),
    supabase.from("stock_ins").select("*"),
    supabase.from("inventory_orders").select("*"),
  ]);

  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: unknown[] | null) => {
    const ws = XLSX.utils.json_to_sheet(rows && rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add("제품", products.data);
  add("제품옵션", options.data);
  add("공구", groupBuys.data);
  add("공구상품", items.data);
  add("주문", orders.data);
  add("정산", settlements.data);
  add("거래처", contacts.data);
  add("거래처연결", contactLinks.data);
  add("벤더담당자", vendorManagers.data);
  add("샘플", samples.data);
  add("제안서", proposals.data);
  add("제안서품목", proposalItems.data);
  add("입고", stockIns.data);
  add("전체주문(재고)", inventoryOrders.data);

  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="gonggu-backup-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
