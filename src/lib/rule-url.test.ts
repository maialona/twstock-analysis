import { describe, expect, it } from "vitest";
import { decodeRules, encodeRules } from "./rule-url";
import { DEFAULT_RULES, PRESETS } from "./screener";
import type { Rule } from "./schema";

/** 比對時忽略 id —— id 只是 React 的 key，解析時會重新配發 */
const withoutIds = (rules: Rule[]) =>
  rules.map((r) => ({
    metric: r.metric,
    comparator: r.comparator,
    target: r.target,
  }));

describe("篩選條件的網址編解碼", () => {
  it("預設條件可以來回轉換不失真", () => {
    expect(withoutIds(decodeRules(encodeRules(DEFAULT_RULES))!)).toEqual(
      withoutIds(DEFAULT_RULES),
    );
  });

  it("每一組常用組合都可以來回轉換不失真", () => {
    for (const preset of PRESETS) {
      const round = decodeRules(encodeRules(preset.rules));
      expect(withoutIds(round!), preset.name).toEqual(withoutIds(preset.rules));
    }
  });

  it("編出來的字串是看得懂的，不是 base64", () => {
    expect(encodeRules(DEFAULT_RULES)).toBe(
      "roe:gt:15,revenueYoy:gt:10,debtRatio:lt:50,pe:lt:ia",
    );
  });

  it("相對條件用 ly / ia 表示", () => {
    const rules: Rule[] = [
      { id: "a", metric: "eps", comparator: "gt", target: { kind: "lastYear" } },
      { id: "b", metric: "pe", comparator: "lt", target: { kind: "industryAvg" } },
    ];
    expect(encodeRules(rules)).toBe("eps:gt:ly,pe:lt:ia");
    expect(withoutIds(decodeRules("eps:gt:ly,pe:lt:ia")!)).toEqual(
      withoutIds(rules),
    );
  });

  it("負數與小數都能正確還原", () => {
    const rules: Rule[] = [
      {
        id: "a",
        metric: "revenueYoy",
        comparator: "gt",
        target: { kind: "value", value: -5.5 },
      },
    ];
    const round = decodeRules(encodeRules(rules))!;
    expect(round[0].target).toEqual({ kind: "value", value: -5.5 });
  });

  it("解析出來的 id 彼此不重複（React key 不能撞）", () => {
    const ids = decodeRules("roe:gt:15,pe:lt:ia,eps:gt:ly")!.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("不可信輸入", () => {
    it("空值回傳 null 讓呼叫端用預設值", () => {
      expect(decodeRules(null)).toBeNull();
      expect(decodeRules("")).toBeNull();
    });

    it("完全無法解析時回傳 null", () => {
      expect(decodeRules("garbage")).toBeNull();
      expect(decodeRules(":::")).toBeNull();
      expect(decodeRules("notAMetric:gt:5")).toBeNull();
    });

    it("跳過壞掉的單條，保留其餘 —— 少一個條件比整組退回預設好", () => {
      const rules = decodeRules("roe:gt:15,bogus:gt:1,pe:lt:ia")!;
      expect(rules).toHaveLength(2);
      expect(rules.map((r) => r.metric)).toEqual(["roe", "pe"]);
    });

    it("不合法的運算子會被剔除", () => {
      expect(decodeRules("roe:BETWEEN:15")).toBeNull();
    });

    it("門檻不是數字就剔除（空字串不可當成 0）", () => {
      expect(decodeRules("roe:gt:")).toBeNull();
      expect(decodeRules("roe:gt: ")).toBeNull();
      expect(decodeRules("roe:gt:abc")).toBeNull();
      expect(decodeRules("roe:gt:Infinity")).toBeNull();
    });

    it("欄位數不對就剔除", () => {
      expect(decodeRules("roe:gt")).toBeNull();
      expect(decodeRules("roe:gt:15:extra")).toBeNull();
    });
  });
});
