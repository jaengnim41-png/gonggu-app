import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";
import { Poller } from "@/components/poller";
import { MessageComposer } from "@/components/message-composer";
import { CopyLink } from "@/components/copy-link";
import { ConfirmButton } from "@/components/confirm-button";
import { sendMessage, markThreadRead, startThread, deleteThread } from "./actions";
import {
  createGuestLink,
  regenerateGuestLink,
  toggleGuestLink,
  setGuestStatus,
} from "../contacts/actions";

type Thread = {
  id: string;
  kind: string;
  group_buy_id: string | null;
  contact_id: string | null;
  group_buys: { title: string; status: string } | null;
  contacts: { name: string; kind: string } | null;
};
type Msg = {
  id: string;
  thread_id: string;
  author_side: string;
  author_user_id: string | null;
  author_name: string;
  body: string;
  created_at: string;
};

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  const time = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}

function threadTitle(t: Thread) {
  if (t.kind === "공구") return t.group_buys?.title ?? "(삭제된 공구)";
  return t.contacts?.name ?? "(삭제된 거래처)";
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; error?: string }>;
}) {
  const { t: selectedId, error } = await searchParams;
  const { user } = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: tData }, { data: mData }, { data: rData }, { data: cData }] = await Promise.all([
    supabase
      .from("message_threads")
      .select("id, kind, group_buy_id, contact_id, group_buys(title, status), contacts(name, kind)")
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id, thread_id, author_side, author_user_id, author_name, body, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("thread_reads").select("thread_id, last_read_at"),
    supabase.from("contacts").select("id, name, kind").order("sort_order"),
  ]);

  const threads = (tData ?? []) as unknown as Thread[];
  const msgs = (mData ?? []) as Msg[];
  const readAt = new Map((rData ?? []).map((r: { thread_id: string; last_read_at: string }) => [r.thread_id, r.last_read_at]));
  const allContacts = (cData ?? []) as { id: string; name: string; kind: string }[];

  // 방별 마지막 메시지 · 안읽음 수
  const last = new Map<string, Msg>();
  const unread = new Map<string, number>();
  for (const m of msgs) {
    if (!last.has(m.thread_id)) last.set(m.thread_id, m);
    const mine = m.author_user_id && m.author_user_id === user?.id;
    const seenAt = readAt.get(m.thread_id);
    if (!mine && (!seenAt || m.created_at > seenAt)) {
      unread.set(m.thread_id, (unread.get(m.thread_id) ?? 0) + 1);
    }
  }

  // 최근 대화 순 정렬
  const sorted = [...threads].sort((a, b) => {
    const la = last.get(a.id)?.created_at ?? "";
    const lb = last.get(b.id)?.created_at ?? "";
    return lb.localeCompare(la);
  });

  const current = sorted.find((x) => x.id === selectedId) ?? null;
  const roomMsgs = current
    ? msgs.filter((m) => m.thread_id === current.id).slice().reverse()
    : [];

  if (current) await markThreadRead(current.id);

  // 현재 방이 거래처 방이면 초대 링크 + 게스트(상대) 목록을 함께 가져옵니다
  let inviteLink: { token: string; active: boolean } | null = null;
  let roomGuests: { id: string; display_name: string; status: string }[] = [];
  let inviteUrl = "";
  if (current?.kind === "거래처" && current.contact_id) {
    const [{ data: lk }, { data: gs }] = await Promise.all([
      supabase.from("guest_links").select("token, active").eq("contact_id", current.contact_id).maybeSingle(),
      supabase
        .from("guests")
        .select("id, display_name, status")
        .eq("contact_id", current.contact_id)
        .order("requested_at", { ascending: false }),
    ]);
    inviteLink = (lk as { token: string; active: boolean } | null) ?? null;
    roomGuests = (gs ?? []) as { id: string; display_name: string; status: string }[];
    if (inviteLink) {
      const h = await headers();
      const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? ""}`;
      inviteUrl = `${origin}/g/${inviteLink.token}`;
    }
  }
  const pendingGuestCount = roomGuests.filter((g) => g.status === "대기").length;
  const contactsForNew = allContacts; // 셀러+벤더 모두 새 대화 대상

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Poller intervalMs={5000} />
      <h1 className="text-lg font-bold text-slate-900">메시지</h1>
      <p className="mt-1 text-sm text-slate-500">
        공구별·거래처별로 대화가 쌓입니다. 초대 링크로 들어온 승인된 셀러·벤더도 같은 방에서 대화합니다.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          대화방을 열지 못했어요.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[18rem_1fr]">
        {/* 방 목록 */}
        <div className="flex flex-col gap-3">
          {/* 새 대화 시작 */}
          <form action={startThread} className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            <select
              name="contact_id"
              defaultValue=""
              required
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            >
              <option value="" disabled>새 대화 상대 선택…</option>
              <optgroup label="셀러">
                {contactsForNew.filter((c) => c.kind === "셀러").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
              <optgroup label="벤더">
                {contactsForNew.filter((c) => c.kind === "벤더").map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            </select>
            <button type="submit" className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700">
              ＋ 대화
            </button>
          </form>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {sorted.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-slate-400">
                아직 대화방이 없습니다. 위에서 상대를 골라 “＋ 대화”를 누르거나, 공구·거래처 상세의 “메시지”로 시작하세요.
              </p>
            ) : (
              <ul>
                {sorted.map((t) => {
                  const n = unread.get(t.id) ?? 0;
                  const lm = last.get(t.id);
                  const active = t.id === current?.id;
                  return (
                    <li key={t.id} className={"group border-b border-slate-100 last:border-0 " + (active ? "bg-indigo-50" : "hover:bg-slate-50")}>
                      <div className="flex items-center">
                        <Link href={`/messages?t=${t.id}`} className="block min-w-0 flex-1 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                t.kind === "공구" ? "bg-slate-100 text-slate-600" : "bg-violet-50 text-violet-700"
                              }`}
                            >
                              {t.kind}
                            </span>
                            <span className="truncate text-sm font-medium text-slate-900">{threadTitle(t)}</span>
                            {n > 0 && (
                              <span className="ml-auto shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{n}</span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {lm ? `${lm.author_name}: ${lm.body}` : "대화 없음"}
                          </p>
                        </Link>
                        <form action={deleteThread} className="pr-2">
                          <input type="hidden" name="thread_id" value={t.id} />
                          <ConfirmButton
                            message={`'${threadTitle(t)}' 대화방을 삭제할까요? 대화 내용도 함께 사라집니다.`}
                            title="대화방 삭제"
                            className="rounded-md px-1.5 py-1 text-xs text-slate-300 hover:bg-rose-50 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            ✕
                          </ConfirmButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 대화방 */}
        <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!current ? (
            <p className="m-auto px-6 text-center text-sm text-slate-400">
              왼쪽에서 대화방을 선택하세요.
            </p>
          ) : (
            <>
              <div className="border-b border-slate-200 px-5 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900">{threadTitle(current)}</span>
                  {current.kind === "공구" && current.group_buy_id && (
                    <Link href={`/group-buys/${current.group_buy_id}`} className="text-xs text-slate-500 underline decoration-slate-300 hover:text-indigo-600">
                      공구 상세 →
                    </Link>
                  )}
                  {current.kind === "거래처" && current.contact_id && (
                    <Link href={`/contacts/${current.contact_id}`} className="text-xs text-slate-500 underline decoration-slate-300 hover:text-indigo-600">
                      거래처 상세 →
                    </Link>
                  )}
                  <form action={deleteThread} className="ml-auto">
                    <input type="hidden" name="thread_id" value={current.id} />
                    <ConfirmButton message={`'${threadTitle(current)}' 대화방을 삭제할까요? 대화 내용도 함께 사라집니다.`} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:border-rose-300 hover:text-rose-600">
                      대화방 삭제
                    </ConfirmButton>
                  </form>
                </div>

                {/* 상대(게스트) 관리 — 거래처 방에서만 */}
                {current.kind === "거래처" && current.contact_id && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-indigo-700">
                      상대 초대·관리 {pendingGuestCount > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">승인 대기 {pendingGuestCount}</span>}
                    </summary>
                    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                      {!inviteLink ? (
                        <form action={createGuestLink}>
                          <input type="hidden" name="contact_id" value={current.contact_id} />
                          <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">
                            초대 링크 만들기
                          </button>
                          <span className="ml-2 text-[11px] text-slate-500">링크를 상대에게 보내면 이 방에서 대화할 수 있어요.</span>
                        </form>
                      ) : (
                        <>
                          <CopyLink url={inviteUrl} />
                          <div className="flex flex-wrap items-center gap-2 text-[11px]">
                            <span className={inviteLink.active ? "text-emerald-600" : "text-slate-400"}>
                              {inviteLink.active ? "● 활성" : "○ 비활성"}
                            </span>
                            <form action={toggleGuestLink}>
                              <input type="hidden" name="contact_id" value={current.contact_id} />
                              <input type="hidden" name="active" value={inviteLink.active ? "false" : "true"} />
                              <button className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:bg-white">
                                {inviteLink.active ? "링크 잠금" : "링크 열기"}
                              </button>
                            </form>
                            <form action={regenerateGuestLink}>
                              <input type="hidden" name="contact_id" value={current.contact_id} />
                              <button className="rounded border border-slate-300 px-2 py-0.5 text-slate-600 hover:border-rose-300 hover:text-rose-600">
                                재발급
                              </button>
                            </form>
                          </div>
                        </>
                      )}

                      {/* 대화 상대(게스트) 목록: 승인=추가 / 차단=삭제 */}
                      {roomGuests.length > 0 && (
                        <div>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">대화 상대 ({roomGuests.length})</p>
                          <ul className="space-y-1">
                            {roomGuests.map((g) => (
                              <li key={g.id} className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-slate-800">{g.display_name}</span>
                                <span
                                  className={
                                    "rounded-full px-1.5 py-0.5 text-[10px] font-medium " +
                                    (g.status === "승인" ? "bg-emerald-50 text-emerald-700" : g.status === "차단" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700")
                                  }
                                >
                                  {g.status}
                                </span>
                                <span className="ml-auto flex gap-1">
                                  {g.status !== "승인" && (
                                    <form action={setGuestStatus}>
                                      <input type="hidden" name="guest_id" value={g.id} />
                                      <input type="hidden" name="status" value="승인" />
                                      <input type="hidden" name="back" value={`/messages?t=${current.id}`} />
                                      <button className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-emerald-700">승인</button>
                                    </form>
                                  )}
                                  {g.status !== "차단" && (
                                    <form action={setGuestStatus}>
                                      <input type="hidden" name="guest_id" value={g.id} />
                                      <input type="hidden" name="status" value="차단" />
                                      <input type="hidden" name="back" value={`/messages?t=${current.id}`} />
                                      <button className="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] text-slate-500 hover:border-rose-300 hover:text-rose-600">차단</button>
                                    </form>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-5 py-4">
                {roomMsgs.length === 0 ? (
                  <p className="py-16 text-center text-sm text-slate-400">
                    첫 메시지를 남겨보세요.
                  </p>
                ) : (
                  roomMsgs.map((m) => {
                    const mine = m.author_side === "회사";
                    return (
                      <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                        <div className="max-w-[75%]">
                          <p
                            className={
                              "mb-0.5 text-[11px] " + (mine ? "text-right text-slate-400" : "text-slate-500")
                            }
                          >
                            {m.author_name}
                            {!mine && <span className="ml-1 text-violet-500">게스트</span>}
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

              <MessageComposer action={sendMessage} hidden={{ thread_id: current.id }} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
