import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/orders/parse";
import { addStockIn, uploadInventoryOrders, linkOption } from "./actions";

type OptionRow = {
  id: string;
  name: string;
  product_id: string;
  products: { name: string } | { name: string }[] | null;
};
type StockIn = { product_option_id: string; quantity: number };
type InvOrder = {
  product_option_id: string | null;
  store_product_no: string | null;
  option_info: string | null;
  quantity: number;
  order_status: string | null;
};

function productName(p: OptionRow["products"]): string {
  if (!p) return "제품";
  return Array.isArray(p) ? (p[0]?.name ?? "제품") : p.name;
}
function qty(n: number) {
  return n.toLocaleString("ko-KR");
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; uok?: string; uerror?: string }>;
}) {
  const { error, uok, uerror } = await searchParams;
  const supabase = await createClient();

  const [{ data: optData }, { data: siData }, { data: ioData }] =
    await Promise.all([
      supabase.from("product_options").select("id, name, product_id, products(name)"),
      supabase.from("stock_ins").select("product_option_id, quantity"),
      supabase
        .from("inventory_orders")
        .select("product_option_id, store_product_no, option_info, quantity, order_status"),
    ]);

  const options = (optData ?? []) as OptionRow[];
  const stockIns = (siData ?? []) as StockIn[];
  const invOrders = (ioData ?? []) as InvOrder[];

  // 입고 합계 / 판매 합계(매칭·살아있는 것)
  const inByOpt = new Map<string, number>();
  for (const s of stockIns)
    inByOpt.set(s.product_option_id, (inByOpt.get(s.product_option_id) ?? 0) + (s.quantity ?? 0));

  const soldByOpt = new Map<string, number>();
  for (const o of invOrders) {
    if (!o.product_option_id || !isLive(o.order_status)) continue;
    soldByOpt.set(o.product_option_id, (soldByOpt.get(o.product_option_id) ?? 0) + (o.quantity ?? 0));
  }

  // 미연결 주문 옵션글자 모으기
  const unmatched = new Map<string, { pno: string; opt: string; qty: number }>();
  for (const o of invOrders) {
    if (o.product_option_id) continue;
    const k = `${o.store_product_no ?? ""}|${o.option_info ?? ""}`;
    const cur = unmatched.get(k) ?? {
      pno: o.store_product_no ?? "",
      opt: o.option_info ?? "",
      qty: 0,
    };
    cur.qty += o.quantity ?? 0;
    unmatched.set(k, cur);
  }
  const unmatchedRows = [...unmatched.values()].sort((a, b) => b.qty - a.qty);

  // 제품별로 옵션 묶기
  const byProduct = new Map<string, { name: string; opts: OptionRow[] }>();
  for (const o of options) {
    const g = byProduct.get(o.product_id) ?? { name: productName(o.products), opts: [] };
    g.opts.push(o);
    byProduct.set(o.product_id, g);
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const optionLabel = (o: OptionRow) => `${productName(o.products)} · ${o.name}`;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">재고</h1>
      <p className="mt-1 text-sm text-slate-500">
        전체 주문 파일을 올리면 옵션별 재고가 자동 차감됩니다. (공구 판매집계와 분리)
      </p>

      {/* 전체 주문 업로드 */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">전체 주문 파일 업로드 (재고 차감)</h2>
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
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            업로드
          </button>
        </form>
        {uok && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {qty(Number(uok))}건의 주문을 반영했습니다. 아직 연결 안 된 옵션이 있으면 아래에서 이어주세요.
          </p>
        )}
        {uerror && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {uerror === "file" ? "엑셀 파일을 선택해 주세요." : "업로드에 실패했어요."}
          </p>
        )}
      </div>

      {/* 옵션 연결 도우미 */}
      {unmatchedRows.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-amber-800">
            옵션 연결 도우미 <span className="text-amber-600">({unmatchedRows.length})</span>
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            주문의 옵션 글자를 우리 제품 옵션과 한 번만 이어주면, 다음부터는 자동으로 차감됩니다.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {unmatchedRows.map((u) => (
              <form
                key={u.pno + u.opt}
                action={linkOption}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2.5"
              >
                <input type="hidden" name="store_product_no" value={u.pno} />
                <input type="hidden" name="option_info" value={u.opt} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-slate-800">{u.opt || "(옵션 없음)"}</div>
                  <div className="text-[11px] text-slate-400">
                    상품번호 {u.pno || "—"} · {qty(u.qty)}개
                  </div>
                </div>
                <span className="text-slate-400">↔</span>
                <select name="product_option_id" required defaultValue="" className="rounded-lg border border-slate-300 px-2.5 py-2 text-sm">
                  <option value="" disabled>
                    제품 옵션 선택…
                  </option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {optionLabel(o)}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  연결
                </button>
              </form>
            ))}
          </div>
        </div>
      )}

      {/* 입고 등록 */}
      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 입고 등록</summary>
        {options.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            먼저 <Link href="/products" className="text-indigo-600 hover:underline">제품·옵션</Link>을 등록해 주세요.
          </p>
        ) : (
          <form action={addStockIn} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              옵션 *
              <select name="product_option_id" required defaultValue="" className={inputCls}>
                <option value="" disabled>
                  옵션 선택…
                </option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {optionLabel(o)}
                  </option>
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

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "input" ? "값을 확인해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      {/* 재고 현황 */}
      <h2 className="mt-8 text-sm font-bold text-slate-900">재고 현황</h2>
      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {options.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            등록된 제품 옵션이 없습니다.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">제품 / 옵션</th>
                <th className="px-4 py-3 text-right">입고</th>
                <th className="px-4 py-3 text-right">판매</th>
                <th className="px-4 py-3 text-right">가용</th>
                <th className="px-4 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {[...byProduct.values()].map((g) =>
                g.opts.map((o, i) => {
                  const inQ = inByOpt.get(o.id) ?? 0;
                  const soldQ = soldByOpt.get(o.id) ?? 0;
                  const avail = inQ - soldQ;
                  const low = avail <= 10;
                  return (
                    <tr key={o.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        {i === 0 && <span className="font-semibold text-slate-900">{g.name}</span>}
                        <span className={i === 0 ? "ml-2 text-slate-600" : "text-slate-600"}>{o.name}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{qty(inQ)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{qty(soldQ)}</td>
                      <td className={"px-4 py-3 text-right font-semibold tabular-nums " + (low ? "text-rose-600" : "text-emerald-600")}>
                        {qty(avail)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + (low ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
                          {low ? "부족" : "충분"}
                        </span>
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        가용 = 입고 − 판매(전체 주문 업로드에서 자동 차감). 재고는 브랜드가 자기 제품 기준으로 관리합니다.
      </p>
    </div>
  );
}
