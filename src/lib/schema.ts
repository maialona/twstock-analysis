import { z } from "zod";

/**
 * Schema 直接對應 PRD 第五節的 DB table 定義。
 * 之後接上 FastAPI 時，這些就是 API response 的驗證層 —
 * 不要另外發明一套型別。
 */

export const MarketSchema = z.enum(["TWSE", "OTC", "ETF"]);
export type Market = z.infer<typeof MarketSchema>;

/* ── company ─────────────────────────────────────────── */
export const CompanySchema = z.object({
  id: z.number().int(),
  stockId: z.string(),
  companyName: z.string(),
  industry: z.string(),
  market: MarketSchema,
  listingDate: z.string(),
});
export type Company = z.infer<typeof CompanySchema>;

/* ── daily_price ─────────────────────────────────────── */
export const DailyPriceSchema = z.object({
  date: z.string(),
  stockId: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(), // 股數
  turnover: z.number(), // 成交金額（元）
});
export type DailyPrice = z.infer<typeof DailyPriceSchema>;

/* ── quarterly_financial ─────────────────────────────── */
/**
 * 金控合併損益表沒有營業收入與利潤結構，也不畫現金流 —— 這些欄位對金控為 null。
 * 損益核心（淨利、EPS）與資產負債（權益、資產、負債）金控與一般業都有。
 */
export const QuarterlyFinancialSchema = z.object({
  stockId: z.string(),
  year: z.number().int(),
  quarter: z.number().int().min(1).max(4),
  revenue: z.number().nullable(),
  grossProfit: z.number().nullable(),
  operatingIncome: z.number().nullable(),
  netIncome: z.number(),
  eps: z.number(),
  equity: z.number(),
  asset: z.number(),
  liability: z.number(),
  operatingCashFlow: z.number().nullable(),
  capex: z.number().nullable(),
});
export type QuarterlyFinancial = z.infer<typeof QuarterlyFinancialSchema>;

/* ── monthly_revenue ─────────────────────────────────── */
export const MonthlyRevenueSchema = z.object({
  stockId: z.string(),
  month: z.string(), // "2025-06"
  revenue: z.number(),
  mom: z.number(), // 月增率 %
  yoy: z.number(), // 年增率 %
});
export type MonthlyRevenue = z.infer<typeof MonthlyRevenueSchema>;

/* ── dividend ────────────────────────────────────────── */
export const DividendSchema = z.object({
  stockId: z.string(),
  year: z.number().int(),
  cashDividend: z.number(),
  stockDividend: z.number(),
  payoutRatio: z.number(),
  yieldPct: z.number(),
});
export type Dividend = z.infer<typeof DividendSchema>;

/* ── 法人買賣超 ───────────────────────────────────────── */
export const InstitutionalFlowSchema = z.object({
  date: z.string(),
  stockId: z.string(),
  foreign: z.number(), // 外資（股數，正為買超）
  trust: z.number(), // 投信
  dealer: z.number(), // 自營商
});
export type InstitutionalFlow = z.infer<typeof InstitutionalFlowSchema>;

/* ── Financial Engine 計算輸出（PRD 第六節）─────────────── */

/**
 * 除了股價與漲跌幅，其餘指標一律可為 null。
 *
 * 這不是防禦性寫法，是真實資料的形狀：
 *  - 虧損公司沒有本益比（1301 台塑）
 *  - 金控／銀行的損益表沒有「營業收入」，毛利率等比率不成立（2891 中信金）
 *  - ETF 沒有財報（0050）
 *  - TWSE 公開資料沒有現金流量表，自由現金流無從取得
 *
 * null 一律代表「這個數字不存在」，絕不用 0 代替 ——
 * 本益比 0 和沒有本益比在篩選與評分上是完全不同的意思。
 */
export const MetricsSchema = z.object({
  stockId: z.string(),
  price: z.number(),
  changePct: z.number(),
  eps: z.number().nullable(), // 近四季 EPS
  epsCagr5y: z.number().nullable(),
  roe: z.number().nullable(),
  roa: z.number().nullable(),
  pe: z.number().nullable(),
  pb: z.number().nullable(),
  dividendYield: z.number().nullable(),
  debtRatio: z.number().nullable(),
  grossMargin: z.number().nullable(),
  operatingMargin: z.number().nullable(),
  netMargin: z.number().nullable(),
  fcf: z.number().nullable(),
  revenueYoy: z.number().nullable(),
  industryPe: z.number().nullable(),
  marketCap: z.number().nullable(),
});
export type Metrics = z.infer<typeof MetricsSchema>;

