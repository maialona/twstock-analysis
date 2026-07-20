import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 台股漲跌配色的唯一入口。
 * 紅 = 漲、綠 = 跌（與歐美市場相反）。
 * 所有顯示漲跌的元件都必須經過這裡，不要自己寫顏色 class。
 */
export function deltaClass(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "text-flat";
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-flat";
}

/** 對應的背景色，用於長條圖、標記等 */
export function deltaBg(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "bg-flat";
  if (n > 0) return "bg-up";
  if (n < 0) return "bg-down";
  return "bg-flat";
}

/** 圖表用的原始色碼（Recharts / lightweight-charts 需要 hex 而非 class） */
export const CHART_COLORS = {
  up: "#e5484d",
  down: "#30a46c",
  flat: "#71717a",
  accent: "#0ea5e9",
  grid: "#27272a",
  axis: "#71717a",
  text: "#a1a1aa",
} as const;

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("zh-TW", {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  });

/** 股價 / 一般金額 */
export function formatPrice(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return nf(digits, digits).format(n);
}

/** 帶正負號的數值（漲跌點數） */
export function formatSigned(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = nf(digits, digits).format(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `-${s}`;
  return s;
}

/** 百分比，輸入為百分點數值（12.4 → "+12.40%"） */
export function formatPct(
  n: number | null | undefined,
  digits = 2,
  signed = true,
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const s = nf(digits, digits).format(Math.abs(n));
  if (!signed) return `${nf(digits, digits).format(n)}%`;
  if (n > 0) return `+${s}%`;
  if (n < 0) return `-${s}%`;
  return `${s}%`;
}

/**
 * 台灣金額慣例：億 / 萬。輸入單位為「元」。
 * 231_400_000_000 → "2,314.0 億"
 */
export function formatTWD(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e8) return `${sign}${nf(1, 1).format(abs / 1e8)} 億`;
  if (abs >= 1e4) return `${sign}${nf(1, 1).format(abs / 1e4)} 萬`;
  return `${sign}${nf(0, 0).format(abs)}`;
}

/** 成交量：輸入為股數，顯示為張數（1 張 = 1000 股） */
export function formatVolume(shares: number | null | undefined): string {
  if (shares === null || shares === undefined || Number.isNaN(shares)) return "—";
  const lots = shares / 1000;
  if (lots >= 1e4) return `${nf(1, 1).format(lots / 1e4)} 萬張`;
  return `${nf(0, 0).format(lots)} 張`;
}

/** 大整數加千分位 */
export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return nf(0, 0).format(n);
}

/** 法人買賣超：輸入為股數，顯示為億元需另外換算；這裡顯示張數帶正負 */
export function formatNetLots(shares: number | null | undefined): string {
  if (shares === null || shares === undefined || Number.isNaN(shares)) return "—";
  const lots = Math.round(shares / 1000);
  const s = nf(0, 0).format(Math.abs(lots));
  if (lots > 0) return `+${s}`;
  if (lots < 0) return `-${s}`;
  return s;
}

/** ISO date → "07/18" */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}

/** "2025-03" → "2025 年 3 月" */
export function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y} 年 ${Number(m)} 月`;
}

/** 季度標籤 */
export function formatQuarter(year: number, quarter: number): string {
  return `${year} Q${quarter}`;
}
