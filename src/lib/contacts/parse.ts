import * as XLSX from "xlsx";

export type ParsedContactRow = {
  name: string;
  kind: "셀러" | "벤더";
  instagram: string | null;
  followers: number | null;
  phone: string | null;
  address: string | null;
  memo: string | null;
  vendorNames: string[]; // 셀러의 경우 연결할 벤더 이름들
};

const ALIASES: Record<string, string[]> = {
  name: ["이름", "상호", "거래처", "name"],
  kind: ["구분", "유형", "종류", "kind"],
  instagram: ["인스타", "인스타그램", "instagram", "sns"],
  followers: ["팔로워", "팔로워수", "followers"],
  phone: ["연락처", "전화", "전화번호", "phone", "휴대폰"],
  address: ["주소", "배송지", "address"],
  memo: ["메모", "비고", "특이사항", "memo"],
  vendors: ["연결벤더", "벤더", "소속벤더", "벤더사"],
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

/** 셀러/벤더 엑셀을 파싱합니다. defaultKind는 구분 열이 없을 때 사용. */
export function parseContactWorkbook(
  data: Uint8Array,
  defaultKind: "셀러" | "벤더"
): ParsedContactRow[] {
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: null });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = (rows[i] ?? []).map(norm);
    if (cells.some((c) => ALIASES.name.includes(c))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const header = (rows[headerIdx] as unknown[]).map(norm);
  const findCol = (field: string) => {
    for (const a of ALIASES[field]) {
      const idx = header.indexOf(a);
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const col = {
    name: findCol("name"),
    kind: findCol("kind"),
    instagram: findCol("instagram"),
    followers: findCol("followers"),
    phone: findCol("phone"),
    address: findCol("address"),
    memo: findCol("memo"),
    vendors: findCol("vendors"),
  };

  const out: ParsedContactRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] as unknown[];
    if (!r) continue;
    const at = (k: number) => (k === -1 ? null : r[k]);
    const name = toStr(at(col.name));
    if (!name) continue;

    let kind: "셀러" | "벤더" = defaultKind;
    const kraw = toStr(at(col.kind));
    if (kraw?.includes("벤더")) kind = "벤더";
    else if (kraw?.includes("셀러")) kind = "셀러";

    const vraw = toStr(at(col.vendors));
    const vendorNames = vraw ? vraw.split(/[;,/·]/).map((s) => s.trim()).filter(Boolean) : [];

    out.push({
      name,
      kind,
      instagram: toStr(at(col.instagram)),
      followers: toNum(at(col.followers)),
      phone: toStr(at(col.phone)),
      address: toStr(at(col.address)),
      memo: toStr(at(col.memo)),
      vendorNames,
    });
  }
  return out;
}
