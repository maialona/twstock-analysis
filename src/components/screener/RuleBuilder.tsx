"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, X } from "@phosphor-icons/react/dist/ssr";
import {
  COMPARATOR_LABELS,
  METRIC_META,
  type Comparator,
  type MetricKey,
  type Rule,
} from "@/lib/schema";
import { DEFAULT_RULES, PRESETS, screen } from "@/lib/screener";
import { RULES_PARAM, decodeRules, encodeRules } from "@/lib/rule-url";
import { COMPANY_BY_ID } from "@/lib/mock/companies";
import { EmptyState } from "@/components/ui/states";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { cn, formatPrice } from "@/lib/format";

const METRIC_KEYS = Object.keys(METRIC_META) as MetricKey[];

/** 哪些指標支援「去年 / 產業平均」的相對比較 */
const RELATIVE_OK: Record<MetricKey, boolean> = {
  eps: true,
  roe: true,
  roa: true,
  pe: true,
  pb: true,
  dividendYield: true,
  debtRatio: true,
  grossMargin: true,
  operatingMargin: true,
  netMargin: true,
  revenueYoy: true,
  marketCap: false,
};

let idCounter = 0;
const nextId = () => `rule-${++idCounter}`;

/**
 * 條件狀態放在網址而不是 useState。
 *
 * 篩選條件是這個工具的產出之一 —— 調出一組有意義的條件之後，
 * 使用者會想把它存成書籤或貼給別人。放在 component state 裡，
 * 重新整理就沒了，也沒有東西可以分享。
 *
 * 用 replace 而非 push：每改一個下拉選單就多一筆上一頁紀錄，
 * 會讓返回鍵變得無法使用。scroll: false 是因為改條件不該把畫面捲回頂端。
 */
