import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";
import {
  calcGroupBuyTotals,
  calcRevenueByItem,
  type TotalsItem,
  type TotalsOrder,
  type TotalsOptionPrice,
} from "@/lib/group-buys/totals";
import { ScheduleSummary, type ScheduleEntry } from "@/components/schedule-summary";

type GB = { id: string; title: string; status: string; start_date: string | null; end_date: string | null };
type Item = {
  id: string;
  group_buy_id: string;
  product_name: string;
  store_product_no: string | null;
  gonggu_price: number | null;
  margin_unit: number | null;
  manual_sold_qty: number | null;
};
type Order = {
  group_buy_id: string;
  store_product_no: string | null;
  option_info: string | null;
  quantity: number;
  order_status: string | null;
};

function won(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

export default async function DashboardPage() {
  const { company } = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: gbData }, { data: itemData }, { data: orderData }, { data: gbcData }, { data: contactData }, { data: opData }] =
    await Promise.all([
      supabase.from("group_buys").select("id, title, status, start_date, end_date").order("created_at", { ascending: false }),
      supabase
        .from("group_buy_items")
        .select("id, group_buy_id, product_name, store_product_no, gonggu_price, margin_unit, manual_sold_qty"),
      supabase.from("orders").select("group_buy_id, store_product_no, option_info, quantity, order_status"),
      supabase.from("group_buy_contacts").select("group_buy_id, role, contact_id"),
      supabase.from("contacts").select("id, name"),
      supabase.from("group_buy_item_prices").select("group_buy_item_id, option_info, gonggu_price, margin_unit"),
    ]);

  const groupBuys = (gbData ?? []) as GB[];
  const items = (itemData ?? []) as Item[];
  const orders = (orderData ?? []) as Order[];
  const gbContacts = (gbcData ?? []) as { group_buy_id: string; role: string; contact_id: string }[];
  const contactName = new Map(((contactData ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  // 공구 일정 집계용 엔트리
  const productsByGb = new Map<string, Set<string>>();
  for (const it of items) {
    if (!productsByGb.has(it.group_buy_id)) productsByGb.set(it.group_buy_id, new Set());
    productsByGb.get(it.group_buy_id)!.add(it.product_name);
  }
  const sellersByGb = new Map<string, string[]>();
  const vendorsByGb = new Map<string, string[]>();
  for (const gc of gbContacts) {
    const name = contactName.get(gc.contact_id);
    if (!name) continue;
    const map = gc.role === "셀러" ? sellersByGb : vendorsByGb;
    const arr = map.get(gc.group_buy_id) ?? [];
    arr.push(name);
    map.set(gc.group_buy_id, arr);
  }
  const scheduleEntries: ScheduleEntry[] = groupBuys.map((g) => ({
    id: g.id,
    title: g.title,
    date: g.start_date,
    status: g.status,
    products: [...(productsByGb.get(g.id) ?? [])],
    sellers: sellersByGb.get(g.id) ?? [],
    vendors: vendorsByGb.get(g.id) ?? [],
  }));

  // 공구별 매출 (판매수량 직접 입력분·옵션별 단가 예외 포함 — 공통 규칙)
  const totals = calcGroupBuyTotals(items as TotalsItem[], orders as TotalsOrder[], (opData ?? []) as TotalsOptionPrice[]);
  const revenueByGb = new Map([...totals].map(([k, v]) => [k, v.revenue]));
  const totalRevenue = [...totals.values()].reduce((s, v) => s + v.revenue, 0);

  // 제품별 매출: 상품 단위로 (직접 입력분·옵션별 단가 예외 포함)
  const revByItem = calcRevenueByItem(items as TotalsItem[], orders as TotalsOrder[], (opData ?? []) as TotalsOptionPrice[]);
  const revenueByProduct = new Map<string, number>();
  for (const it of items) {
    const amount = revByItem.get(it.id) ?? 0;
    if (!amount) continue;
    revenueByProduct.set(it.product_name, (revenueByProduct.get(it.product_name) ?? 0) + amount);
  }

  // 상태값에 ⑧ 같은 원문자 접두사가 있어도 매칭되도록 포함 비교
  const statusCount = (s: string) => groupBuys.filter((g) => (g.status ?? "").includes(s)).length;
  const productRank = [...revenueByProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const recentGbs = groupBuys.slice(0, 6);

  const stat = (label: string, value: string, sub?: string, href?: string) => {
    const inner = (
      <>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-bold text-slate-900">{value}</div>
        {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
        {href && <div className="mt-1 text-[11px] font-medium text-indigo-600">자세히 →</div>}
      </>
    );
    return href ? (
      <Link href={href} className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-400 hover:shadow">
        {inner}
      </Link>
    ) : (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{inner}</div>
    );
  };

  const statusPill = (s: string) => {
    const cls =
      s.includes("진행중") || s.includes("공구오픈") ? "bg-indigo-50 text-indigo-700"
      : s.includes("정산") || s.includes("종료") ? "bg-amber-50 text-amber-700"
      : s.includes("완료") ? "bg-slate-100 text-slate-600"
      : "bg-emerald-50 text-emerald-700";
    return <span className={"rounded-full px-2 py-0.5 text-xs font-semibold " + cls}>{s}</span>;
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      {/* 헤더: 제목 + 우측 내보내기 (넓은 화면 가로 공간 활용) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{company?.name} 대시보드</h1>
          <p className="mt-1 text-sm text-slate-500">공구·매출 현황을 한눈에 봅니다.</p>
        </div>
        <a
          href="/api/export"
          className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          title="제품·공구·주문·정산 전체를 엑셀 한 파일로"
        >
          전체 엑셀 내보내기
        </a>
      </div>

      {/* 요약 카드 (누르면 해당 목록으로) */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stat("누적 매출", won(totalRevenue), "살아있는 주문 기준", "/group-buys")}
        {stat("진행 중 공구", statusCount("진행중") + "건", "공구오픈 포함", "/group-buys?status=진행중")}
        {stat("정산 대기", statusCount("정산대기") + "건", undefined, "/group-buys?status=정산")}
        {stat("전체 공구", groupBuys.length + "건", undefined, "/group-buys?status=전체")}
      </div>

      {/* 공구 일정 집계 (제품·셀러·벤더별 · 주/월/연) */}
      <div className="mt-8">
        <ScheduleSummary entries={scheduleEntries} />
      </div>

      {/* 하단 3열: 제품별 매출 · 최근 공구 · 바로가기 (태블릿 2열, 넓은 화면 3열) */}
      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                  <li key={name} className="border-b border-slate-100 last:border-0">
                    <Link href={`/group-buys?product=${encodeURIComponent(name)}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-50 text-xs font-bold text-indigo-700">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate text-sm text-slate-800">{name}</span>
                      <span className="text-sm font-semibold tabular-nums">{won(rev)}</span>
                    </Link>
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

        {/* 바로가기 (세로 스택 — 옆 두 목록과 높이 균형) */}
        <div>
          <h2 className="text-sm font-bold text-slate-900">바로가기</h2>
          <div className="mt-3 space-y-3">
            {[
              { href: "/group-buys", label: "공구 관리 →", desc: "공구·배정·판매현황·정산" },
              { href: "/products", label: "제품 관리 →", desc: "제품·하위 옵션" },
              { href: "/inventory", label: "재고 관리 →", desc: "전체 주문 업로드·자동 차감" },
            ].map((c) => (
              <a key={c.href} href={c.href} className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-400 hover:shadow">
                <div className="text-sm font-semibold text-slate-900">{c.label}</div>
                <p className="mt-1 text-xs text-slate-500">{c.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
