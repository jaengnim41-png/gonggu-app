import { createAnonClient } from "@/lib/supabase/anon";
import { isLive } from "@/lib/orders/parse";

type Item = {
  product_name: string;
  store_product_no: string | null;
  allocated_qty: number | null;
  gonggu_price: number | null;
};
type Order = {
  option_info: string | null;
  store_product_no: string | null;
  quantity: number;
  order_status: string | null;
};
type Payload = {
  group_buy: {
    title: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
  } | null;
  items: Item[];
  orders: Order[];
};

function won(n: number | null) {
  return n == null ? "—" : "₩" + n.toLocaleString("ko-KR");
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAnonClient();
  const { data } = await supabase.rpc("shared_group_buy", { p_token: token });
  const payload = data as Payload | null;

  if (!payload || !payload.group_buy) {
    return (
      <main className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200 text-lg font-bold text-slate-500">
            공
          </div>
          <h1 className="text-lg font-bold text-slate-900">링크를 열 수 없습니다</h1>
          <p className="mt-1 text-sm text-slate-500">
            만료되었거나 비활성화된 링크예요. 보내주신 분께 다시 문의해 주세요.
          </p>
        </div>
      </main>
    );
  }

  const { group_buy: gb, items, orders } = payload;

  const priceByPno = new Map<string, number>();
  for (const it of items)
    if (it.store_product_no) priceByPno.set(it.store_product_no, it.gonggu_price ?? 0);

  const soldByPno = new Map<string, number>();
  for (const o of orders) {
    if (!isLive(o.order_status)) continue;
    const k = String(o.store_product_no ?? "");
    soldByPno.set(k, (soldByPno.get(k) ?? 0) + (o.quantity ?? 0));
  }

  const salesByOption = new Map<string, { qty: number; amount: number }>();
  let totalQty = 0;
  let totalAmount = 0;
  for (const o of orders) {
    if (!isLive(o.order_status)) continue;
    const key = o.option_info || "(옵션 없음)";
    const price = priceByPno.get(String(o.store_product_no ?? "")) ?? 0;
    const amount = (o.quantity ?? 0) * price;
    const cur = salesByOption.get(key) ?? { qty: 0, amount: 0 };
    cur.qty += o.quantity ?? 0;
    cur.amount += amount;
    salesByOption.set(key, cur);
    totalQty += o.quantity ?? 0;
    totalAmount += amount;
  }
  const salesRows = [...salesByOption.entries()].sort((a, b) => b[1].amount - a[1].amount);

  return (
    <main className="min-h-full bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            공
          </div>
          <span className="font-semibold text-slate-900">공구허브</span>
          <span className="ml-auto text-xs text-slate-400">공유 페이지 · 읽기 전용</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">{gb.title}</h1>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              {gb.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            기간 {gb.start_date ?? "—"} ~ {gb.end_date ?? "—"}
          </p>
        </div>

        {/* 배정/판매/잔여 */}
        {items.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">제품</th>
                  <th className="px-4 py-3 text-right">배정</th>
                  <th className="px-4 py-3 text-right">판매</th>
                  <th className="px-4 py-3 text-right">잔여</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const sold = soldByPno.get(String(it.store_product_no ?? "")) ?? 0;
                  const remain = it.allocated_qty == null ? null : it.allocated_qty - sold;
                  const low = remain != null && remain <= 10;
                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 text-slate-900">{it.product_name}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {it.allocated_qty?.toLocaleString("ko-KR") ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{sold.toLocaleString("ko-KR")}</td>
                      <td
                        className={
                          "px-4 py-3 text-right font-semibold tabular-nums " +
                          (remain == null ? "text-slate-400" : low ? "text-rose-600" : "text-emerald-600")
                        }
                      >
                        {remain == null ? "—" : remain.toLocaleString("ko-KR")}
                        {low && <span className="ml-1 text-[10px] font-bold">매진임박</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 판매현황 */}
        {salesRows.length > 0 && (
          <>
            <h2 className="mt-8 text-sm font-bold text-slate-900">판매현황</h2>
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3">옵션</th>
                    <th className="px-4 py-3 text-right">수량</th>
                    <th className="px-4 py-3 text-right">판매금액</th>
                  </tr>
                </thead>
                <tbody>
                  {salesRows.map(([opt, v]) => (
                    <tr key={opt} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-900">{opt}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{v.qty.toLocaleString("ko-KR")}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{won(v.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50 font-bold text-indigo-900">
                    <td className="px-4 py-3">전체 수량 및 매출</td>
                    <td className="px-4 py-3 text-right tabular-nums">{totalQty.toLocaleString("ko-KR")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{won(totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* 원칙 3: 가입 유도 */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
          <p className="text-sm font-medium text-indigo-900">
            더 편하게 관리하고 싶으신가요? 가입하면 메시지·정산·히스토리를 쓸 수 있어요.
          </p>
          <a
            href="/"
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            공구허브 시작하기
          </a>
        </div>
      </div>
    </main>
  );
}
