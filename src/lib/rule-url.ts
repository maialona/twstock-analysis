import {
  ComparatorSchema,
  MetricKeySchema,
  type Rule,
  type Target,
} from "@/lib/schema";

/**
 * 篩選條件 ⇄ 網址參數。
 *
 * 格式：`指標:運算子:基準`，條件之間以逗號分隔。
 *   roe:gt:15,revenueYoy:gt:10,debtRatio:lt:50,pe:lt:ia
 *
 * 基準是數字就是絕對值，`ly` = 去年同期，`ia` = 同業平均。
 *
 * 刻意不用 JSON + base64：篩選條件是要貼給別人看的東西，
 * 網址列裡看得懂的字串本身就是說明。指標與運算子都是列舉，
 * 數字也不含逗號或冒號，所以不需要跳脫。
 *
 * id 不進網址 —— 它只是 React 的 key，沒有語意，
 * 而且放進去會讓同一組條件產生不同的網址。解析時重新配發。
 */

const SEP_RULE = ",";
const SEP_FIELD = ":";

function encodeTarget(t: Target): string {
  switch (t.kind) {
    case "value":
      return String(t.value);
    case "lastYear":
      return "ly";
    case "industryAvg":
      return "ia";
  }
}

function decodeTarget(raw: string): Target | null {
  if (raw === "ly") return { kind: "lastYear" };
  if (raw === "ia") return { kind: "industryAvg" };
  // Number("") 是 0、Number(" ") 也是 0 —— 空字串不該被當成有效門檻
  if (raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value)) return null;
  return { kind: "value", value };
}

export function encodeRules(rules: Rule[]): string {
  return rules
    .map((r) => [r.metric, r.comparator, encodeTarget(r.target)].join(SEP_FIELD))
    .join(SEP_RULE);
}

/**
 * 解析網址參數。
 *
 * 輸入不可信（可能是別人貼來的、手改的、或舊版格式），
 * 因此逐條驗證，**跳過壞掉的那一條而不是整組放棄** ——
 * 分享出去的網址少一個條件，比整個篩選器退回預設值好懂。
 * 完全解析不出任何一條時回傳 null，由呼叫端決定預設行為。
 */
export function decodeRules(raw: string | null): Rule[] | null {
  if (!raw) return null;

  const rules: Rule[] = [];
  for (const chunk of raw.split(SEP_RULE)) {
    const parts = chunk.split(SEP_FIELD);
    if (parts.length !== 3) continue;

    const [m, c, t] = parts;
    const metric = MetricKeySchema.safeParse(m);
    const comparator = ComparatorSchema.safeParse(c);
    if (!metric.success || !comparator.success) continue;

    const target = decodeTarget(t);
    if (target === null) continue;

    rules.push({
      id: `u${rules.length}`,
      metric: metric.data,
      comparator: comparator.data,
      target,
    });
  }

  return rules.length > 0 ? rules : null;
}

/** 網址參數名。短，因為它會出現在分享出去的連結裡。 */
export const RULES_PARAM = "q";