/* ── Scoring Engine（PRD 第八節）──────────────────────── */
export const ScoreBreakdownSchema = z.object({
  epsGrowth: z.number(),
  roe: z.number(),
  grossMargin: z.number(),
  revenueGrowth: z.number(),
  cashFlow: z.number(),
  debtRatio: z.number(),
  pe: z.number(),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const SCORE_WEIGHTS: Record<keyof ScoreBreakdown, number> = {
  epsGrowth: 0.2,
  roe: 0.2,
  grossMargin: 0.15,
  revenueGrowth: 0.15,
  cashFlow: 0.1,
  debtRatio: 0.1,
  pe: 0.1,
};

export const SCORE_LABELS: Record<keyof ScoreBreakdown, string> = {
  epsGrowth: "EPS 成長",
  roe: "ROE",
  grossMargin: "毛利率",
  revenueGrowth: "月營收成長",
  cashFlow: "現金流",
  debtRatio: "負債比",
  pe: "本益比",
};

/**
 * 分項分數。某些指標目前沒有真實資料來源（EPS 五年 CAGR 需要五年歷史財報、
 * 現金流評分需要現金流量表，TWSE 免費端點都不提供），這類分項為 null，
 * total 會在可得的分項上重新配權，而不是把缺項當 0 拉低分數。
 */
export const NullableScoreBreakdownSchema = z.object({
  epsGrowth: z.number().nullable(),
  roe: z.number().nullable(),
  grossMargin: z.number().nullable(),
  revenueGrowth: z.number().nullable(),
  cashFlow: z.number().nullable(),
  debtRatio: z.number().nullable(),
  pe: z.number().nullable(),
});
export type NullableScoreBreakdown = z.infer<typeof NullableScoreBreakdownSchema>;

export const StockScoreSchema = z.object({
  stockId: z.string(),
  total: z.number().min(0).max(100),
  breakdown: NullableScoreBreakdownSchema,
});
export type StockScore = z.infer<typeof StockScoreSchema>;

/* ── AI Analyzer（PRD 第九節）─────────────────────────── */
export const AiDimensionSchema = z.object({
  growth: z.number().min(0).max(5),
  valuation: z.number().min(0).max(5),
  financialHealth: z.number().min(0).max(5),
  competitiveness: z.number().min(0).max(5),
  risk: z.number().min(0).max(5),
});
export type AiDimension = z.infer<typeof AiDimensionSchema>;

/**
 * 注意：AI 輸出一律為描述性的財務摘要，
 * 不含買賣建議。summary / risks / catalysts 都是對已公開資料的整理。
 */
export const AiAnalysisSchema = z.object({
  stockId: z.string(),
  updatedAt: z.string(),
  summary: z.array(z.string()).length(3),
  risks: z.array(z.string()),
  catalysts: z.array(z.string()),
  outlook: z.string(),
  dimensions: AiDimensionSchema,
});
export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

/* ── Screener（PRD 第七節）────────────────────────────── */
export const MetricKeySchema = z.enum([
  "eps",
  "roe",
  "roa",
  "pe",
  "pb",
  "dividendYield",
  "debtRatio",
  "grossMargin",
  "operatingMargin",
  "netMargin",
  "revenueYoy",
  "marketCap",
]);
export type MetricKey = z.infer<typeof MetricKeySchema>;

/**
 * 比較基準。PRD 要求支援相對條件（「EPS > 去年」、「PE < 產業平均」），
 * 而不只是絕對數值 — 這是本工具與一般篩選器的差異點。
 */
export const ComparatorSchema = z.enum(["gt", "gte", "lt", "lte"]);
export type Comparator = z.infer<typeof ComparatorSchema>;

export const TargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("value"), value: z.number() }),
  z.object({ kind: z.literal("lastYear") }),
  z.object({ kind: z.literal("industryAvg") }),
]);
export type Target = z.infer<typeof TargetSchema>;

export const RuleSchema = z.object({
  id: z.string(),
  metric: MetricKeySchema,
  comparator: ComparatorSchema,
  target: TargetSchema,
});
export type Rule = z.infer<typeof RuleSchema>;

export const METRIC_META: Record<
  MetricKey,
  { label: string; unit: "%" | "x" | "元" | "億"; digits: number; higherIsBetter: boolean }
> = {
  eps: { label: "EPS", unit: "元", digits: 2, higherIsBetter: true },
  roe: { label: "ROE", unit: "%", digits: 1, higherIsBetter: true },
  roa: { label: "ROA", unit: "%", digits: 1, higherIsBetter: true },
  pe: { label: "本益比", unit: "x", digits: 1, higherIsBetter: false },
  pb: { label: "股價淨值比", unit: "x", digits: 2, higherIsBetter: false },
  dividendYield: { label: "殖利率", unit: "%", digits: 2, higherIsBetter: true },
  debtRatio: { label: "負債比", unit: "%", digits: 1, higherIsBetter: false },
  grossMargin: { label: "毛利率", unit: "%", digits: 1, higherIsBetter: true },
  operatingMargin: { label: "營益率", unit: "%", digits: 1, higherIsBetter: true },
  netMargin: { label: "淨利率", unit: "%", digits: 1, higherIsBetter: true },
  revenueYoy: { label: "營收年增率", unit: "%", digits: 1, higherIsBetter: true },
  marketCap: { label: "市值", unit: "億", digits: 0, higherIsBetter: true },
};

export const COMPARATOR_LABELS: Record<Comparator, string> = {
  gt: "大於",
  gte: "大於等於",
  lt: "小於",
  lte: "小於等於",
};
