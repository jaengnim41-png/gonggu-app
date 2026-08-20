"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { updateProduct, deleteProduct, moveProduct } from "./actions";
import { setStockLevel } from "../inventory/actions";
import { ConfirmButton } from "@/components/confirm-button";

export type CatalogOption = {
  id: string;
  name: string;
  option_key: string | null;
  normal_price: number | null;
  gonggu_price: number | null;
  supply_price: number | null;
  inQ: number;
  soldQ: number;
  avail: number;
};

export type CatalogRow = {
  id: string;
  name: string;
  category: string | null;
  detail_url: string | null;
  normal_price: number | null;
  supply_price: number | null;
  selling_point: string | null;
  caution: string | null;
  options: CatalogOption[];
  totalIn: number;
  totalSold: number;
  totalAvail: number;
};

function won(n: number | null) {
  return n == null ? "—" : "₩" + n.toLocaleString("ko-KR");
}
function qty(n: number) {
  return n.toLocaleString("ko-KR");
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

/** 제품·옵션·가격·재고를 한 표에서. 제품 행을 펼치면 옵션별 가격과 재고(수정 가능)가 나옵니다. */
export function CatalogTable({ products }: { products: CatalogRow[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const allOpen = products.length > 0 && products.every((p) => open[p.id]);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const setAll = (v: boolean) => setOpen(Object.fromEntries(products.map((p) => [p.id, v])));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">제품·재고 현황</h2>
        <button
          type="button"
          onClick={() => setAll(!allOpen)}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          {allOpen ? "모두 접기" : "모두 펼치기"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-3 text-center">순서</th>
              <th className="px-4 py-3">제품 / 옵션</th>
              <th className="px-3 py-3 text-right">정상가</th>
              <th className="px-3 py-3 text-right">공구가</th>
              <th className="px-3 py-3 text-right">공급가</th>
              <th className="px-3 py-3 text-right">입고</th>
              <th className="px-3 py-3 text-right">판매</th>
              <th className="px-3 py-3 text-right">가용</th>
              <th className="px-3 py-3">상태</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, i) => {
              const isOpen = !!open[p.id];
              const low = p.totalAvail <= 10;
              return (
                <Fragment key={p.id}>
                  {/* 제품(대분류) 행 */}
                  <tr className="border-b border-slate-100 bg-slate-50/60 last:border-0">
                    <td className="px-2 py-2.5">
                      <div className="flex flex-col items-center">
                        <form action={moveProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="dir" value="up" />
                          <button type="submit" disabled={i === 0} title="위로" className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">▲</button>
                        </form>
                        <form action={moveProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="dir" value="down" />
                          <button type="submit" disabled={i === products.length - 1} title="아래로" className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30">▼</button>
                        </form>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button type="button" onClick={() => toggle(p.id)} className="flex items-center gap-2 text-left font-semibold text-slate-900">
                        <span className="inline-block w-3 text-slate-400">{isOpen ? "▾" : "▸"}</span>
                        {p.name}
                        <span className="text-xs font-normal text-slate-400">옵션 {p.options.length}</span>
                      </button>
                      {p.category && <div className="ml-5 text-[11px] text-slate-400">{p.category}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{won(p.normal_price)}</td>
                    <td className="px-3 py-2.5 text-right text-slate-300">—</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{won(p.supply_price)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{qty(p.totalIn)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{qty(p.totalSold)}</td>
                    <td className={"px-3 py-2.5 text-right font-bold tabular-nums " + (low ? "text-rose-600" : "text-emerald-600")}>{qty(p.totalAvail)}</td>
                    <td className="px-3 py-2.5">
                      <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + (low ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
                        {low ? "부족" : "충분"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/products/${p.id}`} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600" title="옵션 추가·상세">
                          상세
                        </Link>
                        <button
                          type="button"
                          onClick={() => setEditing(editing === p.id ? null : p.id)}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                        >
                          {editing === p.id ? "닫기" : "수정"}
                        </button>
                        <form action={deleteProduct}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmButton
                            message={`'${p.name}' 제품을 삭제할까요? 하위 옵션도 함께 지워집니다.`}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600"
                          >
                            삭제
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>

                  {/* 제품 정보 수정 폼 */}
                  {editing === p.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={10} className="px-4 py-4">
                        <form action={updateProduct} className="grid gap-3 sm:grid-cols-2">
                          <input type="hidden" name="id" value={p.id} />
                          <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                            제품명 *
                            <input name="name" required defaultValue={p.name} className={inputCls + " mt-1"} />
                          </label>
                          <label className="text-xs font-medium text-slate-600">
                            카테고리
                            <input name="category" defaultValue={p.category ?? ""} className={inputCls + " mt-1"} />
                          </label>
                          <label className="text-xs font-medium text-slate-600">
                            상세페이지 URL
                            <input name="detail_url" defaultValue={p.detail_url ?? ""} className={inputCls + " mt-1"} />
                          </label>
                          <label className="text-xs font-medium text-slate-600">
                            정상판매가
                            <input name="normal_price" inputMode="numeric" defaultValue={p.normal_price ?? ""} className={inputCls + " mt-1"} />
                          </label>
                          <label className="text-xs font-medium text-slate-600">
                            기본 공급가
                            <input name="supply_price" inputMode="numeric" defaultValue={p.supply_price ?? ""} className={inputCls + " mt-1"} />
                          </label>
                          <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                            소구점
                            <input name="selling_point" defaultValue={p.selling_point ?? ""} className={inputCls + " mt-1"} />
                          </label>
                          <label className="text-xs font-medium text-slate-600 sm:col-span-2">
                            주의사항
                            <input name="caution" defaultValue={p.caution ?? ""} className={inputCls + " mt-1"} />
                          </label>
                          <div className="sm:col-span-2">
                            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                              저장
                            </button>
                            <span className="ml-2 text-xs text-slate-400">옵션별 가격·SKU는 [상세] 또는 엑셀 일괄 등록으로 수정하세요.</span>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}

                  {/* 옵션 행(펼쳤을 때) — 가격 + 재고 + 재고 수정 */}
                  {isOpen &&
                    p.options.map((o) => {
                      const olow = o.avail <= 10;
                      return (
                        <tr key={o.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-2 py-2" />
                          <td className="px-4 py-2 pl-10">
                            {o.option_key && (
                              <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">{o.option_key}</span>
                            )}
                            <span className="text-slate-600">{o.name}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-500">{won(o.normal_price)}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium text-indigo-700">{won(o.gonggu_price)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-500">{won(o.supply_price)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{qty(o.inQ)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{qty(o.soldQ)}</td>
                          <td className="px-3 py-2 text-right">
                            <form action={setStockLevel} className="inline-flex items-center justify-end gap-1">
                              <input type="hidden" name="product_option_id" value={o.id} />
                              <input
                                name="target"
                                inputMode="numeric"
                                defaultValue={o.avail}
                                className={
                                  "w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-sm font-semibold tabular-nums outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 " +
                                  (olow ? "text-rose-600" : "text-emerald-600")
                                }
                              />
                              <button type="submit" className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                                저장
                              </button>
                            </form>
                          </td>
                          <td className="px-3 py-2">
                            <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + (olow ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
                              {olow ? "부족" : "충분"}
                            </span>
                          </td>
                          <td className="px-3 py-2" />
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        가용 = 입고 − 판매(주문 업로드에서 자동 차감). 제품명을 누르면 옵션이 펼쳐지고, 가용 숫자를 고쳐 [저장]하면 재고가 그 값으로 맞춰집니다.
      </p>
    </div>
  );
}
