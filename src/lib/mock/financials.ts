import type {
  Dividend,
  MonthlyRevenue,
  QuarterlyFinancial,
} from "@/lib/schema";
import { METRICS_BY_ID, isOperatingCompany } from "./companies";
import { gaussian, mulberry32, round, seedFrom } from "./rng";

/* ── 季度財報：近 12 季 ───────────────────────────────── */

const QUARTERS: Array<{ year: number; quarter: number }> = [];
for (let y = 2023; y <= 2026; y++) {
  for (let q = 1; q <= 4; q++) {
    if (y === 2026 && q > 2) break;
    QUARTERS.push({ year: y, quarter: q });
  }
}

function buildQuarterly(stockId: string): QuarterlyFinancial[] {
  const m = METRICS_BY_ID.get(stockId);
  if (!m || !isOperatingCompany(stockId)) return [];

  const rand = mulberry32(seedFrom(`${stockId}-q`));
  const n = QUARTERS.length;

  // 由現況往回推：最新一季貼近 metrics，越早期成長率折算越多
  const latestQuarterRevenue = (m.marketCap / m.pe / (m.netMargin / 100)) / 4;
  const growthPerQ = (1 + m.revenueYoy / 100) ** (1 / 4);

  return QUARTERS.map((qt, i) => {
    const stepsBack = n - 1 - i;
    const noise = 1 + gaussian(rand) * 0.045;
    const revenue = (latestQuarterRevenue / growthPerQ ** stepsBack) * noise;

    const gm = (m.grossMargin + gaussian(rand) * 1.6) / 100;
    const om = (m.operatingMargin + gaussian(rand) * 1.2) / 100;
    const nm = (m.netMargin + gaussian(rand) * 1.1) / 100;

    const netIncome = revenue * nm;
    const equity = (netIncome * 4) / (m.roe / 100);
    const asset = m.roa > 0 ? (netIncome * 4) / (m.roa / 100) : equity * 1.6;
    const ocf = netIncome * (1.28 + gaussian(rand) * 0.08);

    return {
      stockId,
      year: qt.year,
      quarter: qt.quarter,
      revenue: Math.round(revenue),
      grossProfit: Math.round(revenue * gm),
      operatingIncome: Math.round(revenue * om),
      netIncome: Math.round(netIncome),
      eps: round((m.eps / 4) * (revenue / latestQuarterRevenue), 2),
      equity: Math.round(equity),
      asset: Math.round(asset),
      liability: Math.round(asset * (m.debtRatio / 100)),
      operatingCashFlow: Math.round(ocf),
      capex: Math.round(ocf * (0.34 + rand() * 0.22)),
    };
  });
}

const Q_CACHE = new Map<string, QuarterlyFinancial[]>();

export function getQuarterly(stockId: string): QuarterlyFinancial[] {
  let v = Q_CACHE.get(stockId);
  if (!v) {
    v = buildQuarterly(stockId);
    Q_CACHE.set(stockId, v);
  }
  return v;
}

/** 衍生指標時間序列，供 FinancialChart 使用 */
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

/* ── 月營收：近 24 個月 ───────────────────────────────── */

function monthKeys(count: number, endYear: number, endMonth: number): string[] {
  const out: string[] = [];
  let y = endYear;
  let mo = endMonth;
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(mo).padStart(2, "0")}`);
    mo -= 1;
    if (mo === 0) {
      mo = 12;
      y -= 1;
    }
  }
  return out.reverse();
}

const MONTHS = monthKeys(24, 2026, 6);

function buildMonthly(stockId: string): MonthlyRevenue[] {
  const m = METRICS_BY_ID.get(stockId);
  if (!m || !isOperatingCompany(stockId)) return [];

  const rand = mulberry32(seedFrom(`${stockId}-m`));
  const latestMonthly = (m.marketCap / m.pe / (m.netMargin / 100)) / 12;
  const growthPerM = (1 + m.revenueYoy / 100) ** (1 / 12);

  const raw = MONTHS.map((month, i) => {
    const stepsBack = MONTHS.length - 1 - i;
    // 電子業 Q3/Q4 旺季
    const mo = Number(month.split("-")[1]);
    const seasonal = 1 + Math.sin(((mo - 3) / 12) * Math.PI * 2) * 0.09;
    const noise = 1 + gaussian(rand) * 0.052;
    return {
      month,
      revenue: Math.round((latestMonthly / growthPerM ** stepsBack) * seasonal * noise),
    };
  });

  return raw.map((r, i) => {
    const prev = i > 0 ? raw[i - 1].revenue : r.revenue;
    const yearAgo = i >= 12 ? raw[i - 12].revenue : null;
    return {
      stockId,
      month: r.month,
      revenue: r.revenue,
      mom: round(((r.revenue - prev) / prev) * 100, 1),
      yoy: yearAgo === null ? 0 : round(((r.revenue - yearAgo) / yearAgo) * 100, 1),
    };
  });
}

const M_CACHE = new Map<string, MonthlyRevenue[]>();

export function getMonthlyRevenue(stockId: string): MonthlyRevenue[] {
  let v = M_CACHE.get(stockId);
  if (!v) {
    v = buildMonthly(stockId);
    M_CACHE.set(stockId, v);
  }
  // 前 12 個月沒有 YoY 基期，不對外顯示
  return v.slice(12);
}

/* ── 股利：近 5 年 ───────────────────────────────────── */

function buildDividends(stockId: string): Dividend[] {
  const m = METRICS_BY_ID.get(stockId);
  if (!m) return [];

  const rand = mulberry32(seedFrom(`${stockId}-d`));
  const latestCash = (m.price * m.dividendYield) / 100;

  return [2021, 2022, 2023, 2024, 2025].map((year, i) => {
    const decay = 0.86 + i * 0.035 + rand() * 0.04;
    const cash = round(latestCash * decay, 2);
    const epsThatYear = m.eps * decay;
    return {
      stockId,
      year,
      cashDividend: cash,
      stockDividend: stockId === "2330" || stockId === "2412" ? 0 : round(rand() * 0.35, 2),
      payoutRatio: epsThatYear > 0 ? round((cash / epsThatYear) * 100, 1) : 0,
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
