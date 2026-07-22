import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/orders/parse";
import { updateContact, deleteContact } from "../actions";

type Contact = {
  id: string;
  kind: string;
  name: string;
  instagram: string | null;
  followers: number | null;
  contact_info: string | null;
  linked_vendor_id: string | null;
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
type Item = { store_product_no: string | null; gonggu_price: number | null; margin_unit: number | null };
type Order = { group_buy_id: string; store_product_no: string | null; quantity: number; order_status: string | null };

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

  const [{ data: cData }, { data: allContacts }, { data: gbData }, { data: itemData }, { data: orderData }] =
    await Promise.all([
      supabase
        .from("contacts")
        .select("id, kind, name, instagram, followers, contact_info, linked_vendor_id, memo")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("contacts").select("id, kind, name, linked_vendor_id").order("name"),
      supabase
        .from("group_buys")
        .select("id, title, status, start_date, end_date, seller_contact_id, vendor_contact_id"),
      supabase.from("group_buy_items").select("store_product_no, gonggu_price, margin_unit"),
      supabase.from("orders").select("group_buy_id, store_product_no, quantity, order_status"),
    ]);

  const contact = cData as Contact | null;
  if (!contact) notFound();

  const isVendor = contact.kind === "벤더";
  const listPath = isVendor ? "/vendors" : "/sellers";
  const others = (allContacts ?? []) as { id: string; kind: string; name: string; linked_vendor_id: string | null }[];
  const vendors = others.filter((c) => c.kind === "벤더" && c.id !== contact.id);
  const myVendor = vendors.find((v) => v.id === contact.linked_vendor_id) ?? null;
  const mySellers = others.filter((c) => c.kind === "셀러" && c.linked_vendor_id === contact.id);

  // 이 거래처가 연결된 공구
  const mine = ((gbData ?? []) as GB[]).filter((g) =>
    isVendor ? g.vendor_contact_id === contact.id : g.seller_contact_id === contact.id
  );
  const mineIds = new Set(mine.map((g) => g.id));

  // 공구별 매출·마진·수량
  const priceByPno = new Map<string, number>();
  const marginByPno = new Map<string, number>();
  for (const it of (itemData ?? []) as Item[]) {
    if (!it.store_product_no) continue;
    priceByPno.set(it.store_product_no, it.gonggu_price ?? 0);
    marginByPno.set(it.store_product_no, it.margin_unit ?? 0);
  }
  const revByGb = new Map<string, number>();
  const marginByGb = new Map<string, number>();
  const qtyByGb = new Map<string, number>();
  for (const o of (orderData ?? []) as Order[]) {
    if (!mineIds.has(o.group_buy_id)) continue;
    if (!isLive(o.order_status)) continue;
    const pno = String(o.store_product_no ?? "");
    const q = o.quantity ?? 0;
    revByGb.set(o.group_buy_id, (revByGb.get(o.group_buy_id) ?? 0) + q * (priceByPno.get(pno) ?? 0));
    marginByGb.set(o.group_buy_id, (marginByGb.get(o.group_buy_id) ?? 0) + q * (marginByPno.get(pno) ?? 0));
    qtyByGb.set(o.group_buy_id, (qtyByGb.get(o.group_buy_id) ?? 0) + q);
  }

  const totalRev = mine.reduce((s, g) => s + (revByGb.get(g.id) ?? 0), 0);
  const totalMargin = mine.reduce((s, g) => s + (marginByGb.get(g.id) ?? 0), 0);
  const totalQty = mine.reduce((s, g) => s + (qtyByGb.get(g.id) ?? 0), 0);
  const liveCount = mine.filter((g) => g.status === "진행중").length;
  const avgRev = mine.length ? totalRev / mine.length : 0;

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

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
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
        {!isVendor && myVendor && (
          <Link
            href={`/contacts/${myVendor.id}`}
            className="text-xs text-slate-500 underline decoration-slate-300 hover:text-indigo-600"
          >
            소속 벤더: {myVendor.name}
          </Link>
        )}
      </div>
      {contact.contact_info && (
        <p className="mt-1 text-sm text-slate-500">{contact.contact_info}</p>
      )}

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
          { label: "공구", value: `${mine.length}건`, sub: `진행 중 ${liveCount}` },
          { label: "공구당 평균 매출", value: won(avgRev), sub: mine.length ? `${mine.length}건 평균` : "—" },
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
                  <th className="px-4 py-3">기간</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3 text-right">판매수량</th>
                  <th className="px-4 py-3 text-right">매출</th>
                  <th className="px-4 py-3 text-right">마진</th>
                </tr>
              </thead>
              <tbody>
                {history.map((g) => (
                  <tr key={g.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/group-buys/${g.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {g.title}
                      </Link>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 벤더면: 소속 셀러 */}
      {isVendor && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">소속 셀러 ({mySellers.length})</h2>
          {mySellers.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              연결된 셀러가 없습니다. 셀러 등록·수정에서 이 벤더를 선택하세요.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {mySellers.map((s) => (
                <Link
                  key={s.id}
                  href={`/contacts/${s.id}`}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-700"
                >
                  {s.name}
                </Link>
              ))}
            </div>
          )}
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
              <label className="text-sm font-medium text-slate-700">
                연결 벤더
                <select name="linked_vendor_id" defaultValue={contact.linked_vendor_id ?? ""} className={inputCls}>
                  <option value="">단독 (벤더 없음)</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="text-sm font-medium text-slate-700">
            연락처·담당
            <input name="contact_info" defaultValue={contact.contact_info ?? ""} className={inputCls} />
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
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600"
          >
            이 {contact.kind} 삭제
          </button>
        </form>
      </details>
    </div>
  );
}
