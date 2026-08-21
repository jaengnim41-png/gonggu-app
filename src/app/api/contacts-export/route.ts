import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/server";

/** 셀러 또는 벤더 목록을 엑셀로 내려받습니다(RLS). 양식과 같은 컬럼. */
export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") === "벤더" ? "벤더" : "셀러";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  const [{ data: contacts }, { data: links }, { data: allContacts }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, name, instagram, followers, phone, address, memo")
      .eq("kind", kind)
      .order("sort_order"),
    supabase.from("contact_links").select("seller_id, vendor_id"),
    supabase.from("contacts").select("id, name"),
  ]);

  const nameById = new Map((allContacts ?? []).map((c) => [c.id, c.name]));
  const vendorsBySeller = new Map<string, string[]>();
  const sellersByVendor = new Map<string, string[]>();
  for (const l of links ?? []) {
    const vn = nameById.get(l.vendor_id);
    const sn = nameById.get(l.seller_id);
    if (vn) {
      const arr = vendorsBySeller.get(l.seller_id) ?? [];
      arr.push(vn);
      vendorsBySeller.set(l.seller_id, arr);
    }
    if (sn) {
      const arr = sellersByVendor.get(l.vendor_id) ?? [];
      arr.push(sn);
      sellersByVendor.set(l.vendor_id, arr);
    }
  }

  // 벤더는 인스타·팔로워 없이 연결셀러, 셀러는 기존 그대로 연결벤더
  const rows = (contacts ?? []).map((c) =>
    kind === "벤더"
      ? {
          이름: c.name,
          구분: kind,
          연락처: c.phone ?? "",
          주소: c.address ?? "",
          메모: c.memo ?? "",
          연결셀러: (sellersByVendor.get(c.id) ?? []).join("; "),
        }
      : {
          이름: c.name,
          구분: kind,
          인스타: c.instagram ?? "",
          팔로워: c.followers ?? "",
          연락처: c.phone ?? "",
          주소: c.address ?? "",
          메모: c.memo ?? "",
          연결벤더: (vendorsBySeller.get(c.id) ?? []).join("; "),
        }
  );

  const emptyRow =
    kind === "벤더"
      ? { 이름: "", 구분: kind, 연락처: "", 주소: "", 메모: "", 연결셀러: "" }
      : { 이름: "", 구분: kind, 인스타: "", 팔로워: "", 연락처: "", 주소: "", 메모: "", 연결벤더: "" };

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [emptyRow]);
  ws["!cols"] =
    kind === "벤더"
      ? [{ wch: 20 }, { wch: 8 }, { wch: 16 }, { wch: 30 }, { wch: 20 }, { wch: 28 }]
      : [{ wch: 18 }, { wch: 8 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 30 }, { wch: 20 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, kind + "목록");

  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(kind + "목록")}-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
