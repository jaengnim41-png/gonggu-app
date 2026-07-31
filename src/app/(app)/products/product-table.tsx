"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { updateProduct, deleteProduct, moveProduct } from "./actions";
import { ConfirmButton } from "@/components/confirm-button";

export type ProductRow = {
  id: string;
  name: string;
  category: string | null;
  detail_url: string | null;
  normal_price: number | null;
  supply_price: number | null;
  selling_point: string | null;
  caution: string | null;
  optionCount: number;
};

function won(n: number | null) {
  return n == null ? "—" : "₩" + n.toLocaleString("ko-KR");
}

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function ProductTable({ products }: { products: ProductRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-2 py-3 text-center">순서</th>
            <th className="px-4 py-3">제품명</th>
            <th className="px-4 py-3">카테고리</th>
            <th className="px-4 py-3 text-right">정상가</th>
            <th className="px-4 py-3 text-right">옵션</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <Fragment key={p.id}>
              <tr className="border-b border-slate-100 last:border-0">
                <td className="px-2 py-3">
                  <div className="flex flex-col items-center gap-0.5">
                    <form action={moveProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value="up" />
                      <button
                        type="submit"
                        disabled={i === 0}
                        title="위로"
                        className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      >
                        ▲
                      </button>
                    </form>
                    <form action={moveProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="dir" value="down" />
                      <button
                        type="submit"
                        disabled={i === products.length - 1}
                        title="아래로"
                        className="rounded px-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </form>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/products/${p.id}`}
                    className="font-medium text-slate-900 hover:text-indigo-700 hover:underline"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{p.category ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{won(p.normal_price)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.optionCount}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditing(editing === p.id ? null : p.id)}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-300 hover:text-indigo-600"
                    >
                      {editing === p.id ? "닫기" : "수정"}
                    </button>
                    <form action={deleteProduct}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton
                        message={`'${p.name}' 제품을 삭제할까요? 하위 옵션도 함께 지워집니다.`}
                        className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600"
                      >
                        삭제
                      </ConfirmButton>
                    </form>
                  </div>
                </td>
              </tr>

              {editing === p.id && (
                <tr className="bg-slate-50">
                  <td colSpan={6} className="px-4 py-4">
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
                        <button
                          type="submit"
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                        >
                          저장
                        </button>
                        <span className="ml-2 text-xs text-slate-400">
                          옵션별 가격·SKU는 제품명을 눌러 옵션 화면에서, 또는 엑셀 일괄 등록으로 수정하세요.
                        </span>
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
  );
}
