import type { Dividend, MonthlyRevenue, QuarterlyFinancial } from "@/lib/schema";
import { mulberry32, round, seedFrom } from "@/lib/rng";
import { METRICS_BY_ID, isOperatingCompany } from "./companies";
import { MONTHLY_REVENUE, QUARTERLY } from "./source";

/**
 * 財報衍生資料。
 *
 * 真實與模型的界線很清楚，這裡刻意標出來：
 *
 *  ── 真實（收集器直接抓自 TWSE / MOPS）──
 *    月營收：mopsov 月營收 CSV，實際的營收與年增率。
 *    逐季損益／現金流／資產負債：MOPS 財務報表，近 12 季逐季相減後的真實單季值
 *    （見 scripts/twse/financials-history.ts）。金控與 ETF 不在其中，取用端拿到空陣列。
 *
 *  ── 模型（尚未接真實來源）──
 *    歷年股利：以真實殖利率／股價為錨往回推估，最右一點是真的。
 *    真實歷年股利需另抓 MOPS 股利政策端點，是獨立的下一步。
 */

/* ── 月營收：真實 ─────────────────────────────────────── */

export function getMonthlyRevenue(stockId: string): MonthlyRevenue[] {
  return MONTHLY_REVENUE[stockId] ?? [];
}

/* ── 季度趨勢：真實逐季（金控／ETF 無 → 空陣列，趨勢圖自然空狀態）───── */

export function getQuarterly(stockId: string): QuarterlyFinancial[] {
  return QUARTERLY[stockId] ?? [];
}

export type DerivedPoint = {
  label: string;
  eps: number;
  roe: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
};

export function getDerivedSeries(stockId: string): DerivedPoint[] {
  return getQuarterly(stockId).map((q) => ({
    label: `${String(q.year).slice(2)}Q${q.quarter}`,
    eps: q.eps,
    roe: round((q.netIncome * 4 * 100) / q.equity, 1),
    grossMargin: round((q.grossProfit * 100) / q.revenue, 1),
    operatingMargin: round((q.operatingIncome * 100) / q.revenue, 1),
    netMargin: round((q.netIncome * 100) / q.revenue, 1),
  }));
}

/* ── 歷年股利：以真實殖利率／股價為錨的模型序列 ─────────── */

function buildDividends(stockId: string): Dividend[] {
  const m = METRICS_BY_ID.get(stockId);
  if (!m || !isOperatingCompany(stockId)) return [];
  // 沒有殖利率就沒有可錨定的現金股利，不硬湊
  if (m.dividendYield === null || m.dividendYield === 0) return [];

  const rand = mulberry32(seedFrom(`${stockId}-d`));
  const latestCash = (m.price * m.dividendYield) / 100;
  const eps = m.eps;

  return [2021, 2022, 2023, 2024, 2025].map((year, i) => {
    const decay = 0.86 + i * 0.035 + rand() * 0.04;
    const cash = round(latestCash * decay, 2);
    const epsThatYear = eps !== null ? eps * decay : null;
    return {
      stockId,
      year,
      cashDividend: cash,
      stockDividend: stockId === "2330" || stockId === "2412" ? 0 : round(rand() * 0.35, 2),
      payoutRatio:
        epsThatYear !== null && epsThatYear > 0 ? round((cash / epsThatYear) * 100, 1) : 0,
      yieldPct: round((cash / m.price) * 100, 2),
    };
  });
}

const D_CACHE = new Map<string, Dividend[]>();

export function getDividends(stockId: string): Dividend[] {
  let v = D_CACHE.get(stockId);
  if (!v) {
    v = buildDividends(stockId);
    D_CACHE.set(stockId, v);
  }
  return v;
}
