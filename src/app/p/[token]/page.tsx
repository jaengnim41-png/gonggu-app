import { createAnonClient } from "@/lib/supabase/anon";
import { calcRow, won, pct } from "@/lib/proposals/calc";
import { PrintButton } from "@/components/print-button";

type Item = {
  name: string;
  option_label: string | null;
  detail_url: string | null;
  normal_price: number | null;
  gonggu_price: number | null;
  fee_rate: number | null;
};
type Settings = Record<string, string | number | null>;
type Payload = {
  proposal: {
    title: string;
    recipient_name: string | null;
    fee_rate_default: number;
    settle_fee_rate: number;
    created_at: string;
  } | null;
  company_name: string;
  settings: Settings;
  items: Item[];
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-xs font-semibold text-slate-500">{label}</dt>
      <dd className="whitespace-pre-wrap text-sm text-slate-800">{value}</dd>
    </div>
  );
}

export default async function PublicProposal({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAnonClient();
  const { data } = await supabase.rpc("proposal_public", { p_token: token });
  const p = data as Payload | null;

  if (!p || !p.proposal) {
    return (
      <div className="min-h-full bg-slate-50">
        <div className="mx-auto max-w-lg px-6 py-20 text-center">
          <p className="text-2xl">🔒</p>
          <h1 className="mt-3 text-lg font-bold text-slate-900">열 수 없는 제안서입니다</h1>
          <p className="mt-2 text-sm text-slate-500">링크가 만료되었거나 비활성화되었습니다. 보내주신 담당자에게 문의해 주세요.</p>
        </div>
      </div>
    );
  }

  const s = p.settings ?? {};
  const money = (v: unknown) => (v == null || v === "" ? null : won(Number(v)));
  const settleRate = p.proposal.settle_fee_rate;

  return (
    <div className="min-h-full bg-slate-100 print:bg-white">
      <div className="mx-auto max-w-4xl px-5 py-8">
        {/* 화면에서만 보이는 상단 바 */}
        <div className="mb-4 flex items-center justify-between print:hidden">
          <span className="text-sm text-slate-500">{p.company_name} 제안서</span>
          <PrintButton />
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          {/* 제목 */}
          <div className="border-b-2 border-slate-900 pb-4">
            <p className="text-xs font-semibold tracking-wide text-indigo-600">공동구매 진행 제안서</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{p.proposal.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {p.proposal.recipient_name ? `${p.proposal.recipient_name} 귀중 · ` : ""}
              {p.proposal.created_at?.slice(0, 10)}
            </p>
          </div>

          {/* 1. 공급업체 정보 */}
          <section className="mt-6">
            <h2 className="text-sm font-bold text-slate-900">1. 공급업체 정보</h2>
            <dl className="mt-2">
              <Field label="브랜드" value={(s.brand_name as string) ?? p.company_name} />
              <Field label="스마트스토어" value={s.store_url as string} />
              <Field label="택배사" value={s.courier as string} />
              <Field label="기본 택배비" value={money(s.base_ship_fee)} />
              <Field label="제주/도서산간 추가" value={money(s.extra_ship_fee)} />
              <Field label="환불 왕복 택배비" value={money(s.return_fee)} />
              <Field label="당일배송" value={s.same_day as string} />
              <Field label="출고/반품지" value={s.ship_from as string} />
              <Field label="샘플지원" value={s.sample_support as string} />
              <Field label="고객센터·CS" value={s.cs_note as string} />
              <Field label="담당자 연락" value={s.contact_note as string} />
            </dl>
          </section>

          {/* 2. 상품 구성안 */}
          <section className="mt-8">
            <h2 className="text-sm font-bold text-slate-900">2. 상품 구성안</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-300 text-left text-xs text-slate-500">
                    <th className="py-2 pr-2">NO</th>
                    <th className="py-2 pr-2">상품 / 옵션</th>
                    <th className="py-2 px-2 text-right">정상가</th>
                    <th className="py-2 px-2 text-right">공구가</th>
                    <th className="py-2 px-2 text-right">할인</th>
                    <th className="py-2 px-2 text-right">공급가(VAT)</th>
                    <th className="py-2 px-2 text-right">수수료</th>
                    <th className="py-2 pl-2 text-right">마진(VAT)</th>
                  </tr>
                </thead>
                <tbody>
                  {p.items.map((it, i) => {
                    const r = calcRow(it);
                    return (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-2.5 pr-2 text-slate-400">{i + 1}</td>
                        <td className="py-2.5 pr-2">
                          {it.detail_url ? (
                            <a href={it.detail_url} target="_blank" className="font-medium text-slate-900 underline decoration-slate-300">
                              {it.name}
                            </a>
                          ) : (
                            <span className="font-medium text-slate-900">{it.name}</span>
                          )}
                          {it.option_label && <span className="block text-xs text-slate-500">{it.option_label}</span>}
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-500 line-through">{won(it.normal_price)}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums font-semibold text-slate-900">{won(it.gonggu_price)}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-rose-600">{r.normal > 0 ? pct(r.discount) : "—"}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-600">{won(r.supply)}</td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-slate-500">{pct(r.fee)}</td>
                        <td className="py-2.5 pl-2 text-right tabular-nums font-semibold text-indigo-700">{won(r.margin)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              최종 정산 = 전체 마진 − (전체 매출 × {settleRate}%). 부가세 포함 가격입니다.
            </p>
          </section>

          {/* 3. 하단 안내 */}
          {(s.progress_note || s.settle_note || s.event_note) && (
            <section className="mt-8 space-y-4">
              {s.progress_note && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900">공구 진행 방법</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.progress_note as string}</p>
                </div>
              )}
              {s.settle_note && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900">정산</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.settle_note as string}</p>
                </div>
              )}
              {s.event_note && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900">이벤트</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{s.event_note as string}</p>
                </div>
              )}
            </section>
          )}

          <p className="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
            {p.company_name} · 공구허브로 작성한 제안서입니다
          </p>
        </div>
      </div>
    </div>
  );
}
