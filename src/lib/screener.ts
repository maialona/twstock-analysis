import {
  METRIC_META,
  type Comparator,
  type Metrics,
  type MetricKey,
  type Rule,
} from "@/lib/schema";
import { COMPANY_BY_ID, METRICS, isOperatingCompany } from "@/lib/data/companies";
import { getScore } from "@/lib/data/scoring";
import { mulberry32, round, seedFrom } from "@/lib/rng";

/**
 * Screener 評估引擎（PRD 第七節）。
 * 支援三種比較基準：絕對值、去年同期、產業平均 —
 * 後兩者是本工具與一般數值篩選器的差異點。
 *
 * 真實資料會有缺值（虧損股沒有本益比、金融股沒有毛利率）。缺值一律
 * 讓該檔在該條件上「不通過」，而不是當成 0 —— 用不存在的數字去比大小，
 * 得到的通過或不通過都沒有意義。
 */

function metricValue(m: Metrics, key: MetricKey): number | null {
  if (key === "marketCap") return m.marketCap === null ? null : m.marketCap / 1e8; // 億元
  return m[key];
}

/**
 * 去年同期值。真實系統會查 DB 的歷史財報；此處免費端點沒有歷史，
 * 以穩定 PRNG 反推一個合理基期作為近似（模型值，非實際歷史）。
 * 當期值本身缺漏時無法反推，回 null。
 */
function lastYearValue(m: Metrics, key: MetricKey): number | null {
  const current = metricValue(m, key);
  if (current === null) return null;
  const rand = mulberry32(seedFrom(`${m.stockId}-${key}-ly`));

  if (key === "eps") {
    // 沒有五年 CAGR 就用溫和折讓近似，不硬套 null
    const g = m.epsCagr5y ?? 8;
    return round(current / (1 + g / 100), 2);
  }
  if (key === "revenueYoy") return round(current - (rand() * 8 - 3), 1);
  if (key === "marketCap") return round(current / (1 + (m.revenueYoy ?? 8) / 100), 0);

  const drift = (rand() - 0.45) * 0.14;
  return round(current * (1 - drift), 2);
}

function industryAvgValue(m: Metrics, key: MetricKey): number | null {
  if (key === "pe") return m.industryPe;

  // 同產業其他個股的平均（略過缺值者）
  const peers = METRICS.filter(
    (p) =>
      p.stockId !== m.stockId &&
      isOperatingCompany(p.stockId) &&
      industryOf(p.stockId) === industryOf(m.stockId),
  );
  const values = peers
    .map((p) => metricValue(p, key))
    .filter((v): v is number => v !== null);
  if (values.length === 0) return metricValue(m, key);
  return round(values.reduce((s, v) => s + v, 0) / values.length, 2);
}

function industryOf(stockId: string): string {
  return COMPANY_BY_ID.get(stockId)?.industry ?? "";
}

export function resolveTarget(m: Metrics, rule: Rule): number | null {
  switch (rule.target.kind) {
    case "value":
      return rule.target.value;
    case "lastYear":
      return lastYearValue(m, rule.metric);
    case "industryAvg":
      return industryAvgValue(m, rule.metric);
  }
}

function compare(a: number | null, op: Comparator, b: number | null): boolean {
  // 任一邊沒有數字，這條件就不成立 —— 不拿不存在的值去比大小
  if (a === null || b === null) return false;
  switch (op) {
    case "gt":
      return a > b;
    case "gte":
      return a >= b;
    case "lt":
      return a < b;
    case "lte":
      return a <= b;
  }
}

export type RuleResult = {
  rule: Rule;
  actual: number | null;
  target: number | null;
  passed: boolean;
};

export type ScreenResult = {
  stockId: string;
  passed: boolean;
  ruleResults: RuleResult[];
  score: number;
};

export function evaluate(rules: Rule[]): ScreenResult[] {
  return METRICS.filter((m) => isOperatingCompany(m.stockId)).map((m) => {
    const ruleResults = rules.map((rule) => {
      const actual = metricValue(m, rule.metric);
      const target = resolveTarget(m, rule);
      return { rule, actual, target, passed: compare(actual, rule.comparator, target) };
    });

    return {
      stockId: m.stockId,
      passed: ruleResults.every((r) => r.passed),
      ruleResults,
      score: getScore(m.stockId)?.total ?? 0,
    };
  });
}

/** 通過篩選的結果，依分數排序 */
export function screen(rules: Rule[]): ScreenResult[] {
  if (rules.length === 0) return [];
  return evaluate(rules)
    .filter((r) => r.passed)
    .sort((a, b) => b.score - a.score);
}

/** PRD 範例的預設條件組 */
export const DEFAULT_RULES: Rule[] = [
  { id: "r1", metric: "roe", comparator: "gt", target: { kind: "value", value: 15 } },
  {
    id: "r2",
    metric: "revenueYoy",
    comparator: "gt",
    target: { kind: "value", value: 10 },
  },
  {
    id: "r3",
    metric: "debtRatio",
    comparator: "lt",
    target: { kind: "value", value: 50 },
  },
  { id: "r4", metric: "pe", comparator: "lt", target: { kind: "industryAvg" } },
];

export const PRESETS: Array<{ name: string; description: string; rules: Rule[] }> = [
  {
    name: "PRD 範例",
    description: "ROE > 15%、營收年增 > 10%、負債比 < 50%、本益比低於產業平均",
    rules: DEFAULT_RULES,
  },
  {
    name: "高股息",
    description: "殖利率 > 3.5%、負債比 < 60%、EPS 高於去年",
    rules: [
      {
        id: "d1",
        metric: "dividendYield",
        comparator: "gt",
        target: { kind: "value", value: 3.5 },
      },
      {
        id: "d2",
        metric: "debtRatio",
        comparator: "lt",
        target: { kind: "value", value: 60 },
      },
      { id: "d3", metric: "eps", comparator: "gt", target: { kind: "lastYear" } },
    ],
  },
  {
    name: "成長動能",
    description: "營收年增 > 20%、毛利率高於去年、ROE > 20%",
    rules: [
      {
        id: "g1",
        metric: "revenueYoy",
        comparator: "gt",
        target: { kind: "value", value: 20 },
      },
      { id: "g2", metric: "grossMargin", comparator: "gt", target: { kind: "lastYear" } },
      { id: "g3", metric: "roe", comparator: "gt", target: { kind: "value", value: 20 } },
    ],
  },
];

export function describeRule(rule: Rule): string {
  const meta = METRIC_META[rule.metric];
  const op = { gt: ">", gte: "≥", lt: "<", lte: "≤" }[rule.comparator];
  const target =
    rule.target.kind === "value"
      ? `${rule.target.value}${meta.unit === "x" ? "" : meta.unit}`
      : rule.target.kind === "lastYear"
        ? "去年"
        : "產業平均";
  return `${meta.label} ${op} ${target}`;
}
