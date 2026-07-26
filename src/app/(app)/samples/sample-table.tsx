"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { updateSample, toggleReturned, deleteSample } from "./actions";

export type SampleRow = {
  id: string;
  contact_id: string | null;
  contactName: string | null;
  contactKind: string | null;
  itemValue: string; // "o:optId:prodId" | "p:prodId" | ""
  itemLabel: string;
  item_text: string | null;
  quantity: number;
  sent_at: string;
  courier: string | null;
  tracking_no: string | null;
  returned: boolean;
  returned_at: string | null;
  memo: string | null;
};

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function SampleTable({
  rows,
  contacts,
  items,
  back,
}: {
  rows: SampleRow[];
  contacts: { id: string; name: string; kind: string }[];
  items: { value: string; label: string }[];
  back: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const sellers = contacts.filter((c) => c.kind === "셀러");
  const vendors = contacts.filter((c) => c.kind === "벤더");

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">발송일</th>
              <th className="px-4 py-3">받는 곳</th>
              <th className="px-4 py-3">품목</th>
              <th className="px-4 py-3 text-right">수량</th>
              <th className="px-4 py-3">송장</th>
              <th className="px-4 py-3">메모</th>
              <th className="px-4 py-3 text-center">회수</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <Fragment key={s.id}>
                <tr className="border-b border-slate-100 last:border-0 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{s.sent_at}</td>
                  <td className="px-4 py-3">
                    {s.contact_id ? (
                      <Link href={`/contacts/${s.contact_id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                        {s.contactName}
                        <span className="ml-1 text-[10px] text-slate-400">{s.contactKind}</span>
                      </Link>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{s.itemLabel}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{s.quantity}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {s.tracking_no ? (
                      <>
                        {s.courier && <span className="block">{s.courier}</span>}
                        <span className="font-mono">{s.tracking_no}</span>
                      </>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{s.memo ?? "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <form action={toggleReturned}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="back" value={back} />
                      <input type="hidden" name="returned" value={s.returned ? "false" : "true"} />
                      <button type="submit" title={s.returned ? `회수됨 ${s.returned_at ?? ""}` : "회수로 표시"}
                        className={"rounded-md px-2 py-1 text-xs " + (s.returned ? "bg-emerald-50 font-semibold text-emerald-700" : "border border-slate-200 text-slate-400 hover:border-slate-300")}>
                        {s.returned ? "회수됨" : "○"}
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setEditing(editing === s.id ? null : s.id)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600">
                        {editing === s.id ? "닫기" : "수정"}
                      </button>
                      <form action={deleteSample}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="back" value={back} />
                        <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600">삭제</button>
                      </form>
                    </div>
                  </td>
                </tr>

                {editing === s.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={8} className="px-4 py-4">
                      <form action={updateSample} className="grid gap-3 sm:grid-cols-3">
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="back" value={back} />
                        <label className="text-xs font-medium text-slate-600">
                          받는 곳
                          <select name="contact_id" defaultValue={s.contact_id ?? ""} className={inputCls + " mt-1"}>
                            <option value="">— 선택 안 함</option>
                            {sellers.length > 0 && <optgroup label="셀러">{sellers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
                            {vendors.length > 0 && <optgroup label="벤더">{vendors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          품목(등록 제품)
                          <select name="item" defaultValue={s.itemValue} className={inputCls + " mt-1"}>
                            <option value="">— 직접 입력</option>
                            {items.map((it) => <option key={it.value} value={it.value}>{it.label}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          품목 직접 입력
                          <input name="item_text" defaultValue={s.item_text ?? ""} className={inputCls + " mt-1"} />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          수량
                          <input name="quantity" inputMode="numeric" defaultValue={s.quantity} className={inputCls + " mt-1"} />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          발송일
                          <input type="date" name="sent_at" defaultValue={s.sent_at} className={inputCls + " mt-1"} />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          택배사
                          <input name="courier" defaultValue={s.courier ?? ""} className={inputCls + " mt-1"} />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          송장번호
                          <input name="tracking_no" defaultValue={s.tracking_no ?? ""} className={inputCls + " mt-1"} />
                        </label>
                        <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                          메모
                          <input name="memo" defaultValue={s.memo ?? ""} className={inputCls + " mt-1"} />
                        </label>
                        <div className="sm:col-span-3">
                          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">저장</button>
                        </div>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
