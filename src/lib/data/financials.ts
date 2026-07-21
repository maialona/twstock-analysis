import type { Dividend, MonthlyRevenue, QuarterlyFinancial } from "@/lib/schema";
import { round } from "@/lib/rng";
import { DIVIDENDS, MONTHLY_REVENUE, QUARTERLY } from "./source";

/**
 * 財報衍生資料。全部為真實值（收集器直接抓自 TWSE / MOPS）：
 *
 *  月營收：mopsov 月營收 CSV，實際的營收與年增率。
 *  逐季損益／現金流／資產負債：MOPS 財務報表，近 12 季逐季相減後的真實單季值
 *    （見 scripts/twse/financials-history.ts）。金控沒有營收／利潤結構，那幾欄為 null；
 *    ETF 沒有財報，取用端拿到空陣列。
 *  歷年股利：MOPS 股利分派情形，逐年真實的現金／股票股利（見 scripts/twse/dividends.ts）。
 */

/* ── 月營收 ───────────────────────────────────────────── */

export function getMonthlyRevenue(stockId: string): MonthlyRevenue[] {
  return MONTHLY_REVENUE[stockId] ?? [];
}

/* ── 季度趨勢：真實逐季（ETF 無 → 空陣列，趨勢圖自然空狀態）───── */

export function getQuarterly(stockId: string): QuarterlyFinancial[] {
  return QUARTERLY[stockId] ?? [];
}

export type DerivedPoint = {
  label: string;
  eps: number;
  roe: number;
  // 金控沒有營收，利潤率不成立 → null（利潤率趨勢圖對金控不顯示）
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
};

const marginOf = (part: number | null, revenue: number | null): number | null =>
  part === null || revenue === null || revenue === 0 ? null : round((part * 100) / revenue, 1);

export function getDerivedSeries(stockId: string): DerivedPoint[] {
  return getQuarterly(stockId).map((q) => ({
    label: `${String(q.year).slice(2)}Q${q.quarter}`,
    eps: q.eps,
    roe: round((q.netIncome * 4 * 100) / q.equity, 1),
    grossMargin: marginOf(q.grossProfit, q.revenue),
    operatingMargin: marginOf(q.operatingIncome, q.revenue),
    netMargin: marginOf(q.netIncome, q.revenue),
  }));
}

/* ── 歷年股利：真實（ETF 無 → 空陣列）──────────────────── */

export function getDividends(stockId: string): Dividend[] {
  return DIVIDENDS[stockId] ?? [];
}
