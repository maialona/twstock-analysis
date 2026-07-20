import {
  SCORE_WEIGHTS,
  type Metrics,
  type ScoreBreakdown,
  type StockScore,
} from "@/lib/schema";
import { METRICS, isOperatingCompany } from "./companies";
import { round } from "./rng";

/**
 * Scoring Engine（PRD 第八節）。
 *
 * 重要定位：這是「依使用者設定的權重，把多個財務指標正規化後加權排序」的
 * 排序工具，不是投資推薦。分數高低只代表在所選指標上的相對位置。
 */

/** 將指標線性映射到 0–100，超出範圍夾住 */
function scale(value: number, lo: number, hi: number): number {
  if (Number.isNaN(value)) return 0;
  const t = ((value - lo) / (hi - lo)) * 100;
  return Math.max(0, Math.min(100, t));
}

/** 數值越低越好的指標（負債比、本益比） */
function scaleInverse(value: number, lo: number, hi: number): number {
  return 100 - scale(value, lo, hi);
}

export function computeBreakdown(m: Metrics): ScoreBreakdown {
  return {
    epsGrowth: round(scale(m.epsCagr5y, -10, 35), 1),
    roe: round(scale(m.roe, 0, 35), 1),
    grossMargin: round(scale(m.grossMargin, 0, 60), 1),
    revenueGrowth: round(scale(m.revenueYoy, -15, 45), 1),
    cashFlow: round(scale(m.fcf / Math.max(m.marketCap, 1) * 100, -2, 8), 1),
    debtRatio: round(scaleInverse(m.debtRatio, 20, 80), 1),
    pe: round(scaleInverse(m.pe / Math.max(m.industryPe, 1), 0.5, 2), 1),
  };
}

export function computeTotal(b: ScoreBreakdown): number {
  const total = (Object.keys(SCORE_WEIGHTS) as Array<keyof ScoreBreakdown>).reduce(
    (sum, k) => sum + b[k] * SCORE_WEIGHTS[k],
    0,
  );
  return round(total, 0);
}

function build(): StockScore[] {
  return METRICS.filter((m) => isOperatingCompany(m.stockId)).map((m) => {
    const breakdown = computeBreakdown(m);
    return { stockId: m.stockId, total: computeTotal(breakdown), breakdown };
  });
}

export const SCORES: StockScore[] = build();
export const SCORE_BY_ID = new Map(SCORES.map((s) => [s.stockId, s]));

export function getScore(stockId: string): StockScore | undefined {
  return SCORE_BY_ID.get(stockId);
}

export const RANKED_SCORES = [...SCORES].sort((a, b) => b.total - a.total);
