"use client";

import { useState } from "react";
import { setOptionPrice, setOptionPricesBulk } from "../actions";

export type SalesRow = {
  optionInfo: string;
  itemId: string;
  qty: number;
  amount: number;
  unit: number;
  overrideGonggu: number | null;
  overrideMargin: number | null;
  hasOverride: boolean;
};

function won(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

export function SalesTable({
  groupBuyId,
  rows,
  totalQty,
  totalAmount,
}: {
  groupBuyId: string;
  rows: SalesRow[];
  totalQty: number;
  totalAmount: number;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const selectable = rows.filter((r) => r.itemId);
  const selectedKeys = selectable.filter((r) => checked[r.optionInfo]);
  const allChecked = selectable.length > 0 && selectedKeys.length === selectable.length;

  const toggleAll = () => {
    if (allChecked) setChecked({});
    else setChecked(Object.fromEntries(selectable.map((r) => [r.optionInfo, true])));
  };
  const toggleOne = (opt: string) =>
    setChecked((c) => ({ ...c, [opt]: !c[opt] }));

  return (
    <>
      {/* 선택 항목 일괄 적용 */}
      <form
        action={setOptionPricesBulk}
        className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4"
      >
        <input type="hidden" name="group_buy_id" value={groupBuyId} />
        {selectedKeys.map((r) => (
          <input
            key={r.optionInfo}
            type="hidden"
            name="target"
            value={JSON.stringify([r.itemId, r.optionInfo])}
          />
        ))}
        <div className="mr-2 text-sm font-semibold text-indigo-900">
          선택 {selectedKeys.length}개 일괄 적용
        </div>
        <label className="text-xs font-medium text-slate-600">
          공구가
          <input
            name="gonggu_price"
            inputMode="numeric"
            placeholder="예: 16900"
            className="mt-1 block w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          마진단가
          <input
            name="margin_unit"
            inputMode="numeric"
            placeholder="예: 4225"
            className="mt-1 block w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={selectedKeys.length === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          선택 항목에 적용
        </button>
        <span className="text-[11px] text-slate-500">
          둘 다 비우고 누르면 선택한 옵션의 개별단가가 해제됩니다.
        </span>
      </form>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    title="전체 선택"
                    className="h-4 w-4"
                  />
                </th>
                <th className="px-4 py-3">옵션</th>
                <th className="px-4 py-3 text-right">단가</th>
                <th className="px-4 py-3 text-right">수량</th>
                <th className="px-4 py-3 text-right">판매금액</th>
                <th className="px-4 py-3 text-right">단가 조정</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.optionInfo} className="border-b border-slate-100">
                  <td className="px-3 py-3">
                    {r.itemId ? (
                      <input
                        type="checkbox"
                        checked={!!checked[r.optionInfo]}
                        onChange={() => toggleOne(r.optionInfo)}
                        className="h-4 w-4"
                      />
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {r.optionInfo}
                    {r.hasOverride && (
                      <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        개별단가
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{won(r.unit)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.qty.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{won(r.amount)}</td>
                  <td className="px-4 py-3">
                    {r.itemId ? (
                      <form action={setOptionPrice} className="flex items-center justify-end gap-1">
                        <input type="hidden" name="group_buy_id" value={groupBuyId} />
                        <input type="hidden" name="group_buy_item_id" value={r.itemId} />
                        <input type="hidden" name="option_info" value={r.optionInfo} />
                        <input
                          name="gonggu_price"
                          inputMode="numeric"
                          defaultValue={r.overrideGonggu ?? ""}
                          placeholder="공구가"
                          className="w-20 rounded-md border border-slate-200 px-1.5 py-1 text-right text-xs"
                        />
                        <input
                          name="margin_unit"
                          inputMode="numeric"
                          defaultValue={r.overrideMargin ?? ""}
                          placeholder="마진"
                          className="w-16 rounded-md border border-slate-200 px-1.5 py-1 text-right text-xs"
                        />
                        <button className="rounded-md border border-slate-300 px-1.5 py-1 text-[10px] text-slate-600 hover:border-indigo-300 hover:text-indigo-600">
                          저장
                        </button>
                      </form>
                    ) : (
                      <span className="block text-right text-[11px] text-slate-400">직접 입력분</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50 font-bold text-indigo-900">
                <td className="px-3 py-3"></td>
                <td className="px-4 py-3">전체 수량 및 매출</td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right tabular-nums">{totalQty.toLocaleString("ko-KR")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{won(totalAmount)}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}
