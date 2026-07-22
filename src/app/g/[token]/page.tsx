import Link from "next/link";
import { cookies } from "next/headers";
import { createAnonClient } from "@/lib/supabase/anon";
import { Poller } from "@/components/poller";
import { MessageComposer } from "@/components/message-composer";
import { requestAccess, guestSend } from "./actions";

type Enter = {
  state: "이름필요" | "대기" | "승인" | "차단" | "없음";
  contact_name?: string;
  company_name?: string;
  display_name?: string;
};
type GB = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  settle_days: number | null;
  memo: string | null;
};
type Portal = {
  guest_name: string;
  contact: { name: string; kind: string } | null;
  company_name: string;
  group_buys: GB[];
  items: { group_buy_id: string; product_name: string; allocated_qty: number | null; gonggu_price: number | null }[];
  by_option: { group_buy_id: string; option_info: string | null; qty: number; amount: number }[];
  by_day: { group_buy_id: string; day: string; qty: number; amount: number }[];
  settlements: { group_buy_id: string; fee_rate: number; revenue: number | null; margin_total: number | null }[];
  messages: { author_side: string; author_name: string; body: string; created_at: string }[];
};

const TABS = ["일정", "판매·정산", "메시지"] as const;
const LOCKED = ["제품·재고 관리", "제안서 만들기", "다른 업체와 공구", "데이터 내보내기"];

function won(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}
function when(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
}
function dayLabel(day: string) {
  const [, m, d] = day.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto w-full max-w-3xl px-5 py-10">{children}</div>
    </div>
  );
}

