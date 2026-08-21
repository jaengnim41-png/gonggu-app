import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  calcGroupBuyTotals,
  type TotalsItem,
  type TotalsOrder,
  type TotalsOptionPrice,
} from "@/lib/group-buys/totals";
import { CopyLink } from "@/components/copy-link";
import { ConfirmButton } from "@/components/confirm-button";
import { SampleForm } from "@/components/sample-form";
import { createSample } from "../../samples/actions";
import {
  updateContact,
  deleteContact,
  createGuestLink,
  toggleGuestLink,
  regenerateGuestLink,
  setGuestStatus,
  linkContacts,
  unlinkContacts,
  addVendorManager,
  deleteVendorManager,
} from "../actions";
import { openThread } from "../../messages/actions";

type Contact = {
  id: string;
  kind: string;
  name: string;
  instagram: string | null;
  followers: number | null;
  contact_info: string | null;
  phone: string | null;
  address: string | null;
  memo: string | null;
};
type GB = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  seller_contact_id: string | null;
  vendor_contact_id: string | null;
};
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
function num(n: number | null) {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}
/** 공구가 속한 달(YYYY-MM). 종료일 우선, 없으면 시작일 */
function monthOf(g: GB): string | null {
  const d = g.end_date ?? g.start_date;
  return d ? d.slice(0, 7) : null;
}
function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return `${y.slice(2)}.${m}`;
}

const STATUS_CLS: Record<string, string> = {
  진행중: "bg-emerald-50 text-emerald-700",
  예정: "bg-sky-50 text-sky-700",
  정산대기: "bg-amber-50 text-amber-700",
  종료: "bg-slate-100 text-slate-600",
  완료: "bg-slate-100 text-slate-600",
};

