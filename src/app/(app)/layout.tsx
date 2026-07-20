import Link from "next/link";
import { BrandMark, Nav } from "@/components/shell/Nav";
import { StockSearch } from "@/components/shell/StockSearch";
import { DeltaColorPicker } from "@/components/theme/DeltaColorPicker";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { LATEST_DATE } from "@/lib/mock/prices";

/**
 * App shell。側欄在 md 以上固定，行動版收合為頂部橫向導覽。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col md:flex-row">
      {/* 側欄 — 桌機 */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border md:flex">
        <div className="sticky top-0 flex h-[100dvh] flex-col gap-6 p-3">
          <BrandMark />
          <Nav />
          <div className="mt-auto flex flex-col gap-2 px-2.5">
            <div className="flex items-center gap-1.5">
              <span
                className="pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-down"
                aria-hidden
              />
              <span className="num text-[0.6875rem] text-faint">
                資料更新 {LATEST_DATE}
              </span>
            </div>
            <Disclaimer variant="footer" className="text-[0.625rem]" />
          </div>
        </div>
      </aside>

      {/* 頂欄 — 行動版導覽 + 全域搜尋 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg/85 px-4 py-2.5 backdrop-blur-md">
          <div className="md:hidden">
            <BrandMark />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <StockSearch />
            <DeltaColorPicker />
          </div>
        </header>

        <div className="md:hidden">
          <div className="border-b border-border px-2 py-2">
            <Nav />
          </div>
        </div>

        <main className="min-w-0 flex-1">{children}</main>

        <footer className="border-t border-border px-4 py-6 md:px-8">
          <div className="flex flex-col gap-3">
            <Disclaimer variant="footer" />
            <Link
              href="/"
              className="w-fit text-xs text-faint transition-colors hover:text-muted"
            >
              關於本工具
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
