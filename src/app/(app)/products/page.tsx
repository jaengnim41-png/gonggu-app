import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createProduct, deleteProduct } from "./actions";

type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  normal_price: number | null;
  supply_price: number | null;
  status: string;
  product_options: { count: number }[];
};

function won(n: number | null) {
  return n == null ? "—" : "₩" + n.toLocaleString("ko-KR");
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, category, normal_price, supply_price, status, product_options(count)")
    .order("created_at", { ascending: false });
  const products = (data ?? []) as ProductRow[];

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">제품</h1>
          <p className="mt-1 text-sm text-slate-500">
            제품을 등록하고, 각 제품의 하위 옵션을 관리합니다.
          </p>
        </div>
      </div>

      {/* 새 제품 등록 */}
      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
          ＋ 새 제품 등록
        </summary>
        <form action={createProduct} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            제품명 *
            <input name="name" required placeholder="예: 케어백1" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            카테고리
            <input name="category" placeholder="예: 케어백 1세대" className={inputCls} />
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
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            소구점 / 주의사항
            <input name="selling_point" placeholder="마케팅 포인트" className={inputCls} />
            <input name="caution" placeholder="공구 시 주의사항" className={inputCls + " mt-2"} />
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
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {products.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            아직 등록된 제품이 없습니다. 위 “＋ 새 제품 등록”으로 첫 제품을 추가해 보세요.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">제품명</th>
                <th className="px-4 py-3">카테고리</th>
                <th className="px-4 py-3 text-right">정상가</th>
                <th className="px-4 py-3 text-right">옵션</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/products/${p.id}`}
                      className="font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{p.category ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{won(p.normal_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {p.product_options?.[0]?.count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
                      >
                        삭제
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
