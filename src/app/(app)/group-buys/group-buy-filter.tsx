"use client";

import { useState } from "react";
import Link from "next/link";

export type GBRow = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  itemCount: number;
  products: string[];
  sellers: string[];
  vendors: string[];
};

type Period = "all" | "week" | "month" | "year";
const PERIOD_LABEL: Record<Period, string> = { all: "전체 기간", week: "주간", month: "월간", year: "연간" };

function statusClass(s: string) {
  if (s.includes("진행중")) return "bg-indigo-50 text-indigo-700";
  if (s.includes("정산")) return "bg-amber-50 text-amber-700";
  if (s.includes("완료") || s.includes("종료")) return "bg-slate-100 text-slate-600";
  return "bg-emerald-50 text-emerald-700";
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function rangeOf(p: Period): [string, string] | null {
  if (p === "all") return null;
  const now = new Date();
  const y = now.getFullYear();
  if (p === "year") return [`${y}-01-01`, `${y}-12-31`];
  if (p === "month") return [iso(new Date(y, now.getMonth(), 1)), iso(new Date(y, now.getMonth() + 1, 0))];
  const day = (now.getDay() + 6) % 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - day);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return [iso(mon), iso(sun)];
}

export function GroupBuyFilter({
  rows,
  products,
  sellers,
  vendors,
}: {
  rows: GBRow[];
  products: string[];
  sellers: string[];
  vendors: string[];
}) {
  const [period, setPeriod] = useState<Period>("all");
  const [product, setProduct] = useState("");
  const [seller, setSeller] = useState("");
  const [vendor, setVendor] = useState("");

  const range = rangeOf(period);
  const filtered = rows.filter((g) => {
    if (range) {
      const d = g.start_date ?? g.end_date;
      if (!d || d < range[0] || d > range[1]) return false;
    }
    if (product && !g.products.includes(product)) return false;
    if (seller && !g.sellers.includes(seller)) return false;
    if (vendor && !g.vendors.includes(vendor)) return false;
    return true;
  });

  const selCls = "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm";

  return (
    <div>
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-1">
          {(["all", "week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={
                "rounded-md px-2.5 py-1 text-xs " +
                (period === p ? "bg-indigo-600 font-semibold text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50")
              }
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <select value={product} onChange={(e) => setProduct(e.target.value)} className={selCls}>
          <option value="">제품 전체</option>
          {products.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={seller} onChange={(e) => setSeller(e.target.value)} className={selCls}>
          <option value="">셀러 전체</option>
          {sellers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={vendor} onChange={(e) => setVendor(e.target.value)} className={selCls}>
          <option value="">벤더 전체</option>
          {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        {(period !== "all" || product || seller || vendor) && (
          <button
            type="button"
            onClick={() => { setPeriod("all"); setProduct(""); setSeller(""); setVendor(""); }}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            초기화
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">{filtered.length}건</span>
      </div>

      {/* 목록 */}
      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-slate-400">조건에 맞는 공구가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">공구명</th>
                  <th className="px-4 py-3">기간</th>
                  <th className="px-4 py-3">제품</th>
                  <th className="px-4 py-3">셀러 / 벤더</th>
                  <th className="px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/group-buys/${g.id}`} className="font-medium text-slate-900 hover:text-indigo-700 hover:underline">
                        {g.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {g.start_date ?? "—"} ~ {g.end_date ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {g.products.length ? g.products.join(", ") : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {[...g.sellers, ...g.vendors].length ? (
                        <>
                          {g.sellers.length > 0 && <span>{g.sellers.join(", ")}</span>}
                          {g.sellers.length > 0 && g.vendors.length > 0 && <span className="text-slate-300"> · </span>}
                          {g.vendors.length > 0 && <span className="text-violet-600">{g.vendors.join(", ")}</span>}
                        </>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + statusClass(g.status)}>{g.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
