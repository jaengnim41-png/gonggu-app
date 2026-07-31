export type NavItem = { href: string; label: string; icon: string; match?: string[] };

/** 사이드바·모바일 메뉴 공용 항목 */
export const NAV: NavItem[] = [
  { href: "/dashboard", label: "대시보드", icon: "▤" },
  { href: "/group-buys", label: "공구", icon: "▥" },
  { href: "/messages", label: "메시지", icon: "✉" },
  { href: "/products", label: "제품·재고", icon: "▧", match: ["/products", "/inventory"] },
  { href: "/sellers", label: "셀러", icon: "◍" },
  { href: "/vendors", label: "벤더", icon: "◒" },
  { href: "/samples", label: "샘플", icon: "◈" },
  { href: "/proposals", label: "제안서", icon: "▤" },
];

export function isActive(pathname: string, item: NavItem): boolean {
  const targets = item.match ?? [item.href];
  return targets.some((t) => pathname === t || pathname.startsWith(t + "/"));
}