export function RuleBuilder() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 預設條件的 id 要和「編碼後再解碼」得到的一致（decodeRules 會依序配發
  // u0、u1…）。否則第一次改動時每一列的 key 都會變，React 視為全新節點，
  // 四列同時重播一次進場動畫 —— 只是改了一個下拉選單，看起來卻像整組被換掉。
  const rules = useMemo(
    () =>
      decodeRules(searchParams.get(RULES_PARAM)) ??
      DEFAULT_RULES.map((r, i) => ({ ...r, id: `u${i}` })),
    [searchParams],
  );

  const results = useMemo(() => screen(rules), [rules]);

  const setRules = useCallback(
    (next: Rule[]) => {
      const q = encodeRules(next);
      // 條件清空時把參數整個拿掉，而不是留一個 ?q=
      router.replace(q ? `${pathname}?${RULES_PARAM}=${q}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname],
  );

  function update(id: string, patch: Partial<Rule>) {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function remove(id: string) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function add() {
    setRules([
      ...rules,
      {
        id: nextId(),
        metric: "roe",
        comparator: "gt",
        target: { kind: "value", value: 15 },
      },
    ]);
  }

  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[22rem_1fr]">
      {/* ── 條件設定 ─────────────────────────────────── */}
      <div className="flex flex-col gap-5">
        <section>
          <h2 className="mb-2 text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
            常用組合
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                title={p.description}
                onClick={() =>
                  setRules(p.rules.map((r) => ({ ...r, id: nextId() })))
                }
                className="cursor-pointer rounded border border-border px-2.5 py-1 text-xs text-muted transition-all duration-150 hover:border-border-strong hover:text-text active:scale-[0.97]"
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
              篩選條件
            </h2>
            <span className="num text-[0.6875rem] text-faint">
              {rules.length} 項
            </span>
          </div>

          <ul className="flex flex-col gap-1.5">
            {/*
              條件列表刻意用純 CSS 進場動畫，不用 AnimatePresence。
              理由是可靠性：AnimatePresence 的 exit 依賴 rAF 驅動的動畫完成
              才會把節點從 DOM 移除。只要 rAF 被節流或不執行，舊節點就會留在
              DOM 裡，讓畫面上的條件與實際 state 不一致 —— 對一個「條件必須
              和結果精確對應」的篩選器來說，這個失敗模式的代價太高。
              退場動畫在這裡的價值不足以承擔這個風險。
            */}
            {rules.map((rule) => (
              <li
                key={rule.id}
                className="row-in flex items-center gap-1.5 rounded border border-border bg-surface p-1.5"
              >
                  {/* 指標 */}
                  <label className="sr-only" htmlFor={`m-${rule.id}`}>
                    指標
                  </label>
                  <select
                    id={`m-${rule.id}`}
                    value={rule.metric}
                    onChange={(e) => {
                      const metric = e.target.value as MetricKey;
                      // 切換到不支援相對比較的指標時，退回絕對值
                      const target =
                        !RELATIVE_OK[metric] && rule.target.kind !== "value"
                          ? { kind: "value" as const, value: 0 }
                          : rule.target;
                      update(rule.id, { metric, target });
                    }}
                    className="min-w-0 flex-1 cursor-pointer rounded bg-raised px-1.5 py-1 text-xs text-text outline-none"
                  >
                    {METRIC_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {METRIC_META[k].label}
                      </option>
                    ))}
                  </select>

                  {/* 運算子 */}
                  <label className="sr-only" htmlFor={`c-${rule.id}`}>
                    比較方式
                  </label>
                  <select
                    id={`c-${rule.id}`}
                    value={rule.comparator}
                    onChange={(e) =>
                      update(rule.id, { comparator: e.target.value as Comparator })
                    }
                    className="w-14 shrink-0 cursor-pointer rounded bg-raised px-1 py-1 text-center text-xs outline-none"
                  >
                    {(Object.keys(COMPARATOR_LABELS) as Comparator[]).map((c) => (
                      <option key={c} value={c}>
                        {{ gt: ">", gte: "≥", lt: "<", lte: "≤" }[c]}
                      </option>
                    ))}
                  </select>

                  {/* 比較基準 */}
                  <label className="sr-only" htmlFor={`t-${rule.id}`}>
                    比較基準
                  </label>
                  <select
                    id={`t-${rule.id}`}
                    value={rule.target.kind}
                    onChange={(e) => {
                      const kind = e.target.value as Rule["target"]["kind"];
                      update(rule.id, {
                        target:
                          kind === "value"
                            ? { kind: "value", value: 0 }
                            : kind === "lastYear"
                              ? { kind: "lastYear" }
                              : { kind: "industryAvg" },
                      });
                    }}
                    className="w-[4.5rem] shrink-0 cursor-pointer rounded bg-raised px-1 py-1 text-xs outline-none"
                  >
                    <option value="value">數值</option>
                    <option value="lastYear" disabled={!RELATIVE_OK[rule.metric]}>
                      去年
                    </option>
                    <option value="industryAvg" disabled={!RELATIVE_OK[rule.metric]}>
                      同業均
                    </option>
                  </select>

                  {/* 數值輸入 — 僅絕對值模式顯示 */}
                  {rule.target.kind === "value" && (
                    <>
                      <label className="sr-only" htmlFor={`v-${rule.id}`}>
                        比較數值
                      </label>
                      <input
                        id={`v-${rule.id}`}
                        type="number"
                        inputMode="decimal"
                        value={rule.target.value}
                        onChange={(e) =>
                          update(rule.id, {
                            target: { kind: "value", value: Number(e.target.value) },
                          })
                        }
                        className="num w-14 shrink-0 rounded bg-raised px-1.5 py-1 text-right text-xs outline-none focus:ring-1 focus:ring-accent"
                      />
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => remove(rule.id)}
                    aria-label={`移除條件：${METRIC_META[rule.metric].label}`}
                    className="shrink-0 cursor-pointer rounded p-1 text-faint transition-colors hover:text-up"
                  >
                    <X size={13} weight="bold" />
                  </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={add}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-dashed border-border py-2 text-xs text-muted transition-all duration-150 hover:border-border-strong hover:text-text active:scale-[0.99]"
          >
            <Plus size={13} weight="bold" />
            新增條件
          </button>
        </section>

        <Disclaimer variant="inline" />
      </div>

      {/* ── 結果 ─────────────────────────────────────── */}
      <div className="min-w-0">
        <div className="mb-3 flex items-baseline justify-between border-t border-border pt-4">
          <h2 className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
            符合條件
          </h2>
          <span key={results.length} className="row-in num text-xs text-muted">
            {results.length} 檔
          </span>
        </div>

        {rules.length === 0 ? (
          <EmptyState
            title="尚未設定任何條件"
            description="從上方選一個常用組合開始，或按「新增條件」自行組合。條件之間以 AND 串接，全部符合才會列入結果。"
            action={
              <button
                type="button"
                onClick={() => setRules(DEFAULT_RULES.map((r) => ({ ...r, id: nextId() })))}
                className="cursor-pointer rounded border border-border-strong px-2.5 py-1 text-xs transition-transform duration-150 active:scale-[0.97]"
              >
                套用 PRD 範例條件
              </button>
            }
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="沒有個股符合全部條件"
            description="條件之間以 AND 串接，越多條件通過率越低。試著放寬數值門檻、移除最嚴格的一項，或把「數值」改成「同業均」讓門檻隨產業浮動。"
            action={
              <button
                type="button"
                onClick={() => setRules(rules.slice(0, -1))}
                className="cursor-pointer rounded border border-border-strong px-2.5 py-1 text-xs transition-transform duration-150 active:scale-[0.97]"
              >
                移除最後一項條件
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-xs">
              <thead>
                <tr className="th-sticky border-b border-border text-left text-faint">
                  <th scope="col" className="py-2 pr-3 font-medium">代號</th>
                  <th scope="col" className="py-2 pr-3 font-medium">名稱</th>
                  <th scope="col" className="py-2 pr-3 font-medium">產業</th>
                  {rules.map((r) => (
                    <th
                      key={r.id}
                      scope="col"
                      className="py-2 pr-3 text-right font-medium"
                    >
                      {METRIC_META[r.metric].label}
                    </th>
                  ))}
                  <th scope="col" className="py-2 text-right font-medium">分數</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {results.map((res) => {
                    const c = COMPANY_BY_ID.get(res.stockId)!;
                    return (
                      <tr
                        key={res.stockId}
                        className="row-in h-8 transition-colors hover:bg-surface"
                      >
                        <td className="num py-1 pr-3">
                          <Link
                            href={`/stock/${res.stockId}`}
                            className="text-accent hover:underline"
                          >
                            {res.stockId}
                          </Link>
                        </td>
                        <td className="py-1 pr-3 text-text">
                          {c.companyName}
                        </td>
                        <td className="py-1 pr-3 text-faint">{c.industry}</td>
                        {res.ruleResults.map((rr) => (
                          <td
                            key={rr.rule.id}
                            className="num py-1 pr-3 text-right"
                            title={`門檻 ${formatPrice(rr.target, 1)}`}
                          >
                            {formatPrice(rr.actual, METRIC_META[rr.rule.metric].digits)}
                            <span className="ml-0.5 text-[0.625rem] text-faint">
                              {METRIC_META[rr.rule.metric].unit === "x"
                                ? "x"
                                : METRIC_META[rr.rule.metric].unit}
                            </span>
                          </td>
                        ))}
                        <td className="py-1 text-right">
                          <span
                            className={cn(
                              "num",
                              res.score >= 70
                                ? "text-text"
                                : "text-muted",
                            )}
                          >
                            {res.score}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
