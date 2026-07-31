"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { updateContact, deleteContact, moveContact } from "@/app/(app)/contacts/actions";
import { ConfirmButton } from "@/components/confirm-button";

export type ContactRow = {
  id: string;
  name: string;
  instagram: string | null;
  followers: number | null;
  phone: string | null;
  address: string | null;
  contact_info: string | null;
  memo: string | null;
  vendorIds: string[];      // 셀러: 연결된 벤더 id
  linkedNames: string[];    // 셀러=연결벤더 이름, 벤더=연결셀러 이름
  gbCount: number;
  liveCount: number;
  revenue: number;
};

function won(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}
function num(n: number | null) {
  return n == null ? "—" : n.toLocaleString("ko-KR");
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function ContactTable({
  kind,
  rows,
  vendors,
}: {
  kind: "셀러" | "벤더";
  rows: ContactRow[];
  vendors: { id: string; name: string }[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const isSeller = kind === "셀러";
  const path = isSeller ? "/sellers" : "/vendors";
  const colCount = 8;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-3 text-center">순서</th>
              <th className="px-4 py-3">{kind}</th>
              <th className="px-4 py-3">연락처</th>
              <th className="px-4 py-3">{isSeller ? "연결 벤더" : "연결 셀러"}</th>
              <th className="px-4 py-3 text-right">공구</th>
              <th className="px-4 py-3 text-right">진행중</th>
              <th className="px-4 py-3 text-right">매출</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, i) => (
              <Fragment key={c.id}>
                <tr className="border-b border-slate-100 last:border-0 align-top">
                  <td className="px-2 py-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <form action={moveContact}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="kind" value={kind} />
                        <input type="hidden" name="dir" value="up" />
                        <button type="submit" disabled={i === 0} className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">▲</button>
                      </form>
                      <form action={moveContact}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="kind" value={kind} />
                        <input type="hidden" name="dir" value="down" />
                        <button type="submit" disabled={i === rows.length - 1} className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">▼</button>
                      </form>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/contacts/${c.id}`} className="font-medium text-slate-900 hover:text-indigo-600">
                      {c.name}
                    </Link>
                    {isSeller && c.instagram && (
                      <span className="ml-2 font-mono text-xs text-slate-400">{c.instagram}</span>
                    )}
                    {isSeller && c.followers != null && (
                      <span className="ml-2 text-xs text-slate-400">팔로워 {num(c.followers)}</span>
                    )}
                    {c.memo && <p className="mt-0.5 max-w-60 truncate text-xs text-slate-400" title={c.memo}>{c.memo}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.phone ?? "—"}
                    {c.address && <p className="max-w-48 truncate text-slate-400" title={c.address}>{c.address}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.linkedNames.length ? (
                      <span className="text-xs">{c.linkedNames.join(", ")}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.gbCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.liveCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{won(c.revenue)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditing(editing === c.id ? null : c.id)}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                      >
                        {editing === c.id ? "닫기" : "수정"}
                      </button>
                      <form action={deleteContact}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="kind" value={kind} />
                        <ConfirmButton message={`'${c.name}' ${kind}를 삭제할까요? 연결·실적 기록도 사라집니다.`} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600">삭제</ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>

                {editing === c.id && (
                  <tr className="bg-slate-50">
                    <td colSpan={colCount} className="px-4 py-4">
                      <form action={updateContact} className="grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="kind" value={kind} />
                        <input type="hidden" name="back" value={path} />
                        <label className="text-xs font-medium text-slate-600">
                          이름 *
                          <input name="name" required defaultValue={c.name} className={inputCls + " mt-1"} />
                        </label>
                        {isSeller && (
                          <label className="text-xs font-medium text-slate-600">
                            인스타
                            <input name="instagram" defaultValue={c.instagram ?? ""} className={inputCls + " mt-1"} />
                          </label>
                        )}
                        {isSeller && (
                          <label className="text-xs font-medium text-slate-600">
                            팔로워
                            <input name="followers" inputMode="numeric" defaultValue={c.followers ?? ""} className={inputCls + " mt-1"} />
                          </label>
                        )}
                        <label className="text-xs font-medium text-slate-600">
                          연락처(택배)
                          <input name="phone" defaultValue={c.phone ?? ""} placeholder="010-0000-0000" className={inputCls + " mt-1"} />
                        </label>
                        <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                          주소(택배 발송)
                          <input name="address" defaultValue={c.address ?? ""} className={inputCls + " mt-1"} />
                        </label>
                        <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                          메모
                          <input name="memo" defaultValue={c.memo ?? ""} className={inputCls + " mt-1"} />
                        </label>
                        {isSeller && (
                          <fieldset className="sm:col-span-2">
                            <legend className="text-xs font-medium text-slate-600">연결 벤더 (여러 곳 선택 가능)</legend>
                            <div className="mt-1 flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2">
                              {vendors.length === 0 && <span className="text-xs text-slate-400">등록된 벤더가 없습니다.</span>}
                              {vendors.map((v) => (
                                <label key={v.id} className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700">
                                  <input type="checkbox" name="vendor_ids" value={v.id} defaultChecked={c.vendorIds.includes(v.id)} />
                                  {v.name}
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        )}
                        <div className="sm:col-span-2">
                          <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">저장</button>
                          {!isSeller && (
                            <span className="ml-2 text-xs text-slate-400">담당자·셀러 연결은 이름을 눌러 상세에서 관리하세요.</span>
                          )}
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
