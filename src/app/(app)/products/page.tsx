import { createClient } from "@/lib/supabase/server";
import { createProduct, bulkUploadProducts } from "./actions";
import { ProductTable, type ProductRow } from "./product-table";
import { CatalogTabs } from "@/components/catalog-tabs";

type Raw = {
  id: string;
  name: string;
  category: string | null;
  detail_url: string | null;
  normal_price: number | null;
  supply_price: number | null;
  selling_point: string | null;
  caution: string | null;
  product_options: { count: number }[];
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; uok?: string; uerror?: string }>;
}) {
  const { error, uok, uerror } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, category, detail_url, normal_price, supply_price, selling_point, caution, product_options(count)")
    .order("sort_order", { ascending: true });

  const products: ProductRow[] = ((data ?? []) as Raw[]).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    detail_url: p.detail_url,
    normal_price: p.normal_price,
    supply_price: p.supply_price,
    selling_point: p.selling_point,
    caution: p.caution,
    optionCount: p.product_options?.[0]?.count ?? 0,
  }));

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const [newP, newO] = (uok ?? "").split("-");

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <CatalogTabs />
      <div>
        <h1 className="text-lg font-bold text-slate-900">카탈로그</h1>
        <p className="mt-1 text-sm text-slate-500">
          대분류(제품)로 묶고 옵션으로 나눠 관리합니다. 순서 변경·수정·엑셀 일괄 등록을 지원합니다.
        </p>
      </div>

      {/* 엑셀 도구 */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">엑셀로 한 번에 관리</h2>
        <p className="mt-1 text-xs text-slate-500">
          양식을 받아 제품·옵션·가격을 채운 뒤 올리면 한 번에 등록됩니다. 이미 있는 제품·옵션은 이름으로 찾아 갱신됩니다(중복 안 생김).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href="/api/products-template"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            📄 샘플 양식 받기
          </a>
          <a
            href="/api/products-export"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ⬇ 전체 내려받기
          </a>
          <form action={bulkUploadProducts} className="flex items-center gap-2">
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls"
              required
              className="text-sm text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              엑셀 일괄 등록
            </button>
          </form>
        </div>
        {uok && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            일괄 등록 완료 — 새 제품 {newP}종, 옵션 {newO}개 반영됐습니다.
          </p>
        )}
        {uerror && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {uerror === "file" ? "엑셀 파일을 선택해 주세요." : "양식을 읽지 못했어요. 샘플 양식의 열 이름을 확인해 주세요."}
          </p>
        )}
      </div>

      {/* 새 제품 등록 */}
      <details className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
          ＋ 제품 하나 직접 등록
        </summary>
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
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              제품 등록
            </button>
          </div>
        </form>
      </details>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "name" ? "제품명을 입력해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      {/* 제품 목록 */}
      <div className="mt-6">
        {products.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400 shadow-sm">
            아직 등록된 제품이 없습니다. 위에서 엑셀로 일괄 등록하거나 직접 추가해 보세요.
          </div>
        ) : (
          <ProductTable products={products} />
        )}
      </div>
    </div>
  );
}
