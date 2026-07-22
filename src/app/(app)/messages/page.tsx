import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/data/profile";
import { Poller } from "@/components/poller";
import { MessageComposer } from "@/components/message-composer";
import { sendMessage, markThreadRead } from "./actions";

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

  const [{ data: tData }, { data: mData }, { data: rData }] = await Promise.all([
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
  ]);

  const threads = (tData ?? []) as unknown as Thread[];
  const msgs = (mData ?? []) as Msg[];
  const readAt = new Map((rData ?? []).map((r: { thread_id: string; last_read_at: string }) => [r.thread_id, r.last_read_at]));

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
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {sorted.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-slate-400">
              아직 대화방이 없습니다. 공구 상세나 셀러·벤더 상세에서 “메시지”를 누르면 방이 생깁니다.
            </p>
          ) : (
            <ul>
              {sorted.map((t) => {
                const n = unread.get(t.id) ?? 0;
                const lm = last.get(t.id);
                const active = t.id === current?.id;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/messages?t=${t.id}`}
                      className={
                        "block border-b border-slate-100 px-4 py-3 transition last:border-0 " +
                        (active ? "bg-indigo-50" : "hover:bg-slate-50")
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            t.kind === "공구"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-violet-50 text-violet-700"
                          }`}
                        >
                          {t.kind}
                        </span>
                        <span className="truncate text-sm font-medium text-slate-900">
                          {threadTitle(t)}
                        </span>
                        {n > 0 && (
                          <span className="ml-auto shrink-0 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {n}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {lm ? `${lm.author_name}: ${lm.body}` : "대화 없음"}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 대화방 */}
        <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {!current ? (
            <p className="m-auto px-6 text-center text-sm text-slate-400">
              왼쪽에서 대화방을 선택하세요.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-3">
                <span className="font-semibold text-slate-900">{threadTitle(current)}</span>
                {current.kind === "공구" && current.group_buy_id && (
                  <Link
                    href={`/group-buys/${current.group_buy_id}`}
                    className="text-xs text-slate-500 underline decoration-slate-300 hover:text-indigo-600"
                  >
                    공구 상세 →
                  </Link>
                )}
                {current.kind === "거래처" && current.contact_id && (
                  <Link
                    href={`/contacts/${current.contact_id}`}
                    className="text-xs text-slate-500 underline decoration-slate-300 hover:text-indigo-600"
                  >
                    거래처 상세 →
                  </Link>
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
