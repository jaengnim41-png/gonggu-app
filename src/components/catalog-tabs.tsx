"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/products", label: "카탈로그", hint: "제품·옵션·가격" },
  { href: "/inventory", label: "재고", hint: "입고·판매·가용" },
];

/** 제품·재고 섹션 상단의 서브탭. 카탈로그 ↔ 재고 전환 */
export function CatalogTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-1 border-b border-slate-200">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "flex items-baseline gap-1.5 border-b-2 px-3 py-2.5 text-sm transition " +
              (active
                ? "border-indigo-600 font-semibold text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800")
            }
          >
            {t.label}
            <span className="text-[11px] text-slate-400">{t.hint}</span>
          </Link>
        );
      })}
    </div>
  );
}
