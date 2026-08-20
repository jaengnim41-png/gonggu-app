import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

/**
 * 제품 일괄 등록용 샘플 양식(빈 템플릿 + 예시 2줄)을 내려줍니다.
 * 한 행 = 옵션 하나. 같은 제품명은 여러 줄로 이어 적습니다.
 */
export async function GET() {
  const headers = [
    "제품명",
    "카테고리",
    "상세URL",
    "옵션명",
    "SKU",
    "정상가",
    "공구가",
    "공급가",
    "현재재고",
  ];
  const example = [
    ["케어백 1세대", "케어백", "https://smartstore.naver.com/uddyu", "서양배", "CB1-013", 23000, 16900, 12675, 4340],
    ["케어백 1세대", "케어백", "", "비닐", "CB1-014", 22500, 14000, 10500, 2500],
    ["콩딱", "도어쿠션", "", "콩딱 A(1+1)", "KD-001", 23900, 15300, 11016, 1200],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  ws["!cols"] = [
    { wch: 16 }, { wch: 12 }, { wch: 34 }, { wch: 22 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "제품등록양식");

  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent("제품등록_양식")}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
