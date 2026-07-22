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

function two(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * 엑셀의 날짜 칸을 "YYYY-MM-DD HH:mm" 문자열로 바꿉니다.
 * 스마트스토어 주문 엑셀의 결제일은 숫자(엑셀 일련번호: 1899-12-30 기준 일수)로 들어옵니다.
 * 예) 46220.94289 → 2026-07-17 22:37
 */
export function excelDateToText(v: unknown): string | null {
  if (v == null || v === "") return null;

  if (v instanceof Date) {
    return `${v.getFullYear()}-${two(v.getMonth() + 1)}-${two(v.getDate())} ${two(v.getHours())}:${two(v.getMinutes())}`;
  }

  const raw = cell(v);
  const serial = Number(raw);
  // 20000(1954년) ~ 90000(2146년) 범위면 엑셀 일련번호로 본다
  if (Number.isFinite(serial) && serial > 20000 && serial < 90000) {
    // 일련번호는 현지 시각 기준이므로 UTC로 만들고 UTC로 읽어야 원래 시각이 나온다
    const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())} ${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  }

  return raw || null;
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
      paidAt: excelDateToText(at(idx.paidAt)),
    });
  }
  return out;
}
