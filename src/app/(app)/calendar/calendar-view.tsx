"use client";

import { useState } from "react";
import Link from "next/link";

export type CalEntry = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  products: string[];
  sellers: string[];
  vendors: string[];
};

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function statusColor(s: string) {
  if (s.includes("진행중") || s.includes("공구오픈")) return "bg-indigo-100 text-indigo-800 border-indigo-200";
  if (s.includes("정산") || s.includes("종료")) return "bg-amber-100 text-amber-800 border-amber-200";
  if (s.includes("완료")) return "bg-slate-100 text-slate-600 border-slate-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function CalendarView({ entries }: { entries: CalEntry[] }) {
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [picked, setPicked] = useState<string | null>(null);

  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  // 달력 격자: 첫 주 월요일부터 마지막 주 일요일까지
  const startPad = (first.getDay() + 6) % 7; // 월=0
  const gridStart = new Date(year, month, 1 - startPad);
  const cells: Date[] = [];
  const cur = new Date(gridStart);
  while (cur <= last || cells.length % 7 !== 0) {
    cells.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
    if (cells.length > 42) break;
  }

  // 날짜별 공구: 시작일~종료일 사이 모든 날에 표시(기간이 없으면 시작일에만)
  const byDay = new Map<string, CalEntry[]>();
  for (const e of entries) {
    const start = e.start_date ?? e.end_date;
    if (!start) continue;
    const end = e.end_date ?? e.start_date ?? start;
    const d = new Date(start + "T00:00:00");
    const endD = new Date(end + "T00:00:00");
    let guard = 0;
    while (d <= endD && guard < 400) {
      const k = iso(d);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(e);
      d.setDate(d.getDate() + 1);
      guard++;
    }
  }

  const todayIso = iso(new Date());
  const monthLabel = `${year}년 ${month + 1}월`;
  const shift = (dir: number) => setAnchor(new Date(year, month + dir, 1));

  const pickedEntries = picked ? (byDay.get(picked) ?? []) : [];

  return (
    <div>
      {/* 상단 이동 바 */}
      <div className="mb-4 flex items-center gap-2">
        <button type="button" onClick={() => shift(-1)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50" title="이전 달">‹</button>
        <span className="min-w-28 text-center text-base font-bold text-slate-900">{monthLabel}</span>
        <button type="button" onClick={() => shift(1)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50" title="다음 달">›</button>
        <button type="button" onClick={() => setAnchor(new Date())} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">오늘</button>
        <span className="ml-auto text-xs text-slate-400">막대를 누르면 상세 · 날짜를 누르면 그날 공구 전체</span>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-t-xl border border-slate-200 bg-slate-200 text-center text-xs font-semibold text-slate-500">
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={"bg-slate-50 py-2 " + (i === 5 ? "text-blue-500" : i === 6 ? "text-rose-500" : "")}>{w}</div>
        ))}
      </div>

      {/* 날짜 격자 */}
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-b-xl border-x border-b border-slate-200 bg-slate-200">
        {cells.map((d) => {
          const k = iso(d);
          const inMonth = d.getMonth() === month;
          const list = byDay.get(k) ?? [];
          const isToday = k === todayIso;
          const dow = (d.getDay() + 6) % 7;
          return (
            <div key={k} className={"min-h-24 bg-white p-1.5 " + (inMonth ? "" : "bg-slate-50/60")}>
              <button
                type="button"
                onClick={() => list.length && setPicked(k)}
                className={
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs " +
                  (isToday ? "bg-indigo-600 font-bold text-white" : (inMonth ? (dow === 6 ? "text-rose-500" : dow === 5 ? "text-blue-500" : "text-slate-700") : "text-slate-300")) +
                  (list.length ? " cursor-pointer hover:bg-slate-100" : " cursor-default")
                }
              >
                {d.getDate()}
              </button>
              <div className="space-y-1">
                {list.slice(0, 3).map((e) => (
                  <Link
                    key={e.id + k}
                    href={`/group-buys/${e.id}`}
                    className={"block truncate rounded border px-1.5 py-0.5 text-[10px] font-medium leading-tight " + statusColor(e.status)}
                    title={`${e.title}${e.sellers.length ? " · " + e.sellers.join(",") : ""}`}
                  >
                    {e.title}
                    {(e.sellers[0] || e.products[0]) && (
                      <span className="ml-0.5 font-normal opacity-70">
                        {e.sellers[0] ? ` ${e.sellers[0]}` : e.products[0] ? ` ${e.products[0]}` : ""}
                      </span>
                    )}
                  </Link>
                ))}
                {list.length > 3 && (
                  <button type="button" onClick={() => setPicked(k)} className="w-full text-left text-[10px] text-slate-400 hover:text-indigo-600">
                    +{list.length - 3}건 더
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 날짜 클릭 시 그날 공구 전체 */}
      {picked && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setPicked(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">{picked} 공구 ({pickedEntries.length})</h3>
              <button type="button" onClick={() => setPicked(null)} className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100">✕</button>
            </div>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {pickedEntries.map((e) => (
                <li key={e.id}>
                  <Link href={`/group-buys/${e.id}`} className="block rounded-lg border border-slate-200 p-3 hover:border-indigo-300 hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{e.title}</span>
                      <span className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold " + statusColor(e.status)}>{e.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {e.start_date ?? "—"} ~ {e.end_date ?? "—"}
                      {e.products.length > 0 && <span className="ml-2">· {e.products.join(", ")}</span>}
                    </p>
                    {(e.sellers.length > 0 || e.vendors.length > 0) && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {e.sellers.length > 0 && <span>셀러 {e.sellers.join(", ")}</span>}
                        {e.sellers.length > 0 && e.vendors.length > 0 && <span className="text-slate-300"> · </span>}
                        {e.vendors.length > 0 && <span className="text-violet-600">벤더 {e.vendors.join(", ")}</span>}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
