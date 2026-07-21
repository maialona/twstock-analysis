import { describe, expect, it } from "vitest";
import { METRICS_BY_ID, isOperatingCompany } from "./companies";
import { getDerivedSeries, getDividends, getQuarterly } from "./financials";
import type { Metrics } from "@/lib/schema";

/**
 * 逐季財報來自 MOPS，經「累計相減」還原成單季（見 scripts/twse/financials-history.ts）。
 * 那段相減最容易靜默算錯 —— 抓錯欄位（把三個月單季當累計）時，數字看起來仍合理，
 * 只有內部一致性湊不起來。這裡驗的是那些一致性，不寫死任何當日數字。
 *
 * 金控（2891）走 step=2 的合併報表：有淨利／EPS／權益，但沒有營收與利潤結構，
 * 那幾欄為 null。一般業則全欄皆有。
 */

const withQuarterly = [...METRICS_BY_ID.values()]
  .map((m) => m.stockId)
  .filter((id) => getQuarterly(id).length > 0);

// 一般業＝逐季有營收者；金控＝有逐季但營收為 null 者
const general = withQuarterly.filter((id) => getQuarterly(id)[0].revenue !== null);
const financialHolding = withQuarterly.filter((id) => getQuarterly(id)[0].revenue === null);

describe("逐季財報的取得範圍", () => {
  it("一般業與金控都取得到真實逐季資料", () => {
    expect(general.length).toBeGreaterThan(0);
    expect(getQuarterly("2330").length).toBeGreaterThan(0);
    expect(getQuarterly("2891").length).toBeGreaterThan(0);
  });

  it("金控 2891 有淨利／EPS／權益，但沒有營收與利潤結構（那幾欄為 null）", () => {
    expect(financialHolding).toContain("2891");
    for (const q of getQuarterly("2891")) {
      expect(q.revenue, `2891 ${q.year}Q${q.quarter}`).toBeNull();
      expect(q.operatingCashFlow).toBeNull();
      expect(Number.isFinite(q.eps)).toBe(true);
      expect(q.equity).toBeGreaterThan(0);
    }
  });

  it("ETF（0050）沒有逐季資料，回空陣列", () => {
    expect(getQuarterly("0050")).toEqual([]);
  });

  it("有逐季資料的都是收錄的營運公司", () => {
    for (const id of withQuarterly) expect(isOperatingCompany(id), id).toBe(true);
  });
});

describe("每一季的欄位都是合理的實際值", () => {
  it("季別由舊到新排序，且不超過收集上限", () => {
    for (const id of withQuarterly) {
      const qs = getQuarterly(id);
      expect(qs.length, id).toBeLessThanOrEqual(12);
      const keys = qs.map((q) => q.year * 4 + q.quarter);
      expect(keys, id).toEqual([...keys].sort((a, b) => a - b));
    }
  });

  it("淨利核心欄（權益、資產）為正；季別合法", () => {
    for (const id of withQuarterly) {
      for (const q of getQuarterly(id)) {
        const at = `${id} ${q.year}Q${q.quarter}`;
        expect(q.equity, at).toBeGreaterThan(0);
        expect(q.asset, at).toBeGreaterThan(0);
        expect(q.quarter, at).toBeGreaterThanOrEqual(1);
        expect(q.quarter, at).toBeLessThanOrEqual(4);
      }
    }
  });

  it("一般業另有正的營收與非負的資本支出", () => {
    for (const id of general) {
      for (const q of getQuarterly(id)) {
        const at = `${id} ${q.year}Q${q.quarter}`;
        expect(q.revenue as number, at).toBeGreaterThan(0);
        expect(q.capex as number, at).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("衍生序列與原始逐季內部一致", () => {
  it("一般業毛利率／淨利率 = 對應項 ÷ 營收，逐點吻合（欄位抓錯時這裡會爆）", () => {
    for (const id of general) {
      const qs = getQuarterly(id);
      const derived = getDerivedSeries(id);
      expect(derived.length, id).toBe(qs.length);
      qs.forEach((q, i) => {
        const at = `${id} ${q.year}Q${q.quarter}`;
        expect(derived[i].grossMargin as number, at).toBeCloseTo(
          ((q.grossProfit as number) / (q.revenue as number)) * 100,
          1,
        );
        expect(derived[i].netMargin as number, at).toBeCloseTo(
          (q.netIncome / (q.revenue as number)) * 100,
          1,
        );
      });
    }
  });

  it("金控的利潤率為 null，但 EPS 仍有值（EPS 圖照畫、利潤率圖不畫）", () => {
    for (const id of financialHolding) {
      for (const d of getDerivedSeries(id)) {
        expect(d.grossMargin, id).toBeNull();
        expect(Number.isFinite(d.eps), id).toBe(true);
      }
    }
  });
});

describe("metrics.fcf 由逐季現金流回推，兩者必須對得上", () => {
  it("一般業 fcf = 近四季 Σ(營業現金流 − 資本支出)", () => {
    for (const id of general) {
      const qs = getQuarterly(id);
      if (qs.length < 4) continue;
      const expected = qs
        .slice(-4)
        .reduce((s, q) => s + (q.operatingCashFlow as number) - (q.capex as number), 0);
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
    for (const id of withQuarterly) {
      const v = (METRICS_BY_ID.get(id) as Metrics).epsCagr5y;
      if (v !== null) expect(Number.isFinite(v), id).toBe(true);
    }
  });
});

describe("歷年股利（真實，來自 MOPS 股利分派）", () => {
  it("知名配息股有歷年股利，ETF 沒有公司股利", () => {
    expect(getDividends("2330").length).toBeGreaterThan(0);
    expect(getDividends("2891").length).toBeGreaterThan(0);
    expect(getDividends("0050")).toEqual([]);
  });

  it("年度遞增、現金與股票股利非負、殖利率合理", () => {
    for (const id of [...general, ...financialHolding]) {
      const ds = getDividends(id);
      const years = ds.map((d) => d.year);
      expect(years, id).toEqual([...years].sort((a, b) => a - b));
      for (const d of ds) {
        expect(d.cashDividend, `${id} ${d.year}`).toBeGreaterThanOrEqual(0);
        expect(d.stockDividend, `${id} ${d.year}`).toBeGreaterThanOrEqual(0);
        expect(d.yieldPct, `${id} ${d.year}`).toBeGreaterThanOrEqual(0);
        expect(d.yieldPct, `${id} ${d.year}`).toBeLessThan(30); // 殖利率破 30% 幾乎必是解析錯誤
      }
    }
  });
});
