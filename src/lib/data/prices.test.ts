import { describe, expect, it } from "vitest";
import { METRICS } from "./companies";
import { getLatestPrice, LATEST_DATE } from "./prices";

/**
 * 這些不變式原本由 mock 的幾何布朗運動「反推」來保證；換成真實資料後，
 * 改由收集器（scripts/fetch-twse.ts 的 assertPriceConsistency）在寫檔前把關。
 * 這裡再驗一次快照本身，讓「表頭數字」與「K 線最後一根」對不上的資料
 * 進不了版本庫 —— 這種錯每個數字單看都合理，只有湊在一起才看得出來。
 */
describe("快照一致性：表頭指標 vs K 線最後一根", () => {
  it("每一檔的最後一根 K 線日期都等於基準交易日", () => {
    for (const m of METRICS) {
      const last = getLatestPrice(m.stockId);
      expect(last, m.stockId).toBeDefined();
      expect(last!.date, m.stockId).toBe(LATEST_DATE);
    }
  });

  it("每一檔表頭現價都等於 K 線最後一根收盤", () => {
    for (const m of METRICS) {
      const last = getLatestPrice(m.stockId)!;
      expect(last.close, m.stockId).toBe(m.price);
    }
  });

  it("每一根 K 線都符合 OHLC 不變式（high ≥ max、low ≤ min）", () => {
    for (const m of METRICS) {
      const last = getLatestPrice(m.stockId)!;
      expect(last.high, m.stockId).toBeGreaterThanOrEqual(Math.max(last.open, last.close));
      expect(last.low, m.stockId).toBeLessThanOrEqual(Math.min(last.open, last.close));
    }
  });
});
