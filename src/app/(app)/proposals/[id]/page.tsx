import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CopyLink } from "@/components/copy-link";
import { calcRow, won, pct } from "@/lib/proposals/calc";
import {
  addProposalItem,
  toggleItemVisible,
  deleteItem,
  toggleProposal,
  deleteProposal,
} from "../actions";

type Proposal = {
  id: string;
  title: string;
  token: string;
  active: boolean;
  recipient_contact_id: string | null;
  recipient_name: string | null;
  fee_rate_default: number;
  settle_fee_rate: number;
};
type Item = {
  id: string;
  name: string;
  option_label: string | null;
  detail_url: string | null;
  normal_price: number | null;
  gonggu_price: number | null;
  fee_rate: number | null;
  visible: boolean;
  sort_order: number;
};

export default async function ProposalEditor({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: pData }, { data: iData }, { data: prodData }, { data: optData }, { data: cData }] =
    await Promise.all([
      supabase
        .from("proposals")
        .select("id, title, token, active, recipient_contact_id, recipient_name, fee_rate_default, settle_fee_rate")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("proposal_items")
        .select("id, name, option_label, detail_url, normal_price, gonggu_price, fee_rate, visible, sort_order")
        .eq("proposal_id", id)
        .order("sort_order"),
      supabase.from("products").select("id, name"),
      supabase.from("product_options").select("id, product_id, name"),
      supabase.from("contacts").select("id, name"),
    ]);

  const proposal = pData as Proposal | null;
  if (!proposal) notFound();
  const items = (iData ?? []) as Item[];
  const products = (prodData ?? []) as { id: string; name: string }[];
  const options = (optData ?? []) as { id: string; product_id: string; name: string }[];
  const contacts = (cData ?? []) as { id: string; name: string }[];
  const recipient =
    (proposal.recipient_contact_id && contacts.find((c) => c.id === proposal.recipient_contact_id)?.name) ||
    proposal.recipient_name ||
    "—";

  // 품목 드롭다운
  const itemOptions: { value: string; label: string }[] = [];
  for (const p of products) {
    itemOptions.push({ value: `p:${p.id}`, label: p.name });
    for (const o of options.filter((x) => x.product_id === p.id)) {
      itemOptions.push({ value: `o:${o.id}:${p.id}`, label: `${p.name} · ${o.name}` });
    }
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const shareUrl = `${origin}/p/${proposal.token}`;

  // 합계(열람 켜진 것만)
  const visibleItems = items.filter((it) => it.visible);
  const totalMargin = visibleItems.reduce((s, it) => s + calcRow(it).margin, 0);

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link href="/proposals" className="text-sm text-slate-500 hover:text-indigo-600">← 제안서 목록</Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">{proposal.title}</h1>
        <span className="text-sm text-slate-500">받는 곳: {recipient}</span>
      </div>

      {/* 공유 링크 */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900">공유 링크 (가입 없이 열람)</h2>
          <a
            href={shareUrl}
            target="_blank"
            className="text-xs text-indigo-600 underline hover:text-indigo-700"
          >
            미리보기 열기 ↗
          </a>
        </div>
        <div className="mt-3">
          <CopyLink url={shareUrl} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`text-xs font-medium ${proposal.active ? "text-emerald-600" : "text-slate-400"}`}>
            {proposal.active ? "● 활성" : "○ 비활성"}
          </span>
          <form action={toggleProposal}>
            <input type="hidden" name="id" value={proposal.id} />
            <input type="hidden" name="active" value={proposal.active ? "false" : "true"} />
            <button className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50">
              {proposal.active ? "링크 비활성화" : "링크 활성화"}
            </button>
          </form>
          <a
            href={`/api/proposal-export?token=${proposal.token}`}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            엑셀 다운로드
          </a>
          <span className="text-[11px] text-slate-400">PDF는 미리보기 화면에서 “인쇄 → PDF로 저장”</span>
        </div>
      </div>

      {/* 제품 담기 */}
      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" open={items.length === 0}>
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 제품 담기</summary>
        <form action={addProposalItem} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="proposal_id" value={proposal.id} />
          <label className="text-sm font-medium text-slate-700 sm:col-span-2">
            등록된 제품에서 선택
            <select name="item" defaultValue="" className={inputCls}>
              <option value="">— 아래에 직접 입력</option>
              {itemOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            상품명 (직접 입력 시)
            <input name="name_text" placeholder="예: 케어백1" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            옵션/구성
            <input name="option_text" placeholder="예: 색상선택 2개+봉투 90매" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            정상판매가
            <input name="normal_price" inputMode="numeric" placeholder="비우면 제품값 사용" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            공구판매가
            <input name="gonggu_price" inputMode="numeric" placeholder="비우면 옵션값 사용" className={inputCls} />
          </label>
          <label className="text-sm font-medium text-slate-700">
            벤더 수수료(비율)
            <input name="fee_rate" inputMode="decimal" placeholder={`비우면 ${proposal.fee_rate_default}`} className={inputCls} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              담기
            </button>
          </div>
        </form>
        {error === "item" && (
          <p className="mt-2 text-sm font-medium text-rose-700">상품명이나 옵션 중 하나는 입력해 주세요.</p>
        )}
      </details>

      {/* 상품 구성 표 */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">상품 구성 ({items.length})</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            “열람” 끈 제품은 상대에게 보이지 않습니다. 마진 = 공구가 × 수수료율, 공급가 = 공구가 − 마진.
          </p>
        </div>
        {items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">위에서 제품을 담아보세요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">상품 / 옵션</th>
                  <th className="px-3 py-2.5 text-right">정상가</th>
                  <th className="px-3 py-2.5 text-right">공구가</th>
                  <th className="px-3 py-2.5 text-right">할인</th>
                  <th className="px-3 py-2.5 text-right">공급가</th>
                  <th className="px-3 py-2.5 text-right">수수료</th>
                  <th className="px-3 py-2.5 text-right">마진</th>
                  <th className="px-3 py-2.5 text-center">열람</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const r = calcRow(it);
                  return (
                    <tr key={it.id} className={"border-b border-slate-100 last:border-0 " + (it.visible ? "" : "opacity-40")}>
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-900">{it.name}</span>
                        {it.option_label && <span className="block text-xs text-slate-500">{it.option_label}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{won(it.normal_price)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{won(it.gonggu_price)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">{r.normal > 0 ? pct(r.discount) : "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{won(r.supply)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{pct(r.fee)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-indigo-700">{won(r.margin)}</td>
                      <td className="px-3 py-2.5 text-center">
                        <form action={toggleItemVisible}>
                          <input type="hidden" name="id" value={it.id} />
                          <input type="hidden" name="proposal_id" value={proposal.id} />
                          <input type="hidden" name="visible" value={it.visible ? "false" : "true"} />
                          <button className={"rounded-md px-2 py-1 text-xs " + (it.visible ? "bg-emerald-50 font-semibold text-emerald-700" : "border border-slate-200 text-slate-400")}>
                            {it.visible ? "표시" : "숨김"}
                          </button>
                        </form>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <form action={deleteItem}>
                          <input type="hidden" name="id" value={it.id} />
                          <input type="hidden" name="proposal_id" value={proposal.id} />
                          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600">삭제</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-3 py-2.5" colSpan={6}>표시 중인 제품 마진 합계</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-indigo-700">{won(totalMargin)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <form action={deleteProposal} className="mt-6">
        <input type="hidden" name="id" value={proposal.id} />
        <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600">
          이 제안서 삭제
        </button>
      </form>
    </div>
  );
}
