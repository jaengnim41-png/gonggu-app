"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, isActive } from "./nav-items";

/** 모바일 전용 햄버거 메뉴 + 서랍(drawer). 데스크톱(sm 이상)에서는 숨김. */
export function MobileNav({
  unreadMessages = 0,
  pendingGuests = 0,
}: {
  unreadMessages?: number;
  pendingGuests?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // 경로가 바뀌면(메뉴 눌러 이동) 서랍을 닫는다
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700"
      >
        <span className="text-lg leading-none">☰</span>
        {(unreadMessages > 0 || pendingGuests > 0) && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
        )}
      </button>

      {open && (
        <>
          {/* 어두운 배경 */}
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          {/* 서랍 */}
          <div className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white p-3 shadow-xl">
            <div className="mb-3 flex items-center gap-2 px-2 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                공
              </div>
              <span className="font-semibold text-slate-900">공구허브</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="ml-auto rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {NAV.map((item) => {
                const active = isActive(pathname, item);
                const badge = item.href === "/messages" ? unreadMessages : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition " +
                      (active ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-700 hover:bg-slate-50")
                    }
                  >
                    <span className="w-4 text-center opacity-80">{item.icon}</span>
                    {item.label}
                    {badge > 0 && (
                      <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {pendingGuests > 0 && (
              <Link
                href="/guests"
                onClick={() => setOpen(false)}
                className="mt-4 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                승인 대기 {pendingGuests}명 →
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
