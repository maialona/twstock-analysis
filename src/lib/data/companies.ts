import type { Company, Metrics } from "@/lib/schema";
import { COMPANIES, METRICS } from "./source";

/**
 * 公司與指標的取用介面。刻意與舊的 mock/companies 對齊 ——
 * 上層元件 import 什麼名字都不變，換的只有資料來源（真實 TWSE 快照）。
 */

export { COMPANIES, METRICS };

export const COMPANY_BY_ID = new Map(COMPANIES.map((c) => [c.stockId, c]));
export const METRICS_BY_ID = new Map(METRICS.map((m) => [m.stockId, m]));

export function getCompany(stockId: string): Company | undefined {
  return COMPANY_BY_ID.get(stockId);
}

export function getMetrics(stockId: string): Metrics | undefined {
  return METRICS_BY_ID.get(stockId);
}

/** 個股頁面用：只有實際營運公司有完整財報，ETF 不適用 */
export function isOperatingCompany(stockId: string): boolean {
  return COMPANY_BY_ID.get(stockId)?.market !== "ETF";
}
