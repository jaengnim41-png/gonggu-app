import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SampleForm } from "@/components/sample-form";
import { createSample, toggleReturned, saveSampleMemo, deleteSample } from "./actions";

type Sample = {
  id: string;
  contact_id: string | null;
  product_id: string | null;
  product_option_id: string | null;
  item_text: string | null;
  quantity: number;
  sent_at: string;
  courier: string | null;
  tracking_no: string | null;
  returned: boolean;
  returned_at: string | null;
  memo: string | null;
};

export default async function SamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: sData }, { data: cData }, { data: pData }, { data: oData }] = await Promise.all([
    supabase
      .from("sample_shipments")
      .select("id, contact_id, product_id, product_option_id, item_text, quantity, sent_at, courier, tracking_no, returned, returned_at, memo")
      .order("sent_at", { ascending: false }),
    supabase.from("contacts").select("id, name, kind").order("name"),
    supabase.from("products").select("id, name").order("name"),
    supabase.from("product_options").select("id, product_id, name").order("name"),
  ]);

  const samples = (sData ?? []) as Sample[];
  const contacts = (cData ?? []) as { id: string; name: string; kind: string }[];
  const products = (pData ?? []) as { id: string; name: string }[];
  const options = (oData ?? []) as { id: string; product_id: string; name: string }[];

  const contactName = new Map(contacts.map((c) => [c.id, c]));
  const productName = new Map(products.map((p) => [p.id, p.name]));
  const optionName = new Map(options.map((o) => [o.id, o.name]));

  // 품목 선택 목록: 제품 + 제품·옵션
  const items: { value: string; label: string }[] = [];
  for (const p of products) {
    items.push({ value: `p:${p.id}`, label: p.name });
    for (const o of options.filter((x) => x.product_id === p.id)) {
      items.push({ value: `o:${o.id}:${p.id}`, label: `${p.name} · ${o.name}` });
    }
  }

  function itemLabel(s: Sample) {
    if (s.product_option_id) {
      const p = s.product_id ? productName.get(s.product_id) : null;
      const o = optionName.get(s.product_option_id);
      return [p, o].filter(Boolean).join(" · ") || s.item_text || "—";
    }
    if (s.product_id) return productName.get(s.product_id) ?? s.item_text ?? "—";
    return s.item_text ?? "—";
  }

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthCount = samples.filter((s) => s.sent_at?.startsWith(thisMonth)).length;
  const totalQty = samples.reduce((n, s) => n + (s.quantity ?? 0), 0);
  const returnedCount = samples.filter((s) => s.returned).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-lg font-bold text-slate-900">샘플</h1>
      <p className="mt-1 text-sm text-slate-500">
        셀러·벤더에게 보낸 샘플을 기록합니다. 대부분 보내면 끝이라, 회수는 가끔 쓰는 체크로만 두었습니다.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "총 발송", value: `${samples.length}건`, sub: `수량 ${totalQty.toLocaleString("ko-KR")}개` },
          { label: "이번 달", value: `${monthCount}건`, sub: thisMonth.replace("-", "년 ") + "월" },
          { label: "회수됨", value: `${returnedCount}건`, sub: "회수는 드문 경우" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{c.value}</p>
            <p className="mt-1 text-xs text-slate-400">{c.sub}</p>
          </div>
        ))}
      </div>

      <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-indigo-700">＋ 샘플 발송 기록</summary>
        <SampleForm action={createSample} contacts={contacts} items={items} back="/samples" />
      </details>

      {error && (
        <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm font-medium text-rose-700">
          {error === "input" ? "받는 곳이나 품목 중 하나는 입력해 주세요." : "저장에 실패했어요."}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {samples.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">
            아직 기록이 없습니다. 위 “＋ 샘플 발송 기록”으로 추가해 보세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">발송일</th>
                  <th className="px-4 py-3">받는 곳</th>
                  <th className="px-4 py-3">품목</th>
                  <th className="px-4 py-3 text-right">수량</th>
                  <th className="px-4 py-3">송장</th>
                  <th className="px-4 py-3">메모 · 특이사항</th>
                  <th className="px-4 py-3 text-center">회수</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s) => {
                  const c = s.contact_id ? contactName.get(s.contact_id) : null;
                  return (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{s.sent_at}</td>
                      <td className="px-4 py-3">
                        {c ? (
                          <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                            {c.name}
                            <span className="ml-1 text-[10px] text-slate-400">{c.kind}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{itemLabel(s)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{s.quantity}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {s.tracking_no ? (
                          <>
                            {s.courier && <span className="block">{s.courier}</span>}
                            <span className="font-mono">{s.tracking_no}</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <form action={saveSampleMemo} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="back" value="/samples" />
                          <input
                            name="memo"
                            defaultValue={s.memo ?? ""}
                            placeholder="특이사항 적기"
                            className="w-48 rounded-md border border-transparent bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none hover:border-slate-300 focus:border-indigo-500 focus:bg-white"
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-slate-200 px-1.5 py-1 text-[10px] text-slate-500 hover:border-indigo-300 hover:text-indigo-600"
                          >
                            저장
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <form action={toggleReturned}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="back" value="/samples" />
                          <input type="hidden" name="returned" value={s.returned ? "false" : "true"} />
                          <button
                            type="submit"
                            title={s.returned ? `회수됨 ${s.returned_at ?? ""}` : "회수로 표시"}
                            className={
                              "rounded-md px-2 py-1 text-xs " +
                              (s.returned
                                ? "bg-emerald-50 font-semibold text-emerald-700"
                                : "border border-slate-200 text-slate-400 hover:border-slate-300")
                            }
                          >
                            {s.returned ? "회수됨" : "○"}
                          </button>
                        </form>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <form action={deleteSample}>
                          <input type="hidden" name="id" value={s.id} />
                          <input type="hidden" name="back" value="/samples" />
                          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600">
                            삭제
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
