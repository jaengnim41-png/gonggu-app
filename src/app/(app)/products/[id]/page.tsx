import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/orders/parse";
import { ConfirmButton } from "@/components/confirm-button";
import { addOption, deleteOption } from "../actions";

type Product = {
  id: string;
  name: string;
  category: string | null;
  detail_url: string | null;
  normal_price: number | null;
  supply_price: number | null;
  selling_point: string | null;
  caution: string | null;
};

type Option = {
  id: string;
  name: string;
  option_key: string | null;
  normal_price: number | null;
  gonggu_price: number | null;
  supply_price: number | null;
};

function won(n: number | null) {
  return n == null ? "—" : "₩" + n.toLocaleString("ko-KR");
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle<Product>();

  if (!product) notFound();

  const { data: optData } = await supabase
    .from("product_options")
    .select("id, name, option_key, normal_price, gonggu_price, supply_price")
    .eq("product_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const options = (optData ?? []) as Option[];

  // 옵션별 재고(가용 = 입고 − 판매) 계산
  const optionIds = options.map((o) => o.id);
  const [{ data: siData }, { data: ioData }] = await Promise.all([
    optionIds.length
      ? supabase.from("stock_ins").select("product_option_id, quantity").in("product_option_id", optionIds)
      : Promise.resolve({ data: [] as { product_option_id: string; quantity: number }[] }),
    optionIds.length
      ? supabase
          .from("inventory_orders")
          .select("product_option_id, quantity, order_status")
          .in("product_option_id", optionIds)
      : Promise.resolve({ data: [] as { product_option_id: string | null; quantity: number; order_status: string | null }[] }),
  ]);
  const availByOpt = new Map<string, number>();
  for (const s of (siData ?? []) as { product_option_id: string; quantity: number }[]) {
    availByOpt.set(s.product_option_id, (availByOpt.get(s.product_option_id) ?? 0) + (s.quantity ?? 0));
  }
  for (const o of (ioData ?? []) as { product_option_id: string | null; quantity: number; order_status: string | null }[]) {
    if (!o.product_option_id || !isLive(o.order_status)) continue;
    availByOpt.set(o.product_option_id, (availByOpt.get(o.product_option_id) ?? 0) - (o.quantity ?? 0));
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <Link href="/products" className="text-sm text-slate-500 hover:underline">
        ← 제품 목록
      </Link>

      {/* 제품 정보 */}
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">{product.name}</h1>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
          {product.category && <span>{product.category}</span>}
          <span>정상가 {won(product.normal_price)}</span>
          <span>공급가 {won(product.supply_price)}</span>
          {product.detail_url && (
            <a
              href={product.detail_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              상세페이지 ↗
            </a>
          )}
        </div>
        {(product.selling_point || product.caution) && (
          <div className="mt-3 space-y-1 text-xs text-slate-500">
            {product.selling_point && <p>소구점: {product.selling_point}</p>}
            {product.caution && <p>주의: {product.caution}</p>}
          </div>
        )}
      </div>

      {/* 하위 옵션 */}
      <h2 className="mt-8 text-sm font-bold text-slate-900">
        하위 옵션 <span className="text-slate-400">({options.length})</span>
      </h2>

      <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
          ＋ 옵션 추가
        </summary>
        <form action={addOption} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="product_id" value={product.id} />
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            옵션명 *
            <input name="name" required placeholder="예: 서양배 1개+봉투90매" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            정상가
            <input name="normal_price" inputMode="numeric" placeholder="23000" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            공구가
            <input name="gonggu_price" inputMode="numeric" placeholder="16900" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            공급가
            <input name="supply_price" inputMode="numeric" placeholder="12675" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            재고 구분값(선택)
            <input name="option_key" placeholder="예: 서양배 / S.실버" className={inputCls} />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              옵션 추가
            </button>
          </div>
        </form>
      </details>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "name" ? "옵션명을 입력해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {options.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            아직 옵션이 없습니다. 위 “＋ 옵션 추가”로 첫 옵션을 넣어 보세요.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">옵션명</th>
                <th className="px-4 py-3 text-right">정상가</th>
                <th className="px-4 py-3 text-right">공구가</th>
                <th className="px-4 py-3 text-right">공급가</th>
                <th className="px-4 py-3 text-right">가용재고</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 text-slate-900">
                    {o.option_key && (
                      <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                        {o.option_key}
                      </span>
                    )}
                    {o.name}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{won(o.normal_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{won(o.gonggu_price)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{won(o.supply_price)}</td>
                  <td className={"px-4 py-3 text-right font-semibold tabular-nums " + ((availByOpt.get(o.id) ?? 0) <= 10 ? "text-rose-600" : "text-emerald-600")}>
                    {(availByOpt.get(o.id) ?? 0).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={deleteOption}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="product_id" value={product.id} />
                      <ConfirmButton
                        message={`옵션 '${o.name}'을 삭제할까요?`}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
                      >
                        삭제
                      </ConfirmButton>
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
