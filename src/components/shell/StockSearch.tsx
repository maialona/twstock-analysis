"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { COMPANIES } from "@/lib/data/companies";
import { cn } from "@/lib/format";

/**
 * 個股快速搜尋。純 client、無網路請求 —
 * 之後接上 API 時只需替換 filter 來源。
 */

export function StockSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return COMPANIES.filter(
      (c) =>
        c.stockId.includes(q) ||
        c.companyName.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q),
    ).slice(0, 6);
  }, [query]);

  function go(stockId: string) {
    setQuery("");
    setOpen(false);
    router.push(`/stock/${stockId}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (c + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (c - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[cursor].stockId);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative w-full max-w-xs">
      <label htmlFor="stock-search" className="sr-only">
        搜尋股票代號或公司名稱
      </label>
      <div className="flex items-center gap-2 rounded border border-border bg-surface px-2.5 py-1.5 focus-within:border-accent">
        <MagnifyingGlass size={14} className="shrink-0 text-faint" />
        <input
          id="stock-search"
          type="search"
          value={query}
          placeholder="代號或公司名稱"
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setCursor(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-sm text-text outline-none placeholder:text-faint"
        />
      </div>

      {open && query.trim() !== "" && (
        <ul
          role="listbox"
          aria-label="搜尋結果"
          className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded border border-border bg-raised shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2.5 text-xs text-faint">
              找不到符合「{query}」的個股。試試代號如 2330，或公司名稱關鍵字。
            </li>
          ) : (
            results.map((c, i) => (
              <li key={c.stockId} role="option" aria-selected={i === cursor}>
                <button
                  type="button"
                  onMouseDown={() => {
                    if (blurTimer.current) clearTimeout(blurTimer.current);
                  }}
                  onClick={() => go(c.stockId)}
                  onMouseEnter={() => setCursor(i)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-sm",
                    i === cursor ? "bg-surface" : "",
                  )}
                >
                  <span className="num w-11 shrink-0 text-accent">
                    {c.stockId}
                  </span>
                  <span className="truncate text-text">{c.companyName}</span>
                  <span className="ml-auto shrink-0 text-xs text-faint">
                    {c.industry}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
