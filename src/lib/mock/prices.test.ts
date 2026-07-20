import { describe, expect, it } from "vitest";
import { COMPANIES, METRICS_BY_ID } from "./companies";
import { LATEST_DATE, getPrices } from "./prices";

/**
 * 這裡測的是「表頭數字」與「K 線最後一根」是否講同一件事。
 *
 * 表頭、儀表板、追蹤清單顯示的漲跌幅都來自 metrics.changePct，
 * K 線則是自己一條幾何布朗運動走出來的。兩者一旦脫鉤，畫面上會出現
 * 「▲ +1.36%」配一根收黑的 K 棒 —— 每個數字單看都正常，只有合在一起是錯的，
 * 正是不會被肉眼抓到的那類錯誤。（曾經 12 檔裡有 6 檔方向相反。）
 */
describe("價格序列與 changePct 的一致性", () => {
  it("每一檔的最後一根漲跌幅都等於 metrics.changePct", () => {
    for (const co of COMPANIES) {
      const series = getPrices(co.stockId);
      const last = series.at(-1)!;
      const prev = series.at(-2)!;
      const actual = (last.close / prev.close - 1) * 100;
      const stated = METRICS_BY_ID.get(co.stockId)!.changePct;

      // 容差來自 OHLC 依價位四捨五入到 1~2 位小數，不是演算法誤差
      expect(actual, `${co.stockId} ${co.companyName}`).toBeCloseTo(stated, 1);
    }
  });

  it("漲跌方向與 changePct 一致（紅漲綠跌的判斷依據）", () => {
    for (const co of COMPANIES) {
      const series = getPrices(co.stockId);
      const actual = series.at(-1)!.close - series.at(-2)!.close;
      const stated = METRICS_BY_ID.get(co.stockId)!.changePct;

      expect(Math.sign(actual), `${co.stockId} ${co.companyName}`).toBe(
        Math.sign(stated),
      );
    }
  });

  it("最後一根收盤價精確等於現價，否則圖表與指標對不上", () => {
    for (const co of COMPANIES) {
      const m = METRICS_BY_ID.get(co.stockId)!;
      expect(getPrices(co.stockId).at(-1)!.close, co.stockId).toBe(m.price);
    }
  });

  it("最後一個交易日是 LATEST_DATE，且 OHLC 恆滿足 low <= open/close <= high", () => {
    for (const co of COMPANIES) {
      const series = getPrices(co.stockId);
      expect(series.at(-1)!.date).toBe(LATEST_DATE);

      for (const d of series) {
        expect(d.low, `${co.stockId} ${d.date}`).toBeLessThanOrEqual(d.high);
        expect(d.open).toBeGreaterThanOrEqual(d.low);
        expect(d.open).toBeLessThanOrEqual(d.high);
        expect(d.close).toBeGreaterThanOrEqual(d.low);
        expect(d.close).toBeLessThanOrEqual(d.high);
      }
    }
  });

  it("同一檔重複取用結果相同（固定種子，SSR 與 client 必須一致）", () => {
    const a = getPrices("2330");
    const b = getPrices("2330");
    expect(a.map((d) => d.close)).toEqual(b.map((d) => d.close));
  });
});
