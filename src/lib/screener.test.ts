import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, PRESETS, describeRule, evaluate, resolveTarget, screen } from "./screener";
import { COMPANY_BY_ID, METRICS_BY_ID, isOperatingCompany } from "./data/companies";
import type { Metrics, Rule } from "./schema";

/**
 * 相對條件（高於去年 / 低於同業平均）是這個工具跟一般數值篩選器的差異點，
 * 也是最容易靜默算錯的地方 —— 門檻算錯時畫面上完全看不出來，
 * 使用者只會拿到一份錯的名單。
 *
 * 資料換成真實 TWSE 快照後，這些測試刻意不寫死任何數值 ——
 * 全部由 METRICS_BY_ID 讀當下的實際值，資料每次更新時斷言仍然成立，
 * 驗的是「計算邏輯」而不是「某一天的數字」。
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
    const industry = COMPANY_BY_ID.get("2330")?.industry;
    // 收錄範圍內、同產業、非自己、ROE 有值的同業
    const peers = [...METRICS_BY_ID.values()].filter(
      (p) =>
        p.stockId !== "2330" &&
        isOperatingCompany(p.stockId) &&
        COMPANY_BY_ID.get(p.stockId)?.industry === industry &&
        p.roe !== null,
    );
    expect(peers.length).toBeGreaterThan(0);
    const expected =
      peers.reduce((s, p) => s + (p.roe as number), 0) / peers.length;

    const actual = resolveTarget(m2330, rule("roe", "gt", { kind: "industryAvg" }));
    expect(actual).toBeCloseTo(expected, 1);

    // 若誤把自己算進去，平均會被 2330 自身的 ROE 拉動，數值會不同
    const withSelf =
      [m2330, ...peers].reduce((s, p) => s + (p.roe as number), 0) / (peers.length + 1);
    expect(actual).not.toBeCloseTo(withSelf, 2);
  });

  it("ETF 不進入同業平均", () => {
    const etf = METRICS_BY_ID.get("0050") as Metrics;
    expect(isOperatingCompany(etf.stockId)).toBe(false);
    expect(COMPANY_BY_ID.get("0050")?.industry).toBe("ETF");

    const avg = resolveTarget(m2330, rule("debtRatio", "lt", { kind: "industryAvg" }));
    expect(avg).not.toBeNull();
    expect(avg as number).toBeGreaterThan(0);
  });

  it("同產業只有自己時退回自身值，不會除以零", () => {
    // 通信網路業在收錄範圍內只有 2412 一檔
    const solo = METRICS_BY_ID.get("2412") as Metrics;
    const avg = resolveTarget(solo, rule("roe", "gt", { kind: "industryAvg" }));
    expect(Number.isFinite(avg as number)).toBe(true);
    expect(avg).toBe(solo.roe);
  });
});

describe("resolveTarget — 去年同期", () => {
  it("EPS 的去年基期低於今年（成長股），且為有限數", () => {
    const ly = resolveTarget(m2330, rule("eps", "gt", { kind: "lastYear" }));
    expect(ly).not.toBeNull();
    expect(Number.isFinite(ly as number)).toBe(true);
    expect(ly as number).toBeLessThan(m2330.eps as number);
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

describe("缺值處理", () => {
  it("虧損股（無本益比）在 PE 條件上一律不通過，而不是被當成 0 通過", () => {
    // 1301 台塑虧損，pe 為 null。「PE < 20」不該把它算成通過
    const taso = METRICS_BY_ID.get("1301");
    expect(taso?.pe).toBeNull();
    const res = evaluate([rule("pe", "lt", { kind: "value", value: 20 })]).find(
      (r) => r.stockId === "1301",
    );
    expect(res?.passed).toBe(false);
    expect(res?.ruleResults[0].actual).toBeNull();
  });
});

describe("市值的單位換算", () => {
  it("marketCap 以「億元」比較，不是以元", () => {
    const results = evaluate([rule("marketCap", "gt", { kind: "value", value: 5_000 })]);
    const actual = results.find((x) => x.stockId === "2330")?.ruleResults[0].actual;
    expect(actual).toBeCloseTo((m2330.marketCap as number) / 1e8, 0);
    // 台積電市值是兆元等級，換算成億元應為數十萬
    expect(actual as number).toBeGreaterThan(100_000);
  });
});

describe("比較運算子", () => {
  it("gt 嚴格大於、gte 允許相等", () => {
    const eq = { kind: "value", value: m2330.roe as number } as const;
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
    const pass = rule("roe", "gt", { kind: "value", value: 5 });
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

  it("PRD 範例條件下 2330 通過（高 ROE、營收年增、低負債、PE 低於同業）", () => {
    const hit = screen(DEFAULT_RULES).find((r) => r.stockId === "2330");
    expect(hit).toBeDefined();
    expect(hit?.ruleResults.every((r) => r.passed)).toBe(true);
  });
});

describe("PRESETS", () => {
  it("每組預設條件都是完整可用的，且至少篩得出一檔", () => {
    for (const preset of PRESETS) {
      expect(preset.rules.length).toBeGreaterThan(0);
      const ids = preset.rules.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(screen(preset.rules).length, preset.name).toBeGreaterThan(0);
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
