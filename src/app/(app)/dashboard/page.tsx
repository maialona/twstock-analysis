import Link from "next/link";
import type { Metadata } from "next";
import { CountUp } from "@/components/data/CountUp";
import { DeltaValue } from "@/components/data/DeltaValue";
import { Sparkline } from "@/components/data/Sparkline";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { COMPANIES, METRICS_BY_ID } from "@/lib/mock/companies";
import { RANKED_SCORES } from "@/lib/mock/scoring";
import {
  MARKET_BREADTH,
  MARKET_INDICES,
  MARKET_INSTITUTIONAL,
  MARKET_TURNOVER,
  getCloseSeries,
} from "@/lib/mock/prices";
import { cn, formatInt, formatPct, formatPrice, formatTWD } from "@/lib/format";

export const metadata: Metadata = { title: "市場概況" };

/**
 * Dashboard — density 8（cockpit）。
 * 不使用 card 容器，全部以 1px 分隔線與負空間分組。
 */
export default function DashboardPage() {
  const breadthTotal =
    MARKET_BREADTH.advancing + MARKET_BREADTH.declining + MARKET_BREADTH.unchanged;

  const movers = [...COMPANIES]
    .filter((c) => METRICS_BY_ID.has(c.stockId))
    .sort(
      (a, b) =>
        Math.abs(METRICS_BY_ID.get(b.stockId)!.changePct) -
        Math.abs(METRICS_BY_ID.get(a.stockId)!.changePct),
    )
    .slice(0, 6);

  return (
    <div className="density-hi px-4 py-6 md:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">市場概況</h1>
          <p className="mt-1 text-sm text-muted">
            2026 年 7 月 17 日 收盤
          </p>
        </div>
      </header>

      {/* ── 指數列 ───────────────────────────────────── */}
      <section aria-labelledby="indices-h" className="mb-10">
        <h2 id="indices-h" className="sr-only">
          大盤指數
        </h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-t border-border pt-4 lg:grid-cols-4">
          {MARKET_INDICES.map((idx) => (
            <div key={idx.code} className="flex flex-col gap-1.5">
              <span className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                {idx.name}
              </span>
              <CountUp
                value={idx.value}
                className="num text-2xl leading-none tracking-tight"
              />
              <div className="flex items-center justify-between gap-2">
                <DeltaValue value={idx.changePct} arrow className="text-xs" />
                <Sparkline data={idx.series} trend={idx.changePct} width={72} height={22} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 主網格：成交/法人/漲跌家數 ────────────────── */}
      <div className="mb-10 grid gap-x-10 gap-y-8 lg:grid-cols-[1.1fr_1fr_0.9fr]">
        {/* 成交金額 */}
        <section aria-labelledby="turnover-h" className="border-t border-border pt-4">
          <h2
            id="turnover-h"
            className="mb-3 text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
          >
            成交金額
          </h2>
          <div className="num text-2xl leading-none tracking-tight">
            {formatTWD(MARKET_TURNOVER.value)}
          </div>
          <div className="mt-2 flex items-baseline gap-3 text-xs">
            <DeltaValue value={MARKET_TURNOVER.changePct} arrow />
            <span className="text-faint">較前一交易日</span>
          </div>
          <dl className="mt-4 divide-y divide-border/60 border-t border-border/60">
            <div className="flex justify-between py-2 text-xs">
              <dt className="text-muted">五日均量</dt>
              <dd className="num">{formatTWD(MARKET_TURNOVER.fiveDayAvg)}</dd>
            </div>
            <div className="flex justify-between py-2 text-xs">
              <dt className="text-muted">量能比</dt>
              <dd className="num">
                {(MARKET_TURNOVER.value / MARKET_TURNOVER.fiveDayAvg).toFixed(2)}x
              </dd>
            </div>
          </dl>
        </section>

        {/* 三大法人 */}
        <section aria-labelledby="inst-h" className="border-t border-border pt-4">
          <h2
            id="inst-h"
            className="mb-3 text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
          >
            三大法人買賣超
          </h2>
          <ul className="divide-y divide-border/60">
            {MARKET_INSTITUTIONAL.map((inst) => {
              const max = Math.max(
                ...MARKET_INSTITUTIONAL.map((i) => Math.abs(i.net)),
              );
              const pct = (Math.abs(inst.net) / max) * 100;
              return (
                <li key={inst.name} className="flex items-center gap-3 py-2.5">
                  <span className="w-11 shrink-0 text-xs text-muted">
                    {inst.name}
                  </span>
                  {/* 中線對齊的雙向長條 */}
                  <div className="relative h-1.5 flex-1">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
                    <div
                      className={cn(
                        "absolute inset-y-0 rounded-sm",
                        inst.net > 0 ? "bg-up" : "bg-down",
                      )}
                      style={
                        inst.net > 0
                          ? { left: "50%", width: `${pct / 2}%` }
                          : { right: "50%", width: `${pct / 2}%` }
                      }
                    />
                  </div>
                  <span
                    className={cn(
                      "num w-20 shrink-0 text-right text-xs",
                      inst.net > 0 ? "text-up" : "text-down",
                    )}
                  >
                    {formatTWD(inst.net)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[0.6875rem] leading-relaxed text-faint">
            投信已連續 {MARKET_INSTITUTIONAL[1].streak} 個交易日買超，
            自營商連續 {Math.abs(MARKET_INSTITUTIONAL[2].streak)} 日賣超。
          </p>
        </section>

        {/* 漲跌家數 */}
        <section aria-labelledby="breadth-h" className="border-t border-border pt-4">
          <h2
            id="breadth-h"
            className="mb-3 text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
          >
            漲跌家數
          </h2>
          {/* 堆疊條：紅漲綠跌 */}
          <div className="flex h-2 w-full overflow-hidden rounded-sm">
            <div
              className="bg-up"
              style={{ width: `${(MARKET_BREADTH.advancing / breadthTotal) * 100}%` }}
            />
            <div
              className="bg-flat"
              style={{ width: `${(MARKET_BREADTH.unchanged / breadthTotal) * 100}%` }}
            />
            <div
              className="bg-down"
              style={{ width: `${(MARKET_BREADTH.declining / breadthTotal) * 100}%` }}
            />
          </div>
          <dl className="mt-4 divide-y divide-border/60">
            <div className="flex justify-between py-2 text-xs">
              <dt className="text-muted">上漲</dt>
              <dd className="num text-up">
                {formatInt(MARKET_BREADTH.advancing)}
              </dd>
            </div>
            <div className="flex justify-between py-2 text-xs">
              <dt className="text-muted">下跌</dt>
              <dd className="num text-down">
                {formatInt(MARKET_BREADTH.declining)}
              </dd>
            </div>
            <div className="flex justify-between py-2 text-xs">
              <dt className="text-muted">平盤</dt>
              <dd className="num text-flat">
                {formatInt(MARKET_BREADTH.unchanged)}
              </dd>
            </div>
            <div className="flex justify-between py-2 text-xs">
              <dt className="text-muted">漲停 / 跌停</dt>
              <dd className="num">
                <span className="text-up">{MARKET_BREADTH.limitUp}</span>
                <span className="mx-1 text-faint">/</span>
                <span className="text-down">{MARKET_BREADTH.limitDown}</span>
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* ── 波動較大個股 ─────────────────────────────── */}
      <section aria-labelledby="movers-h" className="mb-10">
        <h2
          id="movers-h"
          className="mb-3 border-t border-border pt-4 text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
        >
          追蹤範圍內波動較大
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-xs">
            <thead>
              <tr className="th-sticky border-b border-border text-left text-faint">
                <th scope="col" className="py-2 pr-3 font-medium">代號</th>
                <th scope="col" className="py-2 pr-3 font-medium">名稱</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">收盤</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">漲跌幅</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">本益比</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">殖利率</th>
                <th scope="col" className="py-2 pl-3 text-right font-medium">近 60 日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {movers.map((c) => {
                const m = METRICS_BY_ID.get(c.stockId)!;
                return (
                  <tr key={c.stockId} className="h-8 transition-colors hover:bg-surface">
                    <td className="num py-1 pr-3">
                      <Link
                        href={`/stock/${c.stockId}`}
                        className="text-accent hover:underline"
                      >
                        {c.stockId}
                      </Link>
                    </td>
                    <td className="py-1 pr-3 text-text">{c.companyName}</td>
                    <td className="num py-1 pr-3 text-right">{formatPrice(m.price)}</td>
                    <td className="py-1 pr-3 text-right">
                      <DeltaValue value={m.changePct} arrow />
                    </td>
                    <td className="num py-1 pr-3 text-right text-muted">
                      {formatPrice(m.pe, 1)}x
                    </td>
                    <td className="num py-1 pr-3 text-right text-muted">
                      {formatPct(m.dividendYield, 2, false)}
                    </td>
                    <td className="py-1 pl-3">
                      <div className="flex justify-end">
                        <Sparkline
                          data={getCloseSeries(c.stockId, 60)}
                          trend={m.changePct}
                          width={68}
                          height={18}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 基本面評分排序 ───────────────────────────── */}
      <section aria-labelledby="scores-h">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-4">
          <h2
            id="scores-h"
            className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
          >
            基本面加權排序
          </h2>
          <Link
            href="/screener"
            className="text-xs text-accent hover:underline"
          >
            調整權重與條件
          </Link>
        </div>

        <ol className="divide-y divide-border/60">
          {RANKED_SCORES.slice(0, 8).map((s, i) => {
            const c = COMPANIES.find((x) => x.stockId === s.stockId)!;
            return (
              <li key={s.stockId}>
                <Link
                  href={`/stock/${s.stockId}`}
                  className="flex h-8 items-center gap-3 text-xs transition-colors hover:bg-surface"
                >
                  <span className="num w-5 shrink-0 text-right text-faint">
                    {i + 1}
                  </span>
                  <span className="num w-11 shrink-0 text-accent">
                    {s.stockId}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-text">
                    {c.companyName}
                  </span>
                  <span className="hidden shrink-0 text-faint sm:inline">
                    {c.industry}
                  </span>
                  <div className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-raised sm:w-24">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${s.total}%` }}
                    />
                  </div>
                  <span className="num w-7 shrink-0 text-right">{s.total}</span>
                </Link>
              </li>
            );
          })}
        </ol>

        <Disclaimer variant="inline" className="mt-4" />
      </section>
    </div>
  );
}
