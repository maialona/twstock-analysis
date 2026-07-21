import {
  SCORE_WEIGHTS,
  type Metrics,
  type NullableScoreBreakdown,
  type StockScore,
} from "@/lib/schema";
import { METRICS, isOperatingCompany } from "./companies";
import { round } from "@/lib/rng";

/**
 * Scoring Engine（PRD 第八節）。
 *
 * 定位：依權重把多個財務指標正規化後加權排序的工具，不是投資推薦。
 *
 * 與 mock 版的差異：真實資料有缺項（EPS 五年 CAGR、現金流評分目前沒有
 * 真實來源）。缺項一律為 null，total 在「有值的分項」上重新配權 ——
 * 把缺項當 0 會系統性低估每一檔，那是錯的。
 */

/** 將指標線性映射到 0–100，超出範圍夾住；null 進 null 出 */
function scale(value: number | null, lo: number, hi: number): number | null {
  if (value === null || Number.isNaN(value)) return null;
  const t = ((value - lo) / (hi - lo)) * 100;
  return Math.max(0, Math.min(100, t));
}

function scaleInverse(value: number | null, lo: number, hi: number): number | null {
  const s = scale(value, lo, hi);
  return s === null ? null : 100 - s;
}

/** 比值型指標（本益比 / 同業）需兩個值都有才成立 */
function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}

export function computeBreakdown(m: Metrics): NullableScoreBreakdown {
  return {
    epsGrowth: roundN(scale(m.epsCagr5y, -10, 35)),
    roe: roundN(scale(m.roe, 0, 35)),
    grossMargin: roundN(scale(m.grossMargin, 0, 60)),
    revenueGrowth: roundN(scale(m.revenueYoy, -15, 45)),
    cashFlow: roundN(
      scale(m.fcf !== null && m.marketCap ? (m.fcf / m.marketCap) * 100 : null, -2, 8),
    ),
    debtRatio: roundN(scaleInverse(m.debtRatio, 20, 80)),
    pe: roundN(scaleInverse(ratio(m.pe, m.industryPe), 0.5, 2)),
  };
}

const roundN = (n: number | null): number | null => (n === null ? null : round(n, 1));

/**
 * 只對有值的分項加權，並把權重重新正規化到 1。
 * 例如目前缺 epsGrowth（0.2）與 cashFlow（0.1），
 * 其餘五項的權重就按 1 / 0.7 放大，總分不會因為缺兩項而被壓低。
 */
export function computeTotal(b: NullableScoreBreakdown): number {
  const keys = Object.keys(SCORE_WEIGHTS) as Array<keyof NullableScoreBreakdown>;
  let weighted = 0;
  let availableWeight = 0;
  for (const k of keys) {
    const v = b[k];
    if (v === null) continue;
    weighted += v * SCORE_WEIGHTS[k];
    availableWeight += SCORE_WEIGHTS[k];
  }
  if (availableWeight === 0) return 0;
  return round(weighted / availableWeight, 0);
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
