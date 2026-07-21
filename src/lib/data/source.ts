import { z } from "zod";
import {
  CompanySchema,
  DailyPriceSchema,
  InstitutionalFlowSchema,
  MetricsSchema,
  MonthlyRevenueSchema,
} from "@/lib/schema";

import companiesJson from "../../../data/companies.json";
import metricsJson from "../../../data/metrics.json";
import marketJson from "../../../data/market.json";
import pricesJson from "../../../data/prices.json";
import revenueJson from "../../../data/monthly-revenue.json";
import institutionalJson from "../../../data/institutional.json";
import financialsJson from "../../../data/financials.json";
import metaJson from "../../../data/meta.json";

/**
 * data/*.json 是 scripts/fetch-twse.ts 從 TWSE 公開資料抓下來、正規化後的快照。
 * 前端只讀這裡，建置與執行期都不對外連線 —— TWSE 會擋連續請求，
 * 且行情一天只更新一次，沒有必要放在 request path 上。
 *
 * 這一層的職責只有兩件事：
 *  1. 讀 JSON，並用 schema 驗證形狀（收集器換版時這裡會先炸，而不是畫面靜默錯）
 *  2. 建好 by-id 的索引供上層取用
 *
 * 所有衍生計算（評分、篩選、季報序列）都在各自的模組，不在這裡。
 */

/* ── 市場資料的 schema（只在這裡用到，就地定義）─────────── */

const IndexSchema = z.object({
  name: z.string(),
  code: z.string(),
  value: z.number(),
  changePct: z.number(),
  series: z.array(z.number()),
});

const MarketSchema = z.object({
  tradeDate: z.string(),
  indices: z.array(IndexSchema),
  turnover: z.object({
    value: z.number(),
    changePct: z.number().nullable(),
    fiveDayAvg: z.number(),
  }),
  breadth: z.object({
    advancing: z.number(),
    declining: z.number(),
    unchanged: z.number(),
    limitUp: z.number(),
    limitDown: z.number(),
  }),
  institutional: z.array(
    z.object({ name: z.string(), net: z.number(), streak: z.number() }),
  ),
});

/** 收集器輸出的季報單筆（金控與一般業共用，缺的欄位為 null） */
const FundamentalsSchema = z.object({
  revenue: z.number().nullable(),
  grossMargin: z.number().nullable(),
  operatingMargin: z.number().nullable(),
  netMargin: z.number().nullable(),
  netIncome: z.number().nullable(),
  eps: z.number().nullable(),
  equity: z.number().nullable(),
  asset: z.number().nullable(),
  liability: z.number().nullable(),
  bookValuePerShare: z.number().nullable(),
  reportType: z.enum(["general", "financialHolding", "bank", "securities"]),
  year: z.number(),
  quarter: z.number(),
});
export type Fundamentals = z.infer<typeof FundamentalsSchema>;

/* ── 解析（模組載入時一次性驗證，失敗即中止）────────────── */

const parse = <T>(schema: z.ZodType<T>, data: unknown, label: string): T => {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new Error(`data/${label} 不符合 schema：${r.error.message}`);
  }
  return r.data;
};

export const META = parse(
  z.object({ fetchedAt: z.string(), tradeDate: z.string(), source: z.string() }),
  metaJson,
  "meta.json",
);

export const COMPANIES = parse(z.array(CompanySchema), companiesJson, "companies.json");
export const METRICS = parse(z.array(MetricsSchema), metricsJson, "metrics.json");
export const MARKET = parse(MarketSchema, marketJson, "market.json");

export const PRICES = parse(
  z.record(z.string(), z.array(DailyPriceSchema)),
  pricesJson,
  "prices.json",
);
export const MONTHLY_REVENUE = parse(
  z.record(z.string(), z.array(MonthlyRevenueSchema)),
  revenueJson,
  "monthly-revenue.json",
);
export const INSTITUTIONAL = parse(
  z.record(z.string(), z.array(InstitutionalFlowSchema)),
  institutionalJson,
  "institutional.json",
);
export const FINANCIALS = parse(
  z.record(z.string(), FundamentalsSchema),
  financialsJson,
  "financials.json",
);

/** 基準交易日 —— 全站顯示「哪一天收盤」的唯一來源 */
export const LATEST_DATE = META.tradeDate;
