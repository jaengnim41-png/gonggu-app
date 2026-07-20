import * as XLSX from "xlsx";

export type ParsedOrder = {
  productOrderNo: string;
  orderNo: string | null;
  storeProductNo: string;
  productName: string | null;
  optionInfo: string | null;
  quantity: number;
  orderStatus: string | null;
  paidAt: string | null;
};

/** 취소·반품이 아닌 "살아있는 주문"인지 */
export function isLive(status: string | null): boolean {
  if (!status) return true;
  return !status.includes("취소") && !status.includes("반품");
}

function cell(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * 스마트스토어 주문 엑셀(첫 시트)을 파싱합니다.
 * 헤더 줄(상품번호·옵션정보·수량 포함)을 자동으로 찾으므로,
 * 안내문 1행이 있든 없든(삭제 후 업로드) 모두 처리됩니다.
 */
export function parseOrderWorkbook(data: Uint8Array): ParsedOrder[] {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  // 1) 헤더 줄 찾기
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const r = (rows[i] ?? []).map(cell);
    if (r.includes("상품번호") && r.includes("옵션정보") && r.includes("수량")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const header = (rows[headerIdx] as unknown[]).map(cell);
  const find = (name: string) => header.indexOf(name);
  const idx = {
    storeProductNo: find("상품번호"),
    productName: find("상품명"),
    optionInfo: find("옵션정보"),
    quantity: find("수량"),
    paidAt: find("결제일"),
    productOrderNo: find("상품주문번호"),
    orderNo: find("주문번호"),
    orderStatus: find("주문상태"),
  };

  const out: ParsedOrder[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r) continue;
    const at = (k: number) => (k === -1 ? null : r[k]);

    const storeProductNo = cell(at(idx.storeProductNo));
    let productOrderNo = cell(at(idx.productOrderNo));
    if (!storeProductNo && !productOrderNo) continue;
    if (!productOrderNo) productOrderNo = `${storeProductNo}-${i}`;

    const qtyRaw = at(idx.quantity);
    const quantity =
      qtyRaw == null ? 0 : parseInt(cell(qtyRaw).replace(/,/g, ""), 10) || 0;

    out.push({
      productOrderNo,
      orderNo: cell(at(idx.orderNo)) || null,
      storeProductNo,
      productName: cell(at(idx.productName)) || null,
      optionInfo: cell(at(idx.optionInfo)) || null,
      quantity,
      orderStatus: cell(at(idx.orderStatus)) || null,
      paidAt: cell(at(idx.paidAt)) || null,
    });
  }
  return out;
}
