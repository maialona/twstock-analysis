"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLineUp,
  FunnelSimple,
  Bookmark,
  SquaresFour,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/format";

const ITEMS = [
  { href: "/dashboard", label: "市場概況", Icon: SquaresFour },
  { href: "/screener", label: "選股篩選", Icon: FunnelSimple },
  { href: "/watchlist", label: "追蹤清單", Icon: Bookmark },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav aria-label="主導覽" className="flex flex-col gap-0.5">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded px-2.5 py-2 text-sm",
              "transition-colors duration-150",
              active
                ? "bg-raised text-text"
                : "text-muted hover:bg-surface hover:text-text",
            )}
          >
            <Icon size={17} weight={active ? "fill" : "regular"} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** 個股頁面的返回連結會用到 */
export function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2 px-2.5 py-1">
      <ChartLineUp size={18} weight="bold" className="text-accent" />
      <span className="text-sm font-semibold tracking-tight">測度</span>
    </Link>
  );
}
