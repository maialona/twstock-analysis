"use client";

import Link from "next/link";
import { X } from "@phosphor-icons/react/dist/ssr";
import { DeltaValue } from "@/components/data/DeltaValue";
import { Sparkline } from "@/components/data/Sparkline";
import { EmptyState } from "@/components/ui/states";
import { useWatchlist } from "@/lib/useWatchlist";
import {
  cn,
  deltaClass,
  formatNetLots,
  formatPct,
  formatPrice,
} from "@/lib/format";

/**
 * 一列所需的資料。由 server component 先算好整個收錄範圍再傳進來 ——
 * 追蹤的是哪幾檔存在 localStorage，只有 client 知道，
 * 但「每一檔長什麼樣」不必因此把整個 mock 資料層打包進 client bundle。
 */
export type WatchRow = {
  stockId: string;
  companyName: string;
  price: number;
  changePct: number;
  pe: number;
  roe: number;
  monthlyYoy: number | null;
  foreignNet: number;
  score: number;
  spark: number[];
};

export function WatchlistTable({ rows }: { rows: WatchRow[] }) {
  const { ids, remove, reset } = useWatchlist();
  const byId = new Map(rows.map((r) => [r.stockId, r]));
  // 依使用者的排列順序取，找不到的代號略過（收錄範圍可能已變動）
  const visible = ids.map((id) => byId.get(id)).filter((r) => r !== undefined);

  if (visible.length === 0) {
    return (
      <EmptyState
        title="追蹤清單是空的"
        description="到個股頁面按「加入追蹤」，或先套用預設清單看看這頁會呈現什麼。"
        action={
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded border border-border-strong px-2.5 py-1 text-xs transition-transform duration-150 active:scale-[0.97]"
          >
            套用預設清單
          </button>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[54rem] text-xs">
        <thead>
          <tr className="th-sticky border-b border-border text-left text-faint">
            <th scope="col" className="py-2 pr-3 font-medium">代號</th>
            <th scope="col" className="py-2 pr-3 font-medium">名稱</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">收盤</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">漲跌幅</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">本益比</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">ROE</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">最新月營收 YoY</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">外資 5 日</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">分數</th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">近 60 日</th>
            <th scope="col" className="w-8 py-2">
              <span className="sr-only">移除</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {visible.map((r) => (
            <tr
              key={r.stockId}
              className="row-in h-8 transition-colors hover:bg-surface"
            >
              <td className="num py-1 pr-3">
                <Link
                  href={`/stock/${r.stockId}`}
                  className="text-accent hover:underline"
                >
                  {r.stockId}
                </Link>
              </td>
              <td className="py-1 pr-3 text-text">{r.companyName}</td>
              <td className="num py-1 pr-3 text-right">{formatPrice(r.price)}</td>
              <td className="py-1 pr-3 text-right">
                <DeltaValue value={r.changePct} arrow />
              </td>
              <td className="num py-1 pr-3 text-right text-muted">
                {formatPrice(r.pe, 1)}x
              </td>
              <td className="num py-1 pr-3 text-right text-muted">
                {formatPct(r.roe, 1, false)}
              </td>
              <td className="py-1 pr-3 text-right">
                {r.monthlyYoy !== null ? (
                  <DeltaValue value={r.monthlyYoy} digits={1} />
                ) : (
                  <span className="num text-faint">—</span>
                )}
              </td>
              <td className="py-1 pr-3 text-right">
                {/* deltaClass()：淨額為 0 時是 flat，不是綠色 */}
                <span className={cn("num", deltaClass(r.foreignNet))}>
                  {formatNetLots(r.foreignNet)}
                </span>
              </td>
              <td className="num py-1 pr-3 text-right">{r.score}</td>
              <td className="py-1 pl-3">
                <div className="flex justify-end">
                  <Sparkline
                    data={r.spark}
                    trend={r.changePct}
                    width={68}
                    height={18}
                  />
                </div>
              </td>
              <td className="py-1 text-right">
                <button
                  type="button"
                  onClick={() => remove(r.stockId)}
                  aria-label={`從追蹤清單移除 ${r.stockId} ${r.companyName}`}
                  // 不用 opacity-0 + group-hover 淡入：觸控裝置沒有 hover，
                  // 那會變成「看不見但按得到」。一律顯示，用 text-faint 壓低存在感。
                  className="cursor-pointer rounded p-1 text-faint transition-colors hover:text-up"
                >
                  <X size={12} weight="bold" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
