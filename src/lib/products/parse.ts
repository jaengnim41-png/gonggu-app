import * as XLSX from "xlsx";

export type ParsedProductRow = {
  productName: string;
  category: string | null;
  detailUrl: string | null;
  optionName: string | null;
  sku: string | null;
  normalPrice: number | null;
  gongguPrice: number | null;
  supplyPrice: number | null; // 벤더 공급가
  sellerSupplyPrice: number | null; // 셀러 공급가
  stock: number | null;
};

/** 헤더 후보 → 표준 필드. 대분류/제품명, 옵션명(매칭용) 등 여러 표기 허용 */
const HEADER_ALIASES: Record<string, string[]> = {
  productName: ["제품명", "대분류", "상품명", "product"],
  category: ["카테고리", "분류", "category"],
  detailUrl: ["상세url", "상세페이지 url", "url", "링크"],
  optionName: ["옵션명", "옵션명(매칭용)", "옵션", "option"],
  sku: ["sku", "sku코드", "코드", "재고코드"],
  normalPrice: ["정상가", "정상판매가", "정가"],
  gongguPrice: ["공구가", "공구판매가", "공동구매가"],
  supplyPrice: ["공급가", "벤더공급가", "벤더 공급가", "벤더 공급가(vat포함)"],
  sellerSupplyPrice: ["셀러공급가", "셀러 공급가", "셀러 공급가(vat포함)"],
  stock: ["현재재고", "재고", "재고수량", "전체수량"],
};

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toNum(v: unknown): number | null {
  const s = String(v ?? "").trim().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}

/**
 * 제품 엑셀(첫 시트)을 파싱합니다.
 * 헤더 줄을 자동으로 찾고, 한 행 = 옵션 하나로 읽습니다.
 * 제품명(대분류)만 있고 옵션명이 없으면 옵션 없는 제품으로 처리합니다.
 */
export function parseProductWorkbook(data: Uint8Array): ParsedProductRow[] {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });

  // 헤더 줄 찾기: 제품명/대분류 별칭이 들어있는 첫 줄
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] ?? []).map(norm);
    if (cells.some((c) => HEADER_ALIASES.productName.includes(c))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const header = (rows[headerIdx] as unknown[]).map(norm);
  const findCol = (field: string) => {
    for (const alias of HEADER_ALIASES[field]) {
      const idx = header.indexOf(alias);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const col = {
    productName: findCol("productName"),
    category: findCol("category"),
    detailUrl: findCol("detailUrl"),
    optionName: findCol("optionName"),
    sku: findCol("sku"),
    normalPrice: findCol("normalPrice"),
    gongguPrice: findCol("gongguPrice"),
    supplyPrice: findCol("supplyPrice"),
    sellerSupplyPrice: findCol("sellerSupplyPrice"),
    stock: findCol("stock"),
  };

  const out: ParsedProductRow[] = [];
  let lastProduct = "";
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r) continue;
    const at = (k: number) => (k === -1 ? null : r[k]);

    // 제품명이 비어 있으면 위 행의 제품에 이어지는 옵션으로 간주(엑셀 병합 셀 대응)
    let productName = toStr(at(col.productName));
    if (!productName) productName = lastProduct || null;
    if (!productName) continue;
    lastProduct = productName;

    const optionName = toStr(at(col.optionName));
    // 완전히 빈 행 건너뛰기
    if (!optionName && col.optionName !== -1 && !toStr(at(col.sku)) && toNum(at(col.stock)) == null) {
      // 제품명만 반복되는 빈 행일 수 있음 — 제품 자체는 유지되어야 하니 옵션 없는 행으로 남김
    }

    out.push({
      productName,
      category: toStr(at(col.category)),
      detailUrl: toStr(at(col.detailUrl)),
      optionName,
      sku: toStr(at(col.sku)),
      normalPrice: toNum(at(col.normalPrice)),
      gongguPrice: toNum(at(col.gongguPrice)),
      supplyPrice: toNum(at(col.supplyPrice)),
      sellerSupplyPrice: toNum(at(col.sellerSupplyPrice)),
      stock: toNum(at(col.stock)),
    });
  }
  return out;
}
