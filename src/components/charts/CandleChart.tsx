"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { DailyPrice } from "@/lib/schema";
import { Skeleton } from "@/components/ui/states";
import { cn } from "@/lib/format";
import { useChartColors } from "./useChartColors";

/**
 * K 線圖。lightweight-charts v5 API：chart.addSeries(SeriesDefinition, options)。
 *
 * 顏色一律取自 CSS 變數（透過 useChartColors 解析成色碼）——
 * 函式庫預設是西方慣例的綠漲紅跌，必須明確覆寫；
 * 而使用者自訂配色後，這裡也要跟著重建，否則 K 線會和表格對不起來。
 */

/** 骨架柱高，固定值以確保 SSR 與 client 一致 */
const SKELETON_BARS = [
  38, 52, 45, 61, 48, 70, 58, 66, 74, 62, 55, 68, 79, 71, 64, 82, 75, 69, 58,
  73, 66, 81, 77, 63, 70, 85, 78, 72, 67, 76, 69, 60,
];

const RANGES = [
  { label: "1M", days: 22 },
  { label: "3M", days: 66 },
  { label: "6M", days: 132 },
  { label: "1Y", days: 250 },
] as const;

type Props = {
  data: DailyPrice[];
  height?: number;
  className?: string;
};

export function CandleChart({ data, height = 380, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [range, setRange] = useState<number>(132);
  // 圖表初始化前顯示骨架 —
  // 這是真正有等待的地方（canvas 建立 + 資料載入），
  // 不是用 route-level loading.tsx 假裝有非同步。
  const [ready, setReady] = useState(false);
  const c = useChartColors();

  useEffect(() => {
    const el = containerRef.current;
    if (!el || data.length === 0) return;

    const chart = createChart(el, {
      height,
      layout: {
        background: { color: "transparent" },
        textColor: c.muted,
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: c.border },
        horzLines: { color: c.border },
      },
      rightPriceScale: {
        borderColor: c.border,
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: c.border,
        rightOffset: 4,
      },
      crosshair: {
        vertLine: { color: c.faint, labelBackgroundColor: c.border },
        horzLine: { color: c.faint, labelBackgroundColor: c.border },
      },
      handleScale: { axisPressedMouseMove: false },
    });
    chartRef.current = chart;

    // 覆寫函式庫預設的西方慣例配色，改用使用者偏好（預設為台股紅漲綠跌）
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: c.up,
      downColor: c.down,
      borderUpColor: c.up,
      borderDownColor: c.down,
      wickUpColor: c.up,
      wickDownColor: c.down,
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const slice = data.slice(-range);
    const toTime = (iso: string) =>
      (Date.parse(`${iso}T00:00:00Z`) / 1000) as UTCTimestamp;

    candles.setData(
      slice.map((d) => ({
        time: toTime(d.date),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })),
    );

    volume.setData(
      slice.map((d) => ({
        time: toTime(d.date),
        value: d.volume,
        color: d.close >= d.open ? `${c.up}44` : `${c.down}44`,
      })),
    );

    chart.timeScale().fitContent();
    setReady(true);

    // RWD：容器寬度變化時同步調整
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) chart.applyOptions({ width: Math.floor(w) });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      setReady(false);
    };
    // c 必須在依賴中：canvas 已繪製的像素不會因 CSS 變數改變而更新，
    // 使用者換配色時得整張重建。
  }, [data, height, range, c]);

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 flex items-center justify-end gap-1">
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => setRange(r.days)}
            aria-pressed={range === r.days}
            className={cn(
              "num cursor-pointer rounded px-2 py-1 text-xs transition-colors duration-150",
              "active:scale-[0.97]",
              range === r.days
                ? "bg-raised text-text"
                : "text-faint hover:text-muted",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="relative w-full" style={{ height }}>
        {!ready && (
          <div
            className="absolute inset-0 flex items-end gap-[3px] pb-7"
            role="status"
            aria-label="圖表載入中"
          >
            {/* 骨架柱高固定（非隨機），避免 SSR/CSR 不一致 */}
            {SKELETON_BARS.map((h, i) => (
              <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