export default async function GuestPortal({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const { token } = await params;
  const { tab, error } = await searchParams;
  const jar = await cookies();
  const deviceKey = jar.get("gonggu_guest_key")?.value ?? "";

  const supabase = createAnonClient();
  const { data: enterData } = await supabase.rpc("guest_enter", {
    p_token: token,
    p_device_key: deviceKey,
    p_name: null,
  });
  const enter = (enterData ?? { state: "없음" }) as Enter;

  // ---------- 링크 자체가 없거나 꺼짐 ----------
  if (enter.state === "없음") {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-2xl">🔒</p>
          <h1 className="mt-3 text-lg font-bold text-slate-900">열 수 없는 링크입니다</h1>
          <p className="mt-2 text-sm text-slate-500">
            링크가 만료되었거나 비활성화되었습니다. 링크를 보내주신 담당자에게 문의해 주세요.
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- 차단 ----------
  if (enter.state === "차단") {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-2xl">⛔</p>
          <h1 className="mt-3 text-lg font-bold text-slate-900">접근이 중지되었습니다</h1>
          <p className="mt-2 text-sm text-slate-500">
            {enter.company_name} 담당자에게 문의해 주세요.
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- 첫 입장: 이름 남기기 ----------
  if (enter.state === "이름필요") {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold text-indigo-600">{enter.company_name}</p>
          <h1 className="mt-1 text-lg font-bold text-slate-900">
            {enter.contact_name} 님을 위한 공구 현황
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            가입 없이 공구 일정·판매현황·정산서를 보고 메시지를 주고받을 수 있습니다.
            <br />
            먼저 <b>누구신지</b> 알려주세요. {enter.company_name} 담당자가 확인하면 열립니다.
          </p>

          <form action={requestAccess} className="mt-5">
            <input type="hidden" name="token" value={token} />
            <label className="text-sm font-medium text-slate-700">
              이름 · 소속
              <input
                name="name"
                required
                autoFocus
                placeholder="예: 레몬트리 김대리"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
            {error === "name" && (
              <p className="mt-2 text-sm font-medium text-rose-700">이름을 입력해 주세요.</p>
            )}
            <button
              type="submit"
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              열람 요청하기
            </button>
          </form>
        </div>
      </Shell>
    );
  }

  // ---------- 승인 대기 ----------
  if (enter.state === "대기") {
    return (
      <Shell>
        <Poller intervalMs={15000} />
        <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <p className="text-2xl">⏳</p>
          <h1 className="mt-3 text-lg font-bold text-slate-900">승인을 기다리는 중입니다</h1>
          <p className="mt-2 text-sm text-slate-500">
            <b>{enter.display_name}</b> 님으로 요청했습니다.
            <br />
            {enter.company_name} 담당자가 확인하면 바로 열립니다. 이 화면을 열어두시면 자동으로 넘어갑니다.
          </p>
        </div>
      </Shell>
    );
  }

  // ---------- 승인됨: 포털 ----------
  const { data: portalData } = await supabase.rpc("guest_portal", {
    p_token: token,
    p_device_key: deviceKey,
  });
  const p = portalData as Portal | null;
  if (!p) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">잠시 후 다시 시도해 주세요</h1>
        </div>
      </Shell>
    );
  }

  const current = (TABS as readonly string[]).includes(tab ?? "") ? tab! : "일정";
  const gbTitle = new Map(p.group_buys.map((g) => [g.id, g.title]));

  return (
    <div className="min-h-full bg-slate-50">
      {/* 상단 */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 px-5 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
            공
          </span>
          <span className="font-semibold text-slate-900">{p.company_name}</span>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
            {p.contact?.name} · {p.contact?.kind}
          </span>
          <span className="ml-auto text-xs text-slate-500">{p.guest_name} 님 (게스트)</span>
        </div>
        <div className="mx-auto flex w-full max-w-3xl gap-1 px-5">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/g/${token}?tab=${encodeURIComponent(t)}`}
              className={
                "border-b-2 px-3 py-2.5 text-sm transition " +
                (current === t
                  ? "border-indigo-600 font-semibold text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-800")
              }
            >
              {t}
            </Link>
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl px-5 py-8">
        {current === "메시지" && <Poller intervalMs={5000} />}

        {/* ---------- 일정 ---------- */}
        {current === "일정" && (
          <>
            <h1 className="text-lg font-bold text-slate-900">공구 일정</h1>
            <p className="mt-1 text-sm text-slate-500">
              {p.company_name}와(과) 함께 진행하는 공구입니다.
            </p>
            {p.group_buys.length === 0 ? (
              <p className="mt-6 rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400 shadow-sm">
                아직 연결된 공구가 없습니다.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {p.group_buys.map((g) => {
                  const rev = p.by_option
                    .filter((o) => o.group_buy_id === g.id)
                    .reduce((s, o) => s + Number(o.amount ?? 0), 0);
                  return (
                    <div key={g.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{g.title}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            g.status === "진행중"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {g.status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-slate-600">
                        {g.start_date ?? "—"} ~ {g.end_date ?? "—"}
                        {g.settle_days != null && (
                          <span className="ml-2 text-xs text-slate-400">
                            정산 종료 후 {g.settle_days}일
                          </span>
                        )}
                      </p>
                      <p className="mt-2 text-sm tabular-nums text-slate-700">누적 매출 {won(rev)}</p>
                      {g.memo && <p className="mt-1 text-xs text-slate-500">{g.memo}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ---------- 판매 · 정산 ---------- */}
        {current === "판매·정산" && (
          <>
            <h1 className="text-lg font-bold text-slate-900">판매현황 · 정산</h1>
            <p className="mt-1 text-sm text-slate-500">
              주문이 올라오는 대로 자동 반영됩니다. 따로 알려드리지 않아도 여기서 확인하실 수 있습니다.
            </p>

            {p.group_buys.length === 0 && (
              <p className="mt-6 rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400 shadow-sm">
                아직 연결된 공구가 없습니다.
              </p>
            )}

            {p.group_buys.map((g) => {
              const days = p.by_day
                .filter((d) => d.group_buy_id === g.id)
                .sort((a, b) => a.day.localeCompare(b.day));
              const opts = p.by_option.filter((o) => o.group_buy_id === g.id);
              const totalQty = opts.reduce((s, o) => s + Number(o.qty ?? 0), 0);
              const totalRev = opts.reduce((s, o) => s + Number(o.amount ?? 0), 0);
              const st = p.settlements.find((s) => s.group_buy_id === g.id);
              const maxDay = Math.max(1, ...days.map((d) => Number(d.amount ?? 0)));

              return (
                <div key={g.id} className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <p className="font-semibold text-slate-900">{g.title}</p>
                    <p className="mt-1 text-sm tabular-nums text-slate-600">
                      총 {totalQty.toLocaleString("ko-KR")}개 · {won(totalRev)}
                    </p>
                  </div>

                  {/* 일자별 */}
                  {days.length > 0 && (
                    <div className="border-b border-slate-100 px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        일자별 판매
                      </p>
                      <div className="mt-3 flex items-end gap-2 overflow-x-auto">
                        {days.map((d) => (
                          <div key={d.day} className="flex min-w-12 flex-1 flex-col items-center gap-1">
                            <span className="text-[11px] tabular-nums text-slate-500">{d.qty}</span>
                            <div
                              className="w-full rounded-t-md bg-indigo-500"
                              style={{ height: `${Math.max(4, (Number(d.amount ?? 0) / maxDay) * 90)}px` }}
                              title={won(Number(d.amount ?? 0))}
                            />
                            <span className="text-[11px] text-slate-500">{dayLabel(d.day)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 옵션별 */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2.5">옵션</th>
                          <th className="px-4 py-2.5 text-right">수량</th>
                          <th className="px-4 py-2.5 text-right">판매금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opts.map((o, i) => (
                          <tr key={i} className="border-b border-slate-100 last:border-0">
                            <td className="px-4 py-2.5 text-slate-700">{o.option_info ?? "—"}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{o.qty}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{won(Number(o.amount ?? 0))}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-50 font-semibold">
                          <td className="px-4 py-2.5">전체</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{totalQty}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{won(totalRev)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* 정산 */}
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">정산서</p>
                    {!st ? (
                      <p className="mt-2 text-sm text-slate-500">
                        아직 전달된 정산서가 없습니다. 확정되면 여기에 올라옵니다.
                      </p>
                    ) : (
                      <dl className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-slate-500">매출 합계</dt>
                          <dd className="tabular-nums text-slate-800">{won(Number(st.revenue ?? 0))}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">마진 합계</dt>
                          <dd className="tabular-nums text-slate-800">{won(Number(st.margin_total ?? 0))}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">결제수수료 ({st.fee_rate}%)</dt>
                          <dd className="tabular-nums text-slate-800">
                            -{won((Number(st.revenue ?? 0) * Number(st.fee_rate)) / 100)}
                          </dd>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                          <dt className="text-slate-900">최종 정산금액</dt>
                          <dd className="tabular-nums text-indigo-700">
                            {won(
                              Number(st.margin_total ?? 0) -
                                (Number(st.revenue ?? 0) * Number(st.fee_rate)) / 100
                            )}
                          </dd>
                        </div>
                      </dl>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ---------- 메시지 ---------- */}
        {current === "메시지" && (
          <>
            <h1 className="text-lg font-bold text-slate-900">메시지</h1>
            <p className="mt-1 text-sm text-slate-500">
              {p.company_name} 담당자와 바로 대화할 수 있습니다.
            </p>
            <div className="mt-5 flex min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-5 py-4">
                {p.messages.length === 0 ? (
                  <p className="py-16 text-center text-sm text-slate-400">첫 메시지를 남겨보세요.</p>
                ) : (
                  p.messages.map((m, i) => {
                    const mine = m.author_side === "게스트";
                    return (
                      <div key={i} className={mine ? "flex justify-end" : "flex justify-start"}>
                        <div className="max-w-[75%]">
                          <p className={"mb-0.5 text-[11px] " + (mine ? "text-right text-slate-400" : "text-slate-500")}>
                            {m.author_name}
                            <span className="ml-1.5">{when(m.created_at)}</span>
                          </p>
                          <div
                            className={
                              "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm " +
                              (mine
                                ? "bg-indigo-600 text-white"
                                : "border border-slate-200 bg-white text-slate-800")
                            }
                          >
                            {m.body}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <MessageComposer action={guestSend} hidden={{ token }} />
            </div>
          </>
        )}

        {/* 가입 안내 */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">가입하면 더 쓸 수 있어요</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOCKED.map((f) => (
              <span
                key={f}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-400"
              >
                🔒 {f}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            가입은 무료입니다. 여러 업체와의 공구를 한 화면에서 보려면 가입하세요. 가입 후 이 링크를 다시 열면
            지금 보시는 일정·정산서·메시지가 그대로 이어집니다.
          </p>
          <Link
            href={`/?invite=${token}`}
            className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            무료로 가입하기
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          공구허브 · {p.company_name}가 공유한 화면입니다
        </p>
      </div>
    </div>
  );
}
