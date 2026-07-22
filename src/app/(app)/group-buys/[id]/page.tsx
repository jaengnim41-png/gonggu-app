import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isLive } from "@/lib/orders/parse";
import {
  addItem,
  deleteItem,
  uploadOrders,
  startSettlement,
  saveFeeRate,
  setSettlementStatus,
  createShareLink,
  toggleShareLink,
  setGroupBuyContacts,
} from "../actions";
import { CopyLink } from "@/components/copy-link";

type GroupBuy = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  settle_days: number;
  memo: string | null;
  seller_contact_id: string | null;
  vendor_contact_id: string | null;
};

type Contact = { id: string; kind: string; name: string };

type Item = {
  id: string;
  product_name: string;
  store_product_no: string | null;
  allocated_qty: number | null;
  gonggu_price: number | null;
  margin_unit: number | null;
};

type Settlement = {
  fee_rate: number;
  status: string;
};

type Order = {
  option_info: string | null;
  store_product_no: string | null;
  quantity: number;
  order_status: string | null;
};

type ProductOpt = { id: string; name: string };

function won(n: number | null) {
  return n == null ? "—" : "₩" + n.toLocaleString("ko-KR");
}
function qty(n: number | null) {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}

export default async function GroupBuyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; uok?: string; uerror?: string }>;
}) {
  const { id } = await params;
  const { error, uok, uerror } = await searchParams;
  const supabase = await createClient();

  const { data: gb } = await supabase
    .from("group_buys")
    .select("*")
    .eq("id", id)
    .maybeSingle<GroupBuy>();
  if (!gb) notFound();

  const { data: itemData } = await supabase
    .from("group_buy_items")
    .select("id, product_name, store_product_no, allocated_qty, gonggu_price, margin_unit")
    .eq("group_buy_id", id)
    .order("created_at", { ascending: true });
  const items = (itemData ?? []) as Item[];

  const { data: settlement } = await supabase
    .from("settlements")
    .select("fee_rate, status")
    .eq("group_buy_id", id)
    .maybeSingle<Settlement>();

  const { data: contactData } = await supabase
    .from("contacts")
    .select("id, kind, name")
    .order("name", { ascending: true });
  const contacts = (contactData ?? []) as Contact[];
  const sellerContacts = contacts.filter((c) => c.kind === "셀러");
  const vendorContacts = contacts.filter((c) => c.kind === "벤더");

  const { data: shareLink } = await supabase
    .from("share_links")
    .select("token, active")
    .eq("group_buy_id", id)
    .maybeSingle<{ token: string; active: boolean }>();

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const shareUrl = shareLink ? `${proto}://${host}/share/${shareLink.token}` : "";

  const { data: orderData } = await supabase
    .from("orders")
    .select("option_info, store_product_no, quantity, order_status")
    .eq("group_buy_id", id);
  const orders = (orderData ?? []) as Order[];

  const { data: prodData } = await supabase
    .from("products")
    .select("id, name")
    .order("name", { ascending: true });
  const products = (prodData ?? []) as ProductOpt[];

  // 상품번호 → 공구가
  const priceByPno = new Map<string, number>();
  for (const it of items) {
    if (it.store_product_no)
      priceByPno.set(it.store_product_no, it.gonggu_price ?? 0);
  }

  // 상품번호 → 판매수량(살아있는 주문만)
  const soldByPno = new Map<string, number>();
  for (const o of orders) {
    if (!isLive(o.order_status)) continue;
    const key = String(o.store_product_no ?? "");
    soldByPno.set(key, (soldByPno.get(key) ?? 0) + (o.quantity ?? 0));
  }

  // 판매현황: 옵션정보별 수량·금액
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

  // 정산 계산: 매출·마진·수수료·최종
  let marginTotal = 0;
  for (const it of items) {
    const sold = soldByPno.get(String(it.store_product_no ?? "")) ?? 0;
    marginTotal += sold * (it.margin_unit ?? 0);
  }
  const feeRate = settlement?.fee_rate ?? 3.495;
  const feeAmount = Math.round((totalAmount * feeRate) / 100);
  const finalAmount = marginTotal - feeAmount;
  const hasSales = totalQty > 0;

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const uerrorMsg: Record<string, string> = {
    file: "엑셀 파일을 선택해 주세요.",
    noitems: "먼저 공구 상품(상품번호)을 추가해 주세요.",
    nomatch: "이 공구의 상품번호와 일치하는 주문이 없습니다. 상품번호를 확인해 주세요.",
    save: "저장에 실패했어요.",
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link href="/group-buys" className="text-sm text-slate-500 hover:underline">
        ← 공구 목록
      </Link>

      {/* 공구 정보 */}
      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-bold text-slate-900">{gb.title}</h1>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
            {gb.status}
          </span>
        </div>
        <div className="mt-1 text-sm text-slate-500">
          기간 {gb.start_date ?? "—"} ~ {gb.end_date ?? "—"} · 정산 종료 후 {gb.settle_days}일
        </div>
        {gb.memo && <p className="mt-2 text-xs text-slate-500">메모: {gb.memo}</p>}

        {/* 진행 셀러/벤더 연결 */}
        <form action={setGroupBuyContacts} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
          <input type="hidden" name="group_buy_id" value={gb.id} />
          <label className="text-xs font-medium text-slate-600">
            진행 셀러
            <select
              name="seller_contact_id"
              defaultValue={gb.seller_contact_id ?? ""}
              className="mt-1 block rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              <option value="">— 없음</option>
              {sellerContacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            벤더
            <select
              name="vendor_contact_id"
              defaultValue={gb.vendor_contact_id ?? ""}
              className="mt-1 block rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              <option value="">— 없음</option>
              {vendorContacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
            연결 저장
          </button>
          <span className="text-[11px] text-slate-400">셀러/벤더는 왼쪽 메뉴에서 먼저 등록하세요.</span>
        </form>
        {(gb.seller_contact_id || gb.vendor_contact_id) && (
          <p className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {gb.seller_contact_id && (
              <Link href={`/contacts/${gb.seller_contact_id}`} className="underline decoration-slate-300 hover:text-indigo-600">
                셀러 실적 보기 →
              </Link>
            )}
            {gb.vendor_contact_id && (
              <Link href={`/contacts/${gb.vendor_contact_id}`} className="underline decoration-slate-300 hover:text-indigo-600">
                벤더 실적 보기 →
              </Link>
            )}
          </p>
        )}
      </div>

      {/* 비로그인 공유 링크 */}
      <div id="share" className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">공유 링크 (비로그인 열람)</h2>
            <p className="mt-1 text-xs text-slate-500">
              가입 없이 이 공구의 판매현황을 볼 수 있는 링크입니다. (정산 금액은 제외)
            </p>
          </div>
          {!shareLink && (
            <form action={createShareLink}>
              <input type="hidden" name="group_buy_id" value={gb.id} />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                링크 만들기
              </button>
            </form>
          )}
        </div>

        {shareLink && shareLink.active && (
          <div className="mt-3">
            <CopyLink url={shareUrl} />
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="font-medium text-emerald-600">● 활성</span>
              <form action={toggleShareLink}>
                <input type="hidden" name="group_buy_id" value={gb.id} />
                <input type="hidden" name="active" value="false" />
                <button type="submit" className="text-slate-500 hover:underline">
                  링크 비활성화
                </button>
              </form>
            </div>
          </div>
        )}
        {shareLink && !shareLink.active && (
          <div className="mt-3 flex items-center gap-3 text-xs">
            <span className="text-slate-400">링크가 비활성화되어 있습니다.</span>
            <form action={toggleShareLink}>
              <input type="hidden" name="group_buy_id" value={gb.id} />
              <input type="hidden" name="active" value="true" />
              <button type="submit" className="font-medium text-indigo-600 hover:underline">
                다시 활성화
              </button>
            </form>
          </div>
        )}
      </div>

      {/* 주문 엑셀 업로드 */}
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">주문 엑셀 업로드</h2>
        <p className="mt-1 text-xs text-slate-500">
          스마트스토어 주문 엑셀을 올리면 상품번호로 이 공구 주문을 골라 판매·잔여를 자동 계산합니다.
          같은 파일을 여러 번 올려도 중복되지 않아요(상품주문번호 기준).
        </p>
        <form action={uploadOrders} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="group_buy_id" value={gb.id} />
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
            {Number(uok).toLocaleString("ko-KR")}건의 주문을 반영했습니다.
          </p>
        )}
        {uerror && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {uerrorMsg[uerror] ?? "업로드에 실패했어요."}
          </p>
        )}
      </div>

      {/* 공구상품 + 배정/판매/잔여 */}
      <h2 className="mt-8 text-sm font-bold text-slate-900">
        공구 상품 · 배정 수량 <span className="text-slate-400">({items.length})</span>
      </h2>

      <details className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">
          ＋ 공구 상품 추가
        </summary>
        {products.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            먼저 <Link href="/products" className="text-indigo-600 hover:underline">제품</Link>을 등록해 주세요.
          </p>
        ) : (
          <form action={addItem} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="group_buy_id" value={gb.id} />
            <label className="text-sm font-medium text-slate-700 sm:col-span-2">
              제품 *
              <select name="product_id" required defaultValue="" className={inputCls}>
                <option value="" disabled>
                  제품 선택…
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-700">
              스마트스토어 상품번호
              <input name="store_product_no" placeholder="예: 13641036877" className={inputCls} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              배정 수량
              <input name="allocated_qty" inputMode="numeric" placeholder="예: 100" className={inputCls} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              공구가
              <input name="gonggu_price" inputMode="numeric" placeholder="16900" className={inputCls} />
            </label>
            <label className="text-sm font-medium text-slate-700">
              마진단가 <span className="text-slate-400">(정산용, 1개당 마진)</span>
              <input name="margin_unit" inputMode="numeric" placeholder="4225" className={inputCls} />
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                추가
              </button>
            </div>
          </form>
        )}
      </details>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "product" ? "제품을 선택해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {items.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">
            아직 공구 상품이 없습니다. 위에서 제품과 배정 수량을 추가해 보세요.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">제품</th>
                <th className="px-4 py-3">상품번호</th>
                <th className="px-4 py-3 text-right">공구가</th>
                <th className="px-4 py-3 text-right">배정</th>
                <th className="px-4 py-3 text-right">판매</th>
                <th className="px-4 py-3 text-right">잔여</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const sold = soldByPno.get(String(it.store_product_no ?? "")) ?? 0;
                const remain =
                  it.allocated_qty == null ? null : it.allocated_qty - sold;
                const low = remain != null && remain <= 10;
                return (
                  <tr key={it.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-900">{it.product_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {it.store_product_no ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{won(it.gonggu_price)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{qty(it.allocated_qty)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sold.toLocaleString("ko-KR")}</td>
                    <td
                      className={
                        "px-4 py-3 text-right font-semibold tabular-nums " +
                        (remain == null
                          ? "text-slate-400"
                          : low
                            ? "text-rose-600"
                            : "text-emerald-600")
                      }
                    >
                      {remain == null ? "—" : remain.toLocaleString("ko-KR")}
                      {low && <span className="ml-1 text-[10px] font-bold">매진임박</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteItem}>
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="group_buy_id" value={gb.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
                        >
                          삭제
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
          <p className="mt-2 text-xs text-slate-400">
            대표님 ‘판매현황’ 스샷과 같은 형태로 자동 생성됩니다. 판매금액 = 수량 × 공구가.
          </p>
        </>
      )}

      {/* 정산 */}
      {hasSales && (
        <div id="settlement">
          <h2 className="mt-8 text-sm font-bold text-slate-900">정산</h2>
          <div className="mt-3 max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {settlement && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-xs text-slate-500">진행 상태</span>
                <span
                  className={
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold " +
                    (settlement.status === "전달"
                      ? "bg-emerald-50 text-emerald-700"
                      : settlement.status === "승인"
                        ? "bg-indigo-50 text-indigo-700"
                        : "bg-amber-50 text-amber-700")
                  }
                >
                  {settlement.status === "검토중"
                    ? "브랜드 확인 대기"
                    : settlement.status === "승인"
                      ? "승인됨 · 전달 대기"
                      : "상대에 전달 완료"}
                </span>
              </div>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">매출 합계</span>
                <b className="tabular-nums">{won(totalAmount)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">마진 합계</span>
                <b className="tabular-nums">{won(marginTotal)}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">결제수수료 ({feeRate}%)</span>
                <b className="tabular-nums text-rose-600">-{won(feeAmount)}</b>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <b>최종 정산금액</b>
                <b className="text-lg tabular-nums">{won(finalAmount)}</b>
              </div>
            </div>

            {!settlement ? (
              <form action={startSettlement} className="mt-5">
                <input type="hidden" name="group_buy_id" value={gb.id} />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  정산 시작
                </button>
              </form>
            ) : (
              <div className="mt-5 space-y-3">
                {settlement.status === "검토중" && (
                  <>
                    <form action={saveFeeRate} className="flex items-end gap-2">
                      <input type="hidden" name="group_buy_id" value={gb.id} />
                      <label className="text-sm text-slate-700">
                        수수료율(%)
                        <input
                          name="fee_rate"
                          inputMode="decimal"
                          defaultValue={feeRate}
                          className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        수수료율 저장
                      </button>
                    </form>
                    <form action={setSettlementStatus}>
                      <input type="hidden" name="group_buy_id" value={gb.id} />
                      <input type="hidden" name="status" value="승인" />
                      <button
                        type="submit"
                        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                      >
                        브랜드 승인 →
                      </button>
                    </form>
                  </>
                )}
                {settlement.status === "승인" && (
                  <div className="flex gap-2">
                    <form action={setSettlementStatus}>
                      <input type="hidden" name="group_buy_id" value={gb.id} />
                      <input type="hidden" name="status" value="검토중" />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        ← 되돌리기
                      </button>
                    </form>
                    <form action={setSettlementStatus}>
                      <input type="hidden" name="group_buy_id" value={gb.id} />
                      <input type="hidden" name="status" value="전달" />
                      <button
                        type="submit"
                        className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                      >
                        상대에 전달 →
                      </button>
                    </form>
                  </div>
                )}
                {settlement.status === "전달" && (
                  <form action={setSettlementStatus}>
                    <input type="hidden" name="group_buy_id" value={gb.id} />
                    <input type="hidden" name="status" value="승인" />
                    <button
                      type="submit"
                      className="text-xs text-slate-400 hover:underline"
                    >
                      전달 취소(되돌리기)
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            최종정산 = 마진합계 − (매출 × 수수료율). 마진합계는 공구상품의 ‘마진단가 × 판매수량’ 합계입니다.
            수수료율은 업체별로 편집하세요. (2단계 승인: 브랜드 확인 → 상대 전달)
          </p>
        </div>
      )}
    </div>
  );
}
