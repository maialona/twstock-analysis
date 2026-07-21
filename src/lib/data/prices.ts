import type { DailyPrice, InstitutionalFlow } from "@/lib/schema";
import { INSTITUTIONAL, LATEST_DATE, MARKET, PRICES } from "./source";

/**
 * 價格、法人、大盤。介面對齊舊的 mock/prices，資料換成真實 TWSE 快照。
 *
 * 與 mock 版最大的差別：這裡不再用幾何布朗運動反推序列，
 * 而是直接讀收集器抓下來的真實日 K。因此「表頭漲跌幅與 K 線最後一根
 * 是否一致」不再靠反推保證，而是由收集器在寫檔前 assert（見 fetch-twse.ts），
 * 一旦兩個端點的日期對不上就讓收集失敗，不會產出錯的快照。
 */

export { LATEST_DATE };

export function getPrices(stockId: string): DailyPrice[] {
  return PRICES[stockId] ?? [];
}

export function getLatestPrice(stockId: string): DailyPrice | undefined {
  const s = getPrices(stockId);
  return s[s.length - 1];
}

/** Sparkline 用：只取收盤價 */
export function getCloseSeries(stockId: string, days = 60): number[] {
  return getPrices(stockId)
    .slice(-days)
    .map((p) => p.close);
}

/* ── 法人買賣超（逐檔，單位：股）──────────────────────── */

export function getInstitutionalFlow(stockId: string, days = 20): InstitutionalFlow[] {
  return (INSTITUTIONAL[stockId] ?? []).slice(-days);
}

/* ── 大盤 ─────────────────────────────────────────────── */

export const MARKET_INDICES = MARKET.indices;
export const MARKET_BREADTH = MARKET.breadth;
export const MARKET_TURNOVER = MARKET.turnover;
export const MARKET_INSTITUTIONAL = MARKET.institutional;
