"use client";

import { useState } from "react";
import { setStockLevel } from "./actions";

export type StockGroup = {
  productId: string;
  name: string;
  options: { id: string; name: string; option_key: string | null; inQ: number; soldQ: number; avail: number }[];
  totalIn: number;
  totalSold: number;
  totalAvail: number;
};

function qty(n: number) {
  return n.toLocaleString("ko-KR");
}

export function StockTable({ groups }: { groups: StockGroup[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const allOpen = groups.length > 0 && groups.every((g) => open[g.productId]);

  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));
  const setAll = (v: boolean) => setOpen(Object.fromEntries(groups.map((g) => [g.productId, v])));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900">재고 현황</h2>
        <button
          type="button"
          onClick={() => setAll(!allOpen)}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          {allOpen ? "모두 접기" : "모두 펼치기"}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {groups.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400">등록된 제품 옵션이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">제품 / 옵션</th>
                <th className="px-4 py-3 text-right">입고</th>
                <th className="px-4 py-3 text-right">판매</th>
                <th className="px-4 py-3 text-right">가용</th>
                <th className="px-4 py-3">상태</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isOpen = !!open[g.productId];
                const low = g.totalAvail <= 10;
                return (
                  <GroupRows
                    key={g.productId}
                    g={g}
                    isOpen={isOpen}
                    low={low}
                    onToggle={() => toggle(g.productId)}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">
        가용 = 입고 − 판매(전체 주문 업로드에서 자동 차감). 제품명을 누르면 옵션별로 펼쳐지고,
        가용 숫자를 고쳐 [저장]하면 현재 재고가 그 값으로 맞춰집니다.
      </p>
    </div>
  );
}

function GroupRows({
  g,
  isOpen,
  low,
  onToggle,
}: {
  g: StockGroup;
  isOpen: boolean;
  low: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* 대분류 요약 행 */}
      <tr className="border-b border-slate-100 bg-slate-50/60 last:border-0">
        <td className="px-4 py-3">
          <button type="button" onClick={onToggle} className="flex items-center gap-2 text-left font-semibold text-slate-900">
            <span className="inline-block w-3 text-slate-400">{isOpen ? "▾" : "▸"}</span>
            {g.name}
            <span className="text-xs font-normal text-slate-400">옵션 {g.options.length}</span>
          </button>
        </td>
        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{qty(g.totalIn)}</td>
        <td className="px-4 py-3 text-right tabular-nums text-slate-600">{qty(g.totalSold)}</td>
        <td className={"px-4 py-3 text-right font-bold tabular-nums " + (low ? "text-rose-600" : "text-emerald-600")}>
          {qty(g.totalAvail)}
        </td>
        <td className="px-4 py-3">
          <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + (low ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
            {low ? "부족" : "충분"}
          </span>
        </td>
      </tr>

      {/* 옵션 행(펼쳤을 때만) */}
      {isOpen &&
        g.options.map((o) => {
          const olow = o.avail <= 10;
          return (
            <tr key={o.id} className="border-b border-slate-100 last:border-0">
              <td className="px-4 py-2.5 pl-10">
                {o.option_key && (
                  <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-500">
                    {o.option_key}
                  </span>
                )}
                <span className="text-slate-600">{o.name}</span>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">{qty(o.inQ)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{qty(o.soldQ)}</td>
              <td className="px-4 py-2.5 text-right">
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
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    저장
                  </button>
                </form>
              </td>
              <td className="px-4 py-2.5">
                <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + (olow ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
                  {olow ? "부족" : "충분"}
                </span>
              </td>
            </tr>
          );
        })}
    </>
  );
}
