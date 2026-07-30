"use client";

import { useState } from "react";
import Link from "next/link";

export type ScheduleEntry = {
  id: string;
  title: string;
  date: string | null; // 공구 시작일(YYYY-MM-DD)
  status: string;
  products: string[];
  sellers: string[];
  vendors: string[];
};

type Unit = "week" | "month" | "year";
const UNIT_LABEL: Record<Unit, string> = { week: "주간", month: "월간", year: "연간" };

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 기준일(anchor)·단위로 [시작,끝]+라벨 */
function rangeOf(unit: Unit, anchor: Date): { from: string; to: string; label: string } {
  const y = anchor.getFullYear();
  if (unit === "year") return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}년` };
  if (unit === "month") {
    const m = anchor.getMonth();
    return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: `${y}년 ${m + 1}월` };
  }
  const day = (anchor.getDay() + 6) % 7;
  const mon = new Date(anchor);
  mon.setDate(anchor.getDate() - day);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  return { from: iso(mon), to: iso(sun), label: `${mon.getFullYear()}년 ${fmt(mon)}~${fmt(sun)}` };
}
function shiftDate(anchor: Date, unit: Unit, dir: number): Date {
  const d = new Date(anchor);
  if (unit === "week") d.setDate(d.getDate() + dir * 7);
  else if (unit === "month") d.setMonth(d.getMonth() + dir);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
}

function countBy(entries: ScheduleEntry[], pick: (e: ScheduleEntry) => string[]) {
  const m = new Map<string, number>();
  for (const e of entries) {
    for (const name of pick(e)) m.set(name, (m.get(name) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function ScheduleSummary({ entries }: { entries: ScheduleEntry[] }) {
  const [unit, setUnit] = useState<Unit>("month");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const { from, to, label } = rangeOf(unit, anchor);
  const isNow = from === rangeOf(unit, new Date()).from;

  const inRange = entries.filter((e) => e.date && e.date >= from && e.date <= to);
  const byProduct = countBy(inRange, (e) => e.products);
  const bySeller = countBy(inRange, (e) => e.sellers);
  const byVendor = countBy(inRange, (e) => e.vendors);

  const Panel = ({ title, rows, empty }: { title: string; rows: [string, number][]; empty: string }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {rows.map(([name, n]) => (
            <li key={name} className="flex items-center justify-between text-sm">
              <span className="truncate text-slate-700">{name}</span>
              <span className="ml-2 shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                {n}회
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900">공구 일정 집계</h2>
          <p className="text-xs text-slate-500">고른 기간에 시작하는 공구를 제품·셀러·벤더별로 셉니다.</p>
        </div>
        <div className="flex gap-1">
          {(["week", "month", "year"] as Unit[]).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => { setUnit(u); setAnchor(new Date()); }}
              className={
                "rounded-md px-2.5 py-1 text-xs " +
                (unit === u ? "bg-indigo-600 font-semibold text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50")
              }
            >
              {UNIT_LABEL[u]}
            </button>
          ))}
        </div>
      </div>

      {/* 기간 이동 · 표시 */}
      <div className="mt-2 flex items-center gap-1">
        <button type="button" onClick={() => setAnchor(shiftDate(anchor, unit, -1))} className="rounded px-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="이전">‹</button>
        <span className="min-w-32 text-center text-sm font-semibold text-slate-800">{label}</span>
        <button type="button" onClick={() => setAnchor(shiftDate(anchor, unit, 1))} className="rounded px-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800" title="다음">›</button>
        {!isNow && (
          <button type="button" onClick={() => setAnchor(new Date())} className="ml-1 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50">오늘</button>
        )}
        <span className="ml-2 text-xs text-slate-400">{from} ~ {to} · 공구 {inRange.length}건</span>
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Panel title="제품별" rows={byProduct} empty="이 기간 공구 없음" />
        <Panel title="셀러별" rows={bySeller} empty="연결된 셀러 없음" />
        <Panel title="벤더별" rows={byVendor} empty="연결된 벤더 없음" />
      </div>

      {inRange.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label} 공구 목록</h3>
          <ul className="mt-2 divide-y divide-slate-100">
            {inRange
              .slice()
              .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
              .map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/group-buys/${e.id}`} className="truncate font-medium text-slate-800 hover:text-indigo-600">
                    {e.title}
                  </Link>
                  <span className="ml-2 shrink-0 text-xs text-slate-400">{e.date}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