export default async function ContactDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const { error, saved } = await searchParams;
  const supabase = await createClient();

  const [
    { data: cData },
    { data: allContacts },
    { data: gbData },
    { data: itemData },
    { data: orderData },
    { data: linkData },
    { data: guestData },
    { data: sampleData },
    { data: prodData },
    { data: optData },
    { data: clinkData },
    { data: managerData },
  ] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, kind, name, instagram, followers, contact_info, phone, address, memo")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("contacts").select("id, kind, name").order("sort_order"),
      supabase
        .from("group_buys")
        .select("id, title, status, start_date, end_date, seller_contact_id, vendor_contact_id"),
      supabase
        .from("group_buy_items")
        .select("id, group_buy_id, product_name, store_product_no, gonggu_price, margin_unit, manual_sold_qty"),
      supabase.from("orders").select("group_buy_id, store_product_no, option_info, quantity, order_status"),
      supabase.from("guest_links").select("token, active").eq("contact_id", id).maybeSingle(),
      supabase
        .from("guests")
        .select("id, display_name, status, requested_at, approved_at, last_seen_at, user_id")
        .eq("contact_id", id)
        .order("requested_at", { ascending: false }),
      supabase
        .from("sample_shipments")
        .select("id, product_id, product_option_id, item_text, quantity, sent_at, courier, tracking_no, returned, memo")
        .eq("contact_id", id)
        .order("sent_at", { ascending: false }),
      supabase.from("products").select("id, name"),
      supabase.from("product_options").select("id, name"),
      supabase.from("contact_links").select("seller_id, vendor_id"),
      supabase.from("vendor_managers").select("id, name, phone, memo").eq("vendor_id", id).order("sort_order"),
    ]);

  const contact = cData as Contact | null;
  if (!contact) notFound();

  const isVendor = contact.kind === "벤더";
  const listPath = isVendor ? "/vendors" : "/sellers";
  const others = (allContacts ?? []) as { id: string; kind: string; name: string }[];
  const vendors = others.filter((c) => c.kind === "벤더" && c.id !== contact.id);
  const allSellers = others.filter((c) => c.kind === "셀러");
  const nameById = new Map(others.map((c) => [c.id, c.name]));

  // 이 거래처의 연결(양방향): 셀러면 연결된 벤더, 벤더면 연결된 셀러
  const links = (clinkData ?? []) as { seller_id: string; vendor_id: string }[];
  const myLinks = isVendor
    ? links.filter((l) => l.vendor_id === contact.id).map((l) => ({ otherId: l.seller_id, name: nameById.get(l.seller_id) ?? "?" }))
    : links.filter((l) => l.seller_id === contact.id).map((l) => ({ otherId: l.vendor_id, name: nameById.get(l.vendor_id) ?? "?" }));
  const linkedIds = new Set(myLinks.map((l) => l.otherId));
  const linkableOthers = isVendor
    ? allSellers.filter((s) => !linkedIds.has(s.id))
    : vendors.filter((v) => !linkedIds.has(v.id));
  const managers = (managerData ?? []) as { id: string; name: string; phone: string | null; memo: string | null }[];

  // 공구 연결(레거시 단일 필드 + 다중 연결 gb_contacts 모두)과 정산·옵션단가
  const [{ data: gbcData }, { data: settleData }, { data: opData }] = await Promise.all([
    supabase.from("group_buy_contacts").select("group_buy_id, role, contact_id"),
    supabase.from("settlements").select("group_buy_id, fee_rate, status"),
    supabase.from("group_buy_item_prices").select("group_buy_item_id, option_info, gonggu_price, margin_unit"),
  ]);
  const gbContacts = (gbcData ?? []) as { group_buy_id: string; role: string; contact_id: string }[];
  const myGbIds = new Set(gbContacts.filter((x) => x.contact_id === contact.id).map((x) => x.group_buy_id));

  // 이 거래처가 연결된 공구 (레거시 필드 또는 다중 연결)
  const mine = ((gbData ?? []) as GB[]).filter(
    (g) =>
      myGbIds.has(g.id) ||
      (isVendor ? g.vendor_contact_id === contact.id : g.seller_contact_id === contact.id)
  );
  const mineIds = new Set(mine.map((g) => g.id));

  // 공구별 매출·마진·수량 (공통 규칙: 직접 입력·옵션별 단가 포함)
  const totalsMap = calcGroupBuyTotals(
    (itemData ?? []) as TotalsItem[],
    (orderData ?? []) as TotalsOrder[],
    (opData ?? []) as TotalsOptionPrice[]
  );
  const revByGb = new Map<string, number>();
  const marginByGb = new Map<string, number>();
  const qtyByGb = new Map<string, number>();
  for (const [gbId, t] of totalsMap) {
    if (!mineIds.has(gbId)) continue;
    revByGb.set(gbId, t.revenue);
    marginByGb.set(gbId, t.margin);
    qtyByGb.set(gbId, t.qty);
  }

  // 공구별 제품명·상대(벤더면 셀러들, 셀러면 벤더들)
  const productsByGb = new Map<string, Set<string>>();
  for (const it of (itemData ?? []) as Item[]) {
    if (!mineIds.has(it.group_buy_id)) continue;
    if (!productsByGb.has(it.group_buy_id)) productsByGb.set(it.group_buy_id, new Set());
    productsByGb.get(it.group_buy_id)!.add(it.product_name);
  }
  const counterRole = isVendor ? "셀러" : "벤더";
  const counterByGb = new Map<string, Set<string>>();
  for (const gc of gbContacts) {
    if (!mineIds.has(gc.group_buy_id) || gc.role !== counterRole) continue;
    const n = nameById.get(gc.contact_id);
    if (!n) continue;
    if (!counterByGb.has(gc.group_buy_id)) counterByGb.set(gc.group_buy_id, new Set());
    counterByGb.get(gc.group_buy_id)!.add(n);
  }
  for (const g of mine) {
    const legacyId = isVendor ? g.seller_contact_id : g.vendor_contact_id;
    const n = legacyId ? nameById.get(legacyId) : null;
    if (!n) continue;
    if (!counterByGb.has(g.id)) counterByGb.set(g.id, new Set());
    counterByGb.get(g.id)!.add(n);
  }

  // 공구별 정산액 = 마진 − 매출 × 수수료율(%)  (정산 정보가 있는 공구만)
  const settles = (settleData ?? []) as { group_buy_id: string; fee_rate: number; status: string }[];
  const settleByGb = new Map<string, { amount: number; status: string }>();
  for (const st of settles) {
    if (!mineIds.has(st.group_buy_id)) continue;
    const rev = revByGb.get(st.group_buy_id) ?? 0;
    const margin = marginByGb.get(st.group_buy_id) ?? 0;
    settleByGb.set(st.group_buy_id, {
      amount: margin - rev * ((st.fee_rate ?? 0) / 100),
      status: st.status,
    });
  }
  const totalSettle = [...settleByGb.values()].reduce((s, v) => s + v.amount, 0);

  const totalRev = mine.reduce((s, g) => s + (revByGb.get(g.id) ?? 0), 0);
  const totalMargin = mine.reduce((s, g) => s + (marginByGb.get(g.id) ?? 0), 0);
  const totalQty = mine.reduce((s, g) => s + (qtyByGb.get(g.id) ?? 0), 0);
  const liveCount = mine.filter((g) => g.status === "진행중").length;

  // 월별 매출 추이 (데이터가 있는 달만, 오래된 순)
  const byMonth = new Map<string, number>();
  for (const g of mine) {
    const ym = monthOf(g);
    if (!ym) continue;
    byMonth.set(ym, (byMonth.get(ym) ?? 0) + (revByGb.get(g.id) ?? 0));
  }
  const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-12);
  const maxMonth = Math.max(1, ...months.map(([, v]) => v));

  // 공구 이력: 최근 순
  const history = [...mine].sort((a, b) => {
    const da = a.end_date ?? a.start_date ?? "";
    const db = b.end_date ?? b.start_date ?? "";
    return db.localeCompare(da);
  });

  // 초대 링크 · 게스트
  const link = linkData as { token: string; active: boolean } | null;
  const guests = (guestData ?? []) as {
    id: string;
    display_name: string;
    status: string;
    requested_at: string;
    approved_at: string | null;
    last_seen_at: string | null;
    user_id: string | null;
  }[];
  const pending = guests.filter((g) => g.status === "대기");
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const guestUrl = link ? `${origin}/g/${link.token}` : "";

  // 샘플 이력
  const samples = (sampleData ?? []) as {
    id: string;
    product_id: string | null;
    product_option_id: string | null;
    item_text: string | null;
    quantity: number;
    sent_at: string;
    courier: string | null;
    tracking_no: string | null;
    returned: boolean;
    memo: string | null;
  }[];
  const prodName = new Map(((prodData ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const optName = new Map(((optData ?? []) as { id: string; name: string }[]).map((o) => [o.id, o.name]));
  const sampleItems: { value: string; label: string }[] = [];
  for (const [pid, pname] of prodName) sampleItems.push({ value: `p:${pid}`, label: pname });
  const sampleLabel = (s: (typeof samples)[number]) => {
    if (s.product_option_id) {
      return [s.product_id ? prodName.get(s.product_id) : null, optName.get(s.product_option_id)]
        .filter(Boolean)
        .join(" · ") || s.item_text || "—";
    }
    if (s.product_id) return prodName.get(s.product_id) ?? s.item_text ?? "—";
    return s.item_text ?? "—";
  };

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <Link href={listPath} className="text-sm text-slate-500 hover:text-indigo-600">
        ← {isVendor ? "벤더" : "셀러"} 목록
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">{contact.name}</h1>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            isVendor ? "bg-violet-50 text-violet-700" : "bg-indigo-50 text-indigo-700"
          }`}
        >
          {contact.kind}
        </span>
        {contact.instagram && (
          <span className="font-mono text-xs text-slate-500">{contact.instagram}</span>
        )}
        {contact.followers != null && (
          <span className="text-xs text-slate-500">팔로워 {num(contact.followers)}</span>
        )}
      </div>
      {(contact.phone || contact.address) && (
        <p className="mt-1 text-sm text-slate-500">
          {contact.phone && <span>📞 {contact.phone}</span>}
          {contact.phone && contact.address && <span className="mx-1.5 text-slate-300">·</span>}
          {contact.address && <span>📍 {contact.address}</span>}
        </p>
      )}
      {contact.contact_info && (
        <p className="mt-1 text-sm text-slate-500">{contact.contact_info}</p>
      )}
      {contact.memo && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          📝 {contact.memo}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <form action={openThread}>
          <input type="hidden" name="kind" value="거래처" />
          <input type="hidden" name="contact_id" value={contact.id} />
          <button
            type="submit"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ✉ 메시지
          </button>
        </form>
        <a
          href="#guest"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          🔗 초대 링크{pending.length > 0 ? ` · 승인 대기 ${pending.length}` : ""}
        </a>
      </div>

      {saved && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
          저장했습니다.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "input" ? "이름을 입력해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      {/* 요약 */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "누적 매출", value: won(totalRev), sub: "살아있는 주문 기준" },
          { label: "누적 마진", value: won(totalMargin), sub: `판매 ${num(totalQty)}개` },
          { label: "공구 횟수", value: `${mine.length}건`, sub: `진행 중 ${liveCount}` },
          {
            label: "누적 정산액",
            value: won(totalSettle),
            sub: settleByGb.size ? `정산 ${settleByGb.size}건 · 마진 − 수수료` : "정산 기록 없음",
          },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{c.value}</p>
            <p className="mt-1 text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* 월별 매출 추이 */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">월별 매출 추이</h2>
        {months.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">
            아직 연결된 공구가 없습니다. 공구 상세에서 이 {contact.kind}를 연결하세요.
          </p>
        ) : (
          <div className="mt-5 flex items-end gap-2 overflow-x-auto">
            {months.map(([ym, v]) => (
              <div key={ym} className="flex min-w-14 flex-1 flex-col items-center gap-1">
                <span className="text-[11px] tabular-nums text-slate-500">
                  {v >= 10000 ? `${Math.round(v / 10000)}만` : v > 0 ? won(v) : ""}
                </span>
                <div
                  className="w-full rounded-t-md bg-indigo-500"
                  style={{ height: `${Math.max(4, (v / maxMonth) * 120)}px` }}
                  title={won(v)}
                />
                <span className="text-[11px] text-slate-500">{monthLabel(ym)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 공구 이력 */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="px-5 pt-5 text-sm font-semibold text-slate-900">공구 이력 ({history.length})</h2>
        {history.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">연결된 공구가 없습니다.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">공구</th>
                  <th className="px-4 py-3">제품</th>
                  <th className="px-4 py-3">{isVendor ? "셀러" : "벤더"}</th>
                  <th className="px-4 py-3">기간</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">판매수량</th>
                  <th className="px-4 py-3 text-right">매출</th>
                  <th className="px-4 py-3 text-right">마진</th>
                  <th className="px-4 py-3 text-right">정산액</th>
                </tr>
              </thead>
              <tbody>
                {history.map((g) => {
                  const st = settleByGb.get(g.id);
                  return (
                    <tr key={g.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/group-buys/${g.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                          {g.title}
                        </Link>
                      </td>
                      <td className="max-w-40 truncate px-4 py-3 text-xs text-slate-600" title={[...(productsByGb.get(g.id) ?? [])].join(", ")}>
                        {[...(productsByGb.get(g.id) ?? [])].join(", ") || "—"}
                      </td>
                      <td className="max-w-32 truncate px-4 py-3 text-xs text-slate-600" title={[...(counterByGb.get(g.id) ?? [])].join(", ")}>
                        {[...(counterByGb.get(g.id) ?? [])].join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {g.start_date ?? "—"} ~ {g.end_date ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[g.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {g.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{num(qtyByGb.get(g.id) ?? 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{won(revByGb.get(g.id) ?? 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-600">{won(marginByGb.get(g.id) ?? 0)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {st ? (
                          <span title={`정산 상태: ${st.status}`} className="font-medium text-slate-900">{won(st.amount)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 샘플 이력 */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">샘플 발송 ({samples.length})</h2>
          <Link href="/samples" className="text-xs text-slate-500 underline decoration-slate-300 hover:text-indigo-600">
            전체 보기 →
          </Link>
        </div>
        {samples.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            이 {contact.kind}에게 보낸 샘플 기록이 없습니다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">발송일</th>
                  <th className="px-3 py-2">품목</th>
                  <th className="px-3 py-2 text-right">수량</th>
                  <th className="px-3 py-2">메모</th>
                  <th className="px-3 py-2 text-center">회수</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{s.sent_at}</td>
                    <td className="px-3 py-2 text-slate-700">{sampleLabel(s)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.quantity}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{s.memo ?? "—"}</td>
                    <td className="px-3 py-2 text-center text-xs">
                      {s.returned ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">회수됨</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="mt-4 border-t border-slate-100 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
            ＋ 이 {contact.kind}에게 샘플 보낸 기록 추가
          </summary>
          <SampleForm
            action={createSample}
            contacts={[]}
            items={sampleItems}
            back={`/contacts/${contact.id}`}
            fixedContactId={contact.id}
          />
        </details>
      </div>

      {/* 초대 링크 · 승인 관리 */}
      <div id="guest" className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">초대 링크 (가입 없이 열람)</h2>
        <p className="mt-1 text-xs text-slate-500">
          이 링크로 들어온 사람은 <b>승인해야만</b> 볼 수 있습니다. 승인하면 이 {contact.kind}와 진행하는
          공구의 <b>일정 · 매일 판매현황 · 전달된 정산서 · 메시지</b>만 열람합니다. 링크를 알아도 승인 전에는
          아무것도 보이지 않습니다.
        </p>

        {!link ? (
          <form action={createGuestLink} className="mt-4">
            <input type="hidden" name="contact_id" value={contact.id} />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              초대 링크 만들기
            </button>
          </form>
        ) : (
          <>
            <div className="mt-4">
              <CopyLink url={guestUrl} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`text-xs font-medium ${link.active ? "text-emerald-600" : "text-slate-400"}`}>
                {link.active ? "● 활성" : "○ 비활성"}
              </span>
              <form action={toggleGuestLink}>
                <input type="hidden" name="contact_id" value={contact.id} />
                <input type="hidden" name="active" value={link.active ? "false" : "true"} />
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {link.active ? "링크 비활성화" : "링크 활성화"}
                </button>
              </form>
              <form action={regenerateGuestLink}>
                <input type="hidden" name="contact_id" value={contact.id} />
                <button
                  type="submit"
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600"
                >
                  재발급(기존 링크 무효)
                </button>
              </form>
            </div>
          </>
        )}

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
          접속 요청 ({guests.length})
        </h3>
        {guests.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            아직 이 링크로 들어온 사람이 없습니다.
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2">상태</th>
                  <th className="px-3 py-2">요청</th>
                  <th className="px-3 py-2">최근 접속</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => (
                  <tr key={g.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {g.display_name}
                      {g.user_id && <span className="ml-1.5 text-[10px] text-indigo-600">가입함</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          g.status === "승인"
                            ? "bg-emerald-50 text-emerald-700"
                            : g.status === "차단"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {g.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {g.requested_at?.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-500">
                      {g.last_seen_at ? g.last_seen_at.slice(0, 16).replace("T", " ") : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        {g.status !== "승인" && (
                          <form action={setGuestStatus}>
                            <input type="hidden" name="guest_id" value={g.id} />
                            <input type="hidden" name="status" value="승인" />
                            <input type="hidden" name="back" value={`/contacts/${contact.id}`} />
                            <button className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                              승인
                            </button>
                          </form>
                        )}
                        {g.status !== "차단" && (
                          <form action={setGuestStatus}>
                            <input type="hidden" name="guest_id" value={g.id} />
                            <input type="hidden" name="status" value="차단" />
                            <input type="hidden" name="back" value={`/contacts/${contact.id}`} />
                            <button className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600">
                              차단
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 연결 관리 (양방향: 셀러↔벤더 어디서든) */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          연결 {isVendor ? "셀러" : "벤더"} ({myLinks.length})
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          여기서 연결하면 {isVendor ? "셀러" : "벤더"} 쪽에도 자동으로 연결됩니다.
        </p>
        {myLinks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {myLinks.map((l) => (
              <span key={l.otherId} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-700">
                <Link href={`/contacts/${l.otherId}`} className="hover:text-indigo-600">{l.name}</Link>
                <form action={unlinkContacts} className="inline">
                  <input type="hidden" name="seller_id" value={isVendor ? l.otherId : contact.id} />
                  <input type="hidden" name="vendor_id" value={isVendor ? contact.id : l.otherId} />
                  <input type="hidden" name="back" value={`/contacts/${contact.id}`} />
                  <button className="text-slate-400 hover:text-rose-600" title="연결 해제">✕</button>
                </form>
              </span>
            ))}
          </div>
        )}
        {linkableOthers.length > 0 && (
          <form action={linkContacts} className="mt-3 flex flex-wrap items-center gap-2">
            {/* 고정된 쪽만 hidden으로 — select와 이름이 겹치지 않도록 */}
            <input type="hidden" name={isVendor ? "vendor_id" : "seller_id"} value={contact.id} />
            <input type="hidden" name="back" value={`/contacts/${contact.id}`} />
            <select name={isVendor ? "seller_id" : "vendor_id"} defaultValue="" required className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
              <option value="" disabled>{isVendor ? "셀러 선택" : "벤더 선택"}…</option>
              {linkableOthers.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">＋ 연결</button>
          </form>
        )}
      </div>

      {/* 벤더 담당자 */}
      {isVendor && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">담당자 ({managers.length})</h2>
          {managers.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {managers.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 font-medium text-slate-800">{m.name}</td>
                      <td className="py-2 pr-3 text-slate-500">{m.phone ?? "—"}</td>
                      <td className="py-2 pr-3 text-xs text-slate-400">{m.memo ?? ""}</td>
                      <td className="py-2 text-right">
                        <form action={deleteVendorManager}>
                          <input type="hidden" name="id" value={m.id} />
                          <input type="hidden" name="back" value={`/contacts/${contact.id}`} />
                          <ConfirmButton message={`담당자 '${m.name}'를 삭제할까요?`} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600">삭제</ConfirmButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form action={addVendorManager} className="mt-3 grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="vendor_id" value={contact.id} />
            <input type="hidden" name="back" value={`/contacts/${contact.id}`} />
            <input name="name" required placeholder="담당자 이름 *" className={inputCls} />
            <input name="phone" placeholder="연락처" className={inputCls} />
            <input name="memo" placeholder="역할·메모" className={inputCls} />
            <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700">담당자 추가</button>
          </form>
        </div>
      )}

      {/* 정보 수정 */}
      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">정보 수정</summary>
        <form action={updateContact} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={contact.id} />
          <input type="hidden" name="kind" value={contact.kind} />
          <label className="text-sm font-medium text-slate-700">
            이름 *
            <input name="name" required defaultValue={contact.name} className={inputCls} />
          </label>
          {!isVendor && (
            <>
              <label className="text-sm font-medium text-slate-700">
                인스타
                <input name="instagram" defaultValue={contact.instagram ?? ""} className={inputCls} />
              </label>
              <label className="text-sm font-medium text-slate-700">
                팔로워 수
                <input name="followers" inputMode="numeric" defaultValue={contact.followers ?? ""} className={inputCls} />
              </label>
            </>
          )}
          <label className="text-sm font-medium text-slate-700">
            연락처(택배)
            <input name="phone" defaultValue={contact.phone ?? ""} placeholder="010-0000-0000" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            주소(택배 발송)
            <input name="address" defaultValue={contact.address ?? ""} className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            메모
            <input name="memo" defaultValue={contact.memo ?? ""} className={inputCls} />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              저장
            </button>
          </div>
        </form>
        <form action={deleteContact} className="mt-4 border-t border-slate-100 pt-4">
          <input type="hidden" name="id" value={contact.id} />
          <input type="hidden" name="kind" value={contact.kind} />
          <ConfirmButton
            message={`'${contact.name}' ${contact.kind}를 삭제할까요? 연결·실적·초대 기록도 사라집니다.`}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600"
          >
            이 {contact.kind} 삭제
          </ConfirmButton>
        </form>
      </details>
    </div>
  );
}
