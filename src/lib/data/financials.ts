import type { Dividend, MonthlyRevenue, QuarterlyFinancial } from "@/lib/schema";
import { gaussian, mulberry32, round, seedFrom } from "@/lib/rng";
import { METRICS_BY_ID, isOperatingCompany } from "./companies";
import { FINANCIALS, MONTHLY_REVENUE } from "./source";

/**
 * 財報衍生資料。
 *
 * 真實與模型的界線很清楚，這裡刻意標出來：
 *
 *  ── 真實（收集器直接抓自 TWSE）──
 *    月營收：mopsov 月營收 CSV，24 個月的營收與年增率都是實際值。
 *    最新一季損益／資產負債：openapi t187ap06/07，真實的一季。
 *
 *  ── 模型（TWSE 免費端點只給「最新一期」，沒有歷史）──
 *    季度趨勢（近 12 季的利潤率／EPS）與歷年股利，
 *    以「最新一期的真實值」為錨、往回推估的走勢。最右邊那一點是真的，
 *    越往左模型成分越高。這是為了讓趨勢圖有東西可看，
 *    不是宣稱那是歷史實際值 —— README 的已知落差有記。
 *    要換成真實歷史，需逐檔查 MOPS 的季報，是獨立的下一步。
 */

/* ── 月營收：真實 ─────────────────────────────────────── */

export function getMonthlyRevenue(stockId: string): MonthlyRevenue[] {
  return MONTHLY_REVENUE[stockId] ?? [];
}

/* ── 季度趨勢：以真實最新一季為錨的模型序列 ───────────── */

const QUARTERS: Array<{ year: number; quarter: number }> = [];
for (let y = 2023; y <= 2026; y++) {
  for (let q = 1; q <= 4; q++) {
    if (y === 2026 && q > 2) break;
    QUARTERS.push({ year: y, quarter: q });
  }
}

function buildQuarterly(stockId: string): QuarterlyFinancial[] {
  const m = METRICS_BY_ID.get(stockId);
  const anchor = FINANCIALS[stockId];
  if (!m || !isOperatingCompany(stockId)) return [];
  // 金融股沒有毛利率／營益率的概念，趨勢圖不成立 —— 直接不畫，
  // 而不是硬湊四條看似合理卻沒有意義的線
  if (anchor?.grossMargin === null || anchor?.grossMargin === undefined) return [];
  if (m.netMargin === null || m.grossMargin === null || m.operatingMargin === null) {
    return [];
  }

  const rand = mulberry32(seedFrom(`${stockId}-q`));
  const n = QUARTERS.length;

  // 把已判空的值收進區域常數 —— TS 不會把 m.* 的窄化帶進下方 .map 的閉包，
  // 收進 const 之後型別才穩定是 number，也讀得比一連串 non-null 斷言清楚
  const baseGross = m.grossMargin;
  const baseOperating = m.operatingMargin;
  const baseNet = m.netMargin;

  // 錨定真實最新一季的營收；往回用真實營收年增率折算
  const latestRevenue = anchor?.revenue ?? (m.marketCap ?? 0) / (m.pe ?? 15) / (baseNet / 100) / 4;
  const yoy = m.revenueYoy ?? 8;
  const growthPerQ = (1 + yoy / 100) ** (1 / 4);
  const roe = m.roe ?? 15;
  const roa = m.roa ?? roe * 0.6;
  const eps = m.eps ?? anchor?.eps ?? 0;
  const debtRatio = m.debtRatio ?? 40;

  return QUARTERS.map((qt, i) => {
    const stepsBack = n - 1 - i;
    const isLatest = stepsBack === 0;
    const noise = isLatest ? 1 : 1 + gaussian(rand) * 0.045;
    const revenue = (latestRevenue / growthPerQ ** stepsBack) * noise;

    // 最新一季用真實利潤率，較早的季度加入輕微擾動
    const gm = (isLatest ? baseGross : baseGross + gaussian(rand) * 1.6) / 100;
    const om = (isLatest ? baseOperating : baseOperating + gaussian(rand) * 1.2) / 100;
    const nm = (isLatest ? baseNet : baseNet + gaussian(rand) * 1.1) / 100;

    const netIncome = revenue * nm;
    const equity = (netIncome * 4) / (roe / 100);
    const asset = roa > 0 ? (netIncome * 4) / (roa / 100) : equity * 1.6;
    const ocf = netIncome * (1.28 + gaussian(rand) * 0.08);

    return {
      stockId,
      year: qt.year,
      quarter: qt.quarter,
      revenue: Math.round(revenue),
      grossProfit: Math.round(revenue * gm),
      operatingIncome: Math.round(revenue * om),
      netIncome: Math.round(netIncome),
      eps: round((eps / 4) * (isLatest ? 1 : revenue / latestRevenue), 2),
      equity: Math.round(equity),
      asset: Math.round(asset),
      liability: Math.round(asset * (debtRatio / 100)),
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
