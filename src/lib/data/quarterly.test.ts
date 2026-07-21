import { describe, expect, it } from "vitest";
import { METRICS_BY_ID, isOperatingCompany } from "./companies";
import { getDerivedSeries, getQuarterly } from "./financials";
import type { Metrics } from "@/lib/schema";

/**
 * 逐季財報來自 MOPS，經「累計相減」還原成單季（見 scripts/twse/financials-history.ts）。
 * 那段相減最容易靜默算錯 —— 抓錯欄位（把三個月單季當累計）時，數字看起來仍合理，
 * 只有內部一致性湊不起來。這裡驗的是那些一致性，不寫死任何當日數字。
 */

const general = [...METRICS_BY_ID.values()]
  .map((m) => m.stockId)
  .filter((id) => getQuarterly(id).length > 0);

describe("逐季財報的取得範圍", () => {
  it("有一般業取得到真實逐季資料", () => {
    expect(general.length).toBeGreaterThan(0);
    expect(getQuarterly("2330").length).toBeGreaterThan(0);
  });

  it("金控（2891）與 ETF（0050）沒有逐季資料，回空陣列而非破值", () => {
    expect(getQuarterly("2891")).toEqual([]);
    expect(getQuarterly("0050")).toEqual([]);
  });

  it("有逐季資料的都是收錄的營運公司", () => {
    for (const id of general) expect(isOperatingCompany(id), id).toBe(true);
  });
});

describe("每一季的欄位都是合理的實際值", () => {
  it("季別由舊到新排序，且不超過收集上限", () => {
    for (const id of general) {
      const qs = getQuarterly(id);
      expect(qs.length, id).toBeLessThanOrEqual(12);
      const keys = qs.map((q) => q.year * 4 + q.quarter);
      expect(keys, id).toEqual([...keys].sort((a, b) => a - b));
    }
  });

  it("營收、權益、資產為正；資本支出非負；季別合法", () => {
    for (const id of general) {
      for (const q of getQuarterly(id)) {
        const at = `${id} ${q.year}Q${q.quarter}`;
        expect(q.revenue, at).toBeGreaterThan(0);
        expect(q.equity, at).toBeGreaterThan(0);
        expect(q.asset, at).toBeGreaterThan(0);
        expect(q.capex, at).toBeGreaterThanOrEqual(0);
        expect(q.quarter, at).toBeGreaterThanOrEqual(1);
        expect(q.quarter, at).toBeLessThanOrEqual(4);
      }
    }
  });
});

describe("衍生序列與原始逐季內部一致", () => {
  it("毛利率 = 毛利 ÷ 營收，逐點吻合（欄位抓錯時這裡會爆）", () => {
    for (const id of general) {
      const qs = getQuarterly(id);
      const derived = getDerivedSeries(id);
      expect(derived.length, id).toBe(qs.length);
      qs.forEach((q, i) => {
        const at = `${id} ${q.year}Q${q.quarter}`;
        expect(derived[i].grossMargin, at).toBeCloseTo((q.grossProfit / q.revenue) * 100, 1);
        expect(derived[i].netMargin, at).toBeCloseTo((q.netIncome / q.revenue) * 100, 1);
      });
    }
  });
});

describe("metrics.fcf 由逐季現金流回推，兩者必須對得上", () => {
  it("fcf = 近四季 Σ(營業現金流 − 資本支出)", () => {
    for (const id of general) {
      const qs = getQuarterly(id);
      if (qs.length < 4) continue;
      const expected = qs
        .slice(-4)
        .reduce((s, q) => s + q.operatingCashFlow - q.capex, 0);
      const m = METRICS_BY_ID.get(id) as Metrics;
      expect(m.fcf, id).toBe(expected);
    }
  });

  it("金控與 ETF 沒有現金流量表，fcf 為 null", () => {
    expect((METRICS_BY_ID.get("2891") as Metrics).fcf).toBeNull();
    expect((METRICS_BY_ID.get("0050") as Metrics).fcf).toBeNull();
  });
});

describe("epsCagr5y", () => {
  it("有值時為有限數，否則為 null（拿不到五年兩端點）", () => {
    for (const id of general) {
      const v = (METRICS_BY_ID.get(id) as Metrics).epsCagr5y;
      if (v !== null) expect(Number.isFinite(v), id).toBe(true);
    }
  });
});
