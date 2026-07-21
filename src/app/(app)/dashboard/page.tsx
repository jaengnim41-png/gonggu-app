import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";
import { isLive } from "@/lib/orders/parse";

type GB = { id: string; title: string; status: string; end_date: string | null };
type Item = { group_buy_id: string; product_name: string; store_product_no: string | null; gonggu_price: number | null };
type Order = { group_buy_id: string; store_product_no: string | null; quantity: number; order_status: string | null };

function won(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

export default async function DashboardPage() {
  const { company } = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: gbData }, { data: itemData }, { data: orderData }] =
    await Promise.all([
      supabase.from("group_buys").select("id, title, status, end_date").order("created_at", { ascending: false }),
      supabase.from("group_buy_items").select("group_buy_id, product_name, store_product_no, gonggu_price"),
      supabase.from("orders").select("group_buy_id, store_product_no, quantity, order_status"),
    ]);

  const groupBuys = (gbData ?? []) as GB[];
  const items = (itemData ?? []) as Item[];
  const orders = (orderData ?? []) as Order[];

  // 상품번호 → { 가격, 제품명 }
  const pmap = new Map<string, { price: number; name: string }>();
  for (const it of items) {
    if (it.store_product_no)
      pmap.set(it.store_product_no, { price: it.gonggu_price ?? 0, name: it.product_name });
  }

  // 집계
  let totalRevenue = 0;
  const revenueByGb = new Map<string, number>();
  const revenueByProduct = new Map<string, number>();
  for (const o of orders) {
    if (!isLive(o.order_status)) continue;
    const info = pmap.get(String(o.store_product_no ?? ""));
    const amount = (o.quantity ?? 0) * (info?.price ?? 0);
    totalRevenue += amount;
    revenueByGb.set(o.group_buy_id, (revenueByGb.get(o.group_buy_id) ?? 0) + amount);
    if (info) revenueByProduct.set(info.name, (revenueByProduct.get(info.name) ?? 0) + amount);
  }

  const statusCount = (s: string) => groupBuys.filter((g) => g.status === s).length;
  const productRank = [...revenueByProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const recentGbs = groupBuys.slice(0, 6);

  const stat = (label: string, value: string, sub?: string) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );

  const statusPill = (s: string) => {
    const cls =
      s === "진행중" ? "bg-indigo-50 text-indigo-700"
      : s === "예정" ? "bg-emerald-50 text-emerald-700"
      : s === "정산대기" ? "bg-amber-50 text-amber-700"
      : "bg-slate-100 text-slate-600";
    return <span className={"rounded-full px-2 py-0.5 text-xs font-semibold " + cls}>{s}</span>;
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">{company?.name} 대시보드</h1>
      <p className="mt-1 text-sm text-slate-500">공구·매출 현황을 한눈에 봅니다.</p>

      {/* 요약 카드 */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stat("누적 매출", won(totalRevenue), "살아있는 주문 기준")}
        {stat("진행 중 공구", statusCount("진행중") + "건", "예정 " + statusCount("예정"))}
        {stat("정산 대기", statusCount("정산대기") + "건")}
        {stat("전체 공구", groupBuys.length + "건")}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* 제품별 매출 랭킹 */}
        <div>
          <h2 className="text-sm font-bold text-slate-900">제품별 매출 🏆</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {productRank.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">
                아직 매출 데이터가 없습니다. 공구에 주문을 업로드하면 채워집니다.
              </p>
            ) : (
              <ul>
                {productRank.map(([name, rev], i) => (
                  <li key={name} className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-50 text-xs font-bold text-indigo-700">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm text-slate-800">{name}</span>
                    <span className="text-sm font-semibold tabular-nums">{won(rev)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 최근 공구 */}
        <div>
          <h2 className="text-sm font-bold text-slate-900">최근 공구</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {recentGbs.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">등록된 공구가 없습니다.</p>
            ) : (
              <ul>
                {recentGbs.map((g) => (
                  <li key={g.id} className="border-b border-slate-100 last:border-0">
                    <Link href={`/group-buys/${g.id}`} className="flex items-center gap-2 px-4 py-3 hover:bg-slate-50">
                      <span className="flex-1 truncate text-sm text-slate-800">{g.title}</span>
                      <span className="text-xs tabular-nums text-slate-500">{won(revenueByGb.get(g.id) ?? 0)}</span>
                      {statusPill(g.status)}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 바로가기 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { href: "/group-buys", label: "공구 관리 →", desc: "공구·배정·판매현황·정산" },
          { href: "/products", label: "제품 관리 →", desc: "제품·하위 옵션" },
          { href: "/inventory", label: "재고 관리 →", desc: "전체 주문 업로드·자동 차감" },
        ].map((c) => (
          <a key={c.href} href={c.href} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-400">
            <div className="text-sm font-semibold text-slate-900">{c.label}</div>
            <p className="mt-1 text-xs text-slate-500">{c.desc}</p>
          </a>
        ))}
      </div>

      {/* 데이터 내보내기 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-sm font-semibold text-slate-900">데이터 내보내기 · 백업</div>
          <p className="mt-1 text-xs text-slate-500">제품·공구·주문·정산 전체를 엑셀 한 파일로 내려받습니다.</p>
        </div>
        <a href="/api/export" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
          전체 엑셀 내보내기
        </a>
      </div>
    </div>
  );
}
