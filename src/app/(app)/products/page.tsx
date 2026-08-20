import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/orders/parse";
import { createProduct, bulkUploadProducts } from "./actions";
import { addStockIn, uploadInventoryOrders, linkOption } from "../inventory/actions";
import { CatalogTable, type CatalogRow, type CatalogOption } from "./catalog-table";

type RawProduct = {
  id: string;
  name: string;
  category: string | null;
  detail_url: string | null;
  normal_price: number | null;
  supply_price: number | null;
  selling_point: string | null;
  caution: string | null;
};
type RawOption = {
  id: string;
  product_id: string;
  name: string;
  option_key: string | null;
  normal_price: number | null;
  gonggu_price: number | null;
  supply_price: number | null;
};
type StockIn = { product_option_id: string; quantity: number };
type InvOrder = {
  product_option_id: string | null;
  store_product_no: string | null;
  option_info: string | null;
  quantity: number;
  order_status: string | null;
};

function qty(n: number) {
  return n.toLocaleString("ko-KR");
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; uok?: string; uerror?: string; iok?: string; ierror?: string }>;
}) {
  const { error, uok, uerror, iok, ierror } = await searchParams;
  const supabase = await createClient();

  const [{ data: pData }, { data: optData }, { data: siData }, { data: ioData }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category, detail_url, normal_price, supply_price, selling_point, caution")
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_options")
      .select("id, product_id, name, option_key, normal_price, gonggu_price, supply_price")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("stock_ins").select("product_option_id, quantity"),
    supabase
      .from("inventory_orders")
      .select("product_option_id, store_product_no, option_info, quantity, order_status"),
  ]);

  const rawProducts = (pData ?? []) as RawProduct[];
  const rawOptions = (optData ?? []) as RawOption[];
  const stockIns = (siData ?? []) as StockIn[];
  const invOrders = (ioData ?? []) as InvOrder[];

  // 옵션별 입고·판매 합계
  const inByOpt = new Map<string, number>();
  for (const s of stockIns) inByOpt.set(s.product_option_id, (inByOpt.get(s.product_option_id) ?? 0) + (s.quantity ?? 0));
  const soldByOpt = new Map<string, number>();
  for (const o of invOrders) {
    if (!o.product_option_id || !isLive(o.order_status)) continue;
    soldByOpt.set(o.product_option_id, (soldByOpt.get(o.product_option_id) ?? 0) + (o.quantity ?? 0));
  }

  // 미연결 주문(옵션 연결 도우미)
  const unmatched = new Map<string, { pno: string; opt: string; qty: number }>();
  for (const o of invOrders) {
    if (o.product_option_id) continue;
    const k = `${o.store_product_no ?? ""}|${o.option_info ?? ""}`;
    const cur = unmatched.get(k) ?? { pno: o.store_product_no ?? "", opt: o.option_info ?? "", qty: 0 };
    cur.qty += o.quantity ?? 0;
    unmatched.set(k, cur);
  }
  const unmatchedRows = [...unmatched.values()].sort((a, b) => b.qty - a.qty);

  // 제품 + 옵션(가격·재고) 합치기
  const optsByProduct = new Map<string, CatalogOption[]>();
  for (const o of rawOptions) {
    const inQ = inByOpt.get(o.id) ?? 0;
    const soldQ = soldByOpt.get(o.id) ?? 0;
    const arr = optsByProduct.get(o.product_id) ?? [];
    arr.push({
      id: o.id,
      name: o.name,
      option_key: o.option_key,
      normal_price: o.normal_price,
      gonggu_price: o.gonggu_price,
      supply_price: o.supply_price,
      inQ,
      soldQ,
      avail: inQ - soldQ,
    });
    optsByProduct.set(o.product_id, arr);
  }
  const products: CatalogRow[] = rawProducts.map((p) => {
    const options = optsByProduct.get(p.id) ?? [];
    return {
      ...p,
      options,
      totalIn: options.reduce((s, o) => s + o.inQ, 0),
      totalSold: options.reduce((s, o) => s + o.soldQ, 0),
      totalAvail: options.reduce((s, o) => s + o.avail, 0),
    };
  });

  const allOptions = rawOptions;
  const productNameById = new Map(rawProducts.map((p) => [p.id, p.name]));
  const optionLabel = (o: RawOption) => `${productNameById.get(o.product_id) ?? "제품"} · ${o.name}`;

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const [newP, newO, newS] = (uok ?? "").split("-");

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <div>
        <h1 className="text-lg font-bold text-slate-900">제품·재고</h1>
        <p className="mt-1 text-sm text-slate-500">
          제품·옵션·가격·재고를 한 화면에서 관리합니다. 제품을 펼치면 옵션별 가격과 재고가 함께 보입니다.
        </p>
      </div>

      {/* 엑셀 통합 관리 */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">엑셀로 한 번에 관리 (제품·가격·재고 통합)</h2>
        <p className="mt-1 text-xs text-slate-500">
          양식 한 파일에 제품·옵션·가격·<b>현재재고</b>까지 들어 있습니다. 내려받아 고쳐 올리면 전부 한 번에 반영됩니다(이름으로 찾아 갱신 — 중복 안 생김).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a href="/api/products-template" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            📄 샘플 양식
          </a>
          <a href="/api/products-export" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            ⬇ 전체 내려받기(재고 포함)
          </a>
          <form action={bulkUploadProducts} className="flex items-center gap-2">
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls"
              required
              className="text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              일괄 반영
            </button>
          </form>
        </div>
        {uok && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            일괄 반영 완료 — 새 제품 {newP}종 · 옵션 {newO}개 · 재고 설정 {newS ?? 0}건
          </p>
        )}
        {uerror && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {uerror === "file" ? "엑셀 파일을 선택해 주세요." : "양식을 읽지 못했어요. 샘플 양식의 열 이름을 확인해 주세요."}
          </p>
        )}
      </div>

      {/* 전체 주문 업로드(재고 차감) */}
      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">전체 주문 파일 업로드 (재고 차감)</h2>
        <p className="mt-1 text-xs text-slate-500">
          오늘의 주문서를 올리면 판매수량만큼 재고가 빠집니다. 같은 파일 여러 번 올려도 중복 차감 안 됩니다(상품주문번호 기준).
        </p>
        <form action={uploadInventoryOrders} className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".xlsx,.xls"
            required
            className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-indigo-700"
          />
          <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            업로드
          </button>
        </form>
        {iok && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {qty(Number(iok))}건의 주문을 반영했습니다. 아직 연결 안 된 옵션이 있으면 아래에서 이어주세요.
          </p>
        )}
        {ierror && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {ierror === "file" ? "엑셀 파일을 선택해 주세요." : "업로드에 실패했어요."}
          </p>
        )}
      </div>

      {/* 옵션 연결 도우미 */}
      {unmatchedRows.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-amber-800">
            옵션 연결 도우미 <span className="text-amber-600">({unmatchedRows.length})</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            주문의 옵션 글자를 우리 제품 옵션과 한 번만 이어주면, 다음부터는 자동으로 차감됩니다.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {unmatchedRows.map((u) => (
              <form key={u.pno + u.opt} action={linkOption} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5">
                <input type="hidden" name="store_product_no" value={u.pno} />
                <input type="hidden" name="option_info" value={u.opt} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-800">{u.opt || "(옵션 없음)"}</div>
                  <div className="text-[11px] text-slate-400">상품번호 {u.pno || "—"} · {qty(u.qty)}개</div>
                </div>
                <span className="text-slate-400">↔</span>
                <select name="product_option_id" required defaultValue="" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm">
                  <option value="" disabled>제품 옵션 선택…</option>
                  {allOptions.map((o) => (
                    <option key={o.id} value={o.id}>{optionLabel(o)}</option>
                  ))}
                </select>
                <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  연결
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      {/* 제품 직접 등록 · 입고 등록 */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 제품 하나 직접 등록</summary>
          <form action={createProduct} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              제품명 *
              <input name="name" required placeholder="예: 케어백 1세대" className={inputCls} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              카테고리
              <input name="category" placeholder="예: 케어백" className={inputCls} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              상세페이지 URL
              <input name="detail_url" placeholder="https://smartstore..." className={inputCls} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              정상판매가
              <input name="normal_price" inputMode="numeric" placeholder="23000" className={inputCls} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              기본 공급가
              <input name="supply_price" inputMode="numeric" placeholder="12675" className={inputCls} />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
                제품 등록
              </button>
            </div>
          </form>
        </details>

        <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 입고 등록</summary>
          {allOptions.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">먼저 제품·옵션을 등록해 주세요.</p>
          ) : (
            <form action={addStockIn} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                옵션 *
                <select name="product_option_id" required defaultValue="" className={inputCls}>
                  <option value="" disabled>옵션 선택…</option>
                  {allOptions.map((o) => (
                    <option key={o.id} value={o.id}>{optionLabel(o)}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-700">
                입고 수량 *
                <input name="quantity" inputMode="numeric" required placeholder="예: 500" className={inputCls} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                메모
                <input name="note" placeholder="예: 7/21 입고" className={inputCls} />
              </label>
              <div className="sm:col-span-2">
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                  입고 등록
                </button>
              </div>
            </form>
          )}
        </details>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "name" ? "제품명을 입력해 주세요." : error === "input" ? "값을 확인해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      {/* 통합 표 */}
      <div className="mt-8">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400 shadow-sm">
            아직 등록된 제품이 없습니다. 위에서 엑셀로 일괄 등록하거나 직접 추가해 보세요.
          </div>
        ) : (
          <CatalogTable products={products} />
        )}
      </div>

      <p className="mt-4 text-xs text-slate-400">
        옵션 추가·SKU 수정은 각 제품의 <Link href="/products" className="underline">상세</Link> 버튼에서, 대량 수정은 엑셀로 하세요.
      </p>
    </div>
  );
}
