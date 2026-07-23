"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: { href: string; label: string; icon: string }[] = [
  { href: "/dashboard", label: "대시보드", icon: "▤" },
  { href: "/group-buys", label: "공구", icon: "▥" },
  { href: "/messages", label: "메시지", icon: "✉" },
  { href: "/products", label: "제품", icon: "▧" },
  { href: "/inventory", label: "재고", icon: "▦" },
  { href: "/sellers", label: "셀러", icon: "◍" },
  { href: "/vendors", label: "벤더", icon: "◒" },
  { href: "/samples", label: "샘플", icon: "◈" },
];

export function Sidebar({
  unreadMessages = 0,
  pendingGuests = 0,
}: {
  unreadMessages?: number;
  pendingGuests?: number;
}) {
  const pathname = usePathname();

  const badgeFor = (href: string) => {
    if (href === "/messages") return unreadMessages;
    return 0;
  };

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-3 sm:block">
      <div className="mb-3 flex items-center gap-2 px-2 py-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
          공
        </div>
        <span className="font-semibold text-slate-900">공구허브</span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const badge = badgeFor(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition " +
                (active
                  ? "bg-indigo-50 font-semibold text-indigo-700"
                  : "text-slate-700 hover:bg-slate-50")
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
          className="mt-4 block rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
        >
          승인 대기 {pendingGuests}명 →
        </Link>
      )}
    </aside>
  );
}
