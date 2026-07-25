import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";

/** 셀러/벤더 일괄 등록 샘플 양식. kind=벤더면 벤더용 예시. */
export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") === "벤더" ? "벤더" : "셀러";
  const headers = ["이름", "구분", "인스타", "팔로워", "연락처", "주소", "메모", "연결벤더"];

  const example =
    kind === "벤더"
      ? [
          ["레몬트리커뮤니케이션", "벤더", "", "", "010-0000-0000", "서울시 ...", "주력 파트너", ""],
          ["예시벤더", "벤더", "", "", "", "", "", ""],
        ]
      : [
          ["호담또담", "셀러", "@hodam.ddam", 52300, "010-1111-2222", "경기도 ...", "촬영 잘함", "레몬트리커뮤니케이션"],
          ["여러벤더셀러", "셀러", "@multi", 12000, "", "", "", "레몬트리커뮤니케이션; 예시벤더"],
        ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  ws["!cols"] = [
    { wch: 18 }, { wch: 8 }, { wch: 16 }, { wch: 10 },
    { wch: 16 }, { wch: 30 }, { wch: 20 }, { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, kind === "벤더" ? "벤더등록양식" : "셀러등록양식");

  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(kind + "_등록양식")}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
