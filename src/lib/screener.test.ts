import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, PRESETS, describeRule, evaluate, resolveTarget, screen } from "./screener";
import { COMPANY_BY_ID, METRICS_BY_ID, isOperatingCompany } from "./mock/companies";
import type { Metrics, Rule } from "./schema";

/**
 * 相對條件（高於去年 / 低於同業平均）是這個工具跟一般數值篩選器的差異點，
 * 也是最容易靜默算錯的地方 —— 門檻算錯時畫面上完全看不出來，
 * 使用者只會拿到一份錯的名單。
 */

const m2330 = METRICS_BY_ID.get("2330") as Metrics;
const rule = (metric: Rule["metric"], comparator: Rule["comparator"], target: Rule["target"]): Rule => ({
  id: "t",
  metric,
  comparator,
  target,
});

describe("resolveTarget — 絕對值", () => {
  it("直接回傳設定值", () => {
    expect(resolveTarget(m2330, rule("roe", "gt", { kind: "value", value: 15 }))).toBe(15);
  });
});

describe("resolveTarget — 產業平均", () => {
  it("PE 用個股自帶的產業本益比", () => {
    expect(resolveTarget(m2330, rule("pe", "lt", { kind: "industryAvg" }))).toBe(
      m2330.industryPe,
    );
  });

  it("其他指標取同業平均，且不把自己算進去", () => {
    const peers = ["2454", "3711", "3034"].map((id) => METRICS_BY_ID.get(id) as Metrics);
    const expected = peers.reduce((s, p) => s + p.roe, 0) / peers.length;

    const actual = resolveTarget(m2330, rule("roe", "gt", { kind: "industryAvg" }));
    expect(actual).toBeCloseTo(expected, 2);

    // 若誤把自己算進去，2330 的 ROE 30.4 會把平均往上拉，數值會不同
    const withSelf = [m2330, ...peers].reduce((s, p) => s + p.roe, 0) / 4;
    expect(actual).not.toBeCloseTo(withSelf, 2);
  });

  it("ETF 不進入同業平均", () => {
    // 0050 的 roe/debtRatio 全為 0，一旦被算進任何產業都會把平均嚴重拉低
    const etf = METRICS_BY_ID.get("0050") as Metrics;
    expect(isOperatingCompany(etf.stockId)).toBe(false);
    expect(COMPANY_BY_ID.get("0050")?.industry).toBe("ETF");

    const avg = resolveTarget(m2330, rule("debtRatio", "lt", { kind: "industryAvg" }));
    expect(avg).toBeGreaterThan(0);
  });

  it("同產業只有自己時退回自身值，不會除以零", () => {
    // 通信網路業只有 2412 一檔
    const solo = METRICS_BY_ID.get("2412") as Metrics;
    const avg = resolveTarget(solo, rule("roe", "gt", { kind: "industryAvg" }));
    expect(Number.isFinite(avg)).toBe(true);
    expect(avg).toBe(solo.roe);
  });
});

describe("resolveTarget — 去年同期", () => {
  it("EPS 用 5 年 CAGR 回推基期", () => {
    const ly = resolveTarget(m2330, rule("eps", "gt", { kind: "lastYear" }));
    expect(ly).toBeCloseTo(m2330.eps / (1 + m2330.epsCagr5y / 100), 2);
    // 成長股的去年 EPS 必須低於今年
    expect(ly).toBeLessThan(m2330.eps);
  });

  it("同一檔個股重算結果完全相同（SSR / client 必須一致）", () => {
    const r = rule("grossMargin", "gt", { kind: "lastYear" });
    const first = resolveTarget(m2330, r);
    for (let i = 0; i < 5; i++) {
      expect(resolveTarget(m2330, r)).toBe(first);
    }
  });

  it("不同個股、不同指標拿到不同基期（seed 有確實區分）", () => {
    const other = METRICS_BY_ID.get("2308") as Metrics;
    const r = rule("grossMargin", "gt", { kind: "lastYear" });
    expect(resolveTarget(m2330, r)).not.toBe(resolveTarget(other, r));

    const r2 = rule("netMargin", "gt", { kind: "lastYear" });
    expect(resolveTarget(m2330, r)).not.toBe(resolveTarget(m2330, r2));
  });
});

describe("市值的單位換算", () => {
  it("marketCap 以「億元」比較，不是以元", () => {
    // 條件寫 5000 代表 5000 億。若忘了換算，28.14 兆會被拿去跟 5000 比。
    const results = evaluate([rule("marketCap", "gt", { kind: "value", value: 5_000 })]);
    const actual = results.find((x) => x.stockId === "2330")?.ruleResults[0].actual;
    expect(actual).toBeCloseTo(m2330.marketCap / 1e8, 0);
    expect(actual).toBeCloseTo(281_400, 0);
  });
});

describe("比較運算子", () => {
  it("gt 嚴格大於、gte 允許相等", () => {
    const eq = { kind: "value", value: m2330.roe } as const;
    const gt = evaluate([rule("roe", "gt", eq)]).find((r) => r.stockId === "2330");
    const gte = evaluate([rule("roe", "gte", eq)]).find((r) => r.stockId === "2330");
    expect(gt?.passed).toBe(false);
    expect(gte?.passed).toBe(true);
  });
});

describe("screen", () => {
  it("沒有條件時回傳空陣列，而不是全部個股", () => {
    expect(screen([])).toEqual([]);
  });

  it("ETF 不出現在結果中（沒有財報可篩）", () => {
    const all = evaluate([rule("pb", "gt", { kind: "value", value: 0 })]);
    expect(all.map((r) => r.stockId)).not.toContain("0050");
  });

  it("多條件為 AND：只要一條不過就整檔淘汰", () => {
    const pass = rule("roe", "gt", { kind: "value", value: 15 });
    const fail = rule("roe", "gt", { kind: "value", value: 999 });
    expect(screen([pass]).length).toBeGreaterThan(0);
    expect(screen([pass, fail])).toEqual([]);
  });

  it("結果依分數由高至低排序", () => {
    const results = screen([rule("pb", "gt", { kind: "value", value: 0 })]);
    expect(results.length).toBeGreaterThan(1);
    const scores = results.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("PRD 範例條件下 2330 通過（ROE 30.4 / 營收年增 33.6 / 負債 29.6 / PE 低於同業）", () => {
    const hit = screen(DEFAULT_RULES).find((r) => r.stockId === "2330");
    expect(hit).toBeDefined();
    expect(hit?.ruleResults.every((r) => r.passed)).toBe(true);
  });
});

describe("PRESETS", () => {
  it("每組預設條件都是完整可用的，且至少篩得出一檔", () => {
    for (const preset of PRESETS) {
      expect(preset.rules.length).toBeGreaterThan(0);
      // 規則 id 必須唯一，否則 React list key 會重複
      const ids = preset.rules.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(screen(preset.rules).length).toBeGreaterThan(0);
    }
  });

  it("跨組的規則 id 不重疊（切換預設時不會殘留舊列）", () => {
    const all = PRESETS.flatMap((p) => p.rules.map((r) => r.id));
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("describeRule", () => {
  it("三種比較基準都描述得出來", () => {
    expect(describeRule(rule("roe", "gt", { kind: "value", value: 15 }))).toBe("ROE > 15%");
    expect(describeRule(rule("eps", "gt", { kind: "lastYear" }))).toContain("去年");
    expect(describeRule(rule("pe", "lt", { kind: "industryAvg" }))).toContain("產業平均");
  });
});
