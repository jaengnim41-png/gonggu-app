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
  revenue: number;
  products: string[];
  sellers: string[];
  vendors: string[];
};

type Period = "all" | "week" | "month" | "year";
const PERIOD_LABEL: Record<Period, string> = { all: "전체 기간", week: "주간", month: "월간", year: "연간" };

/** 상태 묶음 필터 */
const STATUS_GROUPS: { label: string; match: string[] }[] = [
  { label: "전체", match: [] },
  { label: "준비중", match: ["제안접수", "제안서전달", "조건협의", "셀러승인", "샘플발송", "콘텐츠제작"] },
  { label: "진행중", match: ["공구오픈", "진행중"] },
  { label: "정산", match: ["공구종료", "정산대기", "최종정산"] },
  { label: "완료", match: ["완료"] },
];
function won(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function statusClass(s: string) {
  if (s.includes("진행중")) return "bg-indigo-50 text-indigo-700";
  if (s.includes("정산")) return "bg-amber-50 text-amber-700";
  if (s.includes("완료") || s.includes("종료")) return "bg-slate-100 text-slate-600";
  return "bg-emerald-50 text-emerald-700";
}

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 기준일(anchor)과 단위로 [시작, 끝] 범위 + 사람이 읽는 라벨을 만든다 */
function rangeOf(p: Period, anchor: Date): { from: string; to: string; label: string } | null {
  if (p === "all") return null;
  const y = anchor.getFullYear();
  if (p === "year") {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}년` };
  }
  if (p === "month") {
    const m = anchor.getMonth();
    return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: `${y}년 ${m + 1}월` };
  }
  // week: 월~일
  const day = (anchor.getDay() + 6) % 7;
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() - day);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return { from: iso(mon), to: iso(sun), label: `${mon.getFullYear()}년 ${fmt(mon)}~${fmt(sun)}` };
}

/** anchor를 단위만큼 이동 */
function shift(anchor: Date, p: Period, dir: number): Date {
  const d = new Date(anchor);
  if (p === "week") d.setDate(d.getDate() + dir * 7);
  else if (p === "month") d.setMonth(d.getMonth() + dir);
  else if (p === "year") d.setFullYear(d.getFullYear() + dir);
  return d;
}

export function GroupBuyFilter({
  rows,
  products,
  sellers,
  vendors,
  initialStatus = "",
  initialProduct = "",
  initialSeller = "",
  initialVendor = "",
}: {
  rows: GBRow[];
  products: string[];
  sellers: string[];
  vendors: string[];
  initialStatus?: string;
  initialProduct?: string;
  initialSeller?: string;
  initialVendor?: string;
}) {
  const [period, setPeriod] = useState<Period>("all");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [statusGroup, setStatusGroup] = useState(
    STATUS_GROUPS.some((g) => g.label === initialStatus) ? initialStatus : "전체"
  );
  const [product, setProduct] = useState(initialProduct);
  const [seller, setSeller] = useState(initialSeller);
  const [vendor, setVendor] = useState(initialVendor);

  const range = rangeOf(period, anchor);
  const statusMatch = STATUS_GROUPS.find((g) => g.label === statusGroup)?.match ?? [];
  const filtered = rows.filter((g) => {
    if (range) {
      const d = g.start_date ?? g.end_date;
      if (!d || d < range.from || d > range.to) return false;
    }
    if (statusMatch.length && !statusMatch.some((m) => g.status.includes(m))) return false;
    if (product && !g.products.includes(product)) return false;
    if (seller && !g.sellers.includes(seller)) return false;
    if (vendor && !g.vendors.includes(vendor)) return false;
    return true;
  });
  const totalRevenue = filtered.reduce((s, g) => s + g.revenue, 0);

  const selCls = "rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm";
  const isToday = (() => {
    const r = rangeOf(period, new Date());
    return range && r && range.from === r.from;
  })();

  return (
    <div>
      {/* 상태 필터 */}
      <div className="mb-3 flex flex-wrap gap-2">
        {STATUS_GROUPS.map((g) => (
          <button
            key={g.label}
            type="button"
            onClick={() => setStatusGroup(g.label)}
            className={
              "rounded-full px-3 py-1.5 text-sm font-medium transition " +
              (statusGroup === g.label ? "bg-indigo-600 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50")
            }
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-1">
          {(["all", "week", "month", "year"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setPeriod(p); setAnchor(new Date()); }}
              className={
                "rounded-md px-2.5 py-1 text-xs " +
                (period === p ? "bg-indigo-600 font-semibold text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50")
              }
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>

        {/* 기간 이동 · 표시 */}
        {range && (
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1">
            <button type="button" onClick={() => setAnchor(shift(anchor, period, -1))} className="rounded px-1.5 text-slate-500 hover:bg-white hover:text-slate-800" title="이전">‹</button>
            <span className="min-w-28 text-center text-sm font-semibold text-slate-800">{range.label}</span>
            <button type="button" onClick={() => setAnchor(shift(anchor, period, 1))} className="rounded px-1.5 text-slate-500 hover:bg-white hover:text-slate-800" title="다음">›</button>
            {!isToday && (
              <button type="button" onClick={() => setAnchor(new Date())} className="ml-1 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50">오늘</button>
            )}
          </div>
        )}

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
        {(period !== "all" || statusGroup !== "전체" || product || seller || vendor) && (
          <button
            type="button"
            onClick={() => { setPeriod("all"); setAnchor(new Date()); setStatusGroup("전체"); setProduct(""); setSeller(""); setVendor(""); }}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            초기화
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {filtered.length}건 · 매출 <span className="font-semibold text-slate-700">{won(totalRevenue)}</span>
        </span>
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
                  <th className="px-4 py-3 text-right">매출</th>
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
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{g.revenue ? won(g.revenue) : "—"}</td>
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
