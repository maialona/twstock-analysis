import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CandleChart } from "@/components/charts/CandleChart";
import {
  EpsChart,
  MarginTrendChart,
  MonthlyRevenueChart,
} from "@/components/charts/FinancialChart";
import { ScoreBar, ScoreRadar } from "@/components/charts/ScoreRadar";
import { DeltaValue } from "@/components/data/DeltaValue";
import { MetricGroup, MetricRow } from "@/components/data/MetricRow";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { EmptyState } from "@/components/ui/states";
import { WatchToggle } from "@/components/watchlist/WatchToggle";
import { COMPANIES, getCompany, getMetrics } from "@/lib/data/companies";
import { getPrices } from "@/lib/data/prices";
import {
  getDerivedSeries,
  getDividends,
  getMonthlyRevenue,
} from "@/lib/data/financials";
import { getScore } from "@/lib/data/scoring";
import { getAnalysis, hasFullAnalysis } from "@/lib/data/analysis";
import { SCORE_LABELS, SCORE_WEIGHTS, type ScoreBreakdown } from "@/lib/schema";
import { formatMultiple, formatPct, formatPrice, formatTWD } from "@/lib/format";

export function generateStaticParams() {
  return COMPANIES.map((c) => ({ id: c.stockId }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = getCompany(id);
  return { title: c ? `${c.stockId} ${c.companyName}` : "找不到個股" };
}

export default async function StockPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = getCompany(id);
  const metrics = getMetrics(id);
  if (!company || !metrics) notFound();

  const prices = getPrices(id);
  const derived = getDerivedSeries(id);
  const monthly = getMonthlyRevenue(id);
  const dividends = getDividends(id);
  const score = getScore(id);
  const analysis = getAnalysis(id);
  const isEtf = company.market === "ETF";

  const latestMonth = monthly[monthly.length - 1];

  return (
    <div className="density-md px-4 py-6 md:px-8">
      {/* ── 標題列 ───────────────────────────────────── */}
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="num text-sm text-accent">
                {company.stockId}
              </span>
              <span className="rounded border border-border px-1.5 py-0.5 text-[0.625rem] text-faint">
                {company.market}
              </span>
              <span className="text-xs text-faint">{company.industry}</span>
            </div>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">
              {company.companyName}
            </h1>
          </div>

          <div className="flex items-center gap-5">
            <div className="flex items-baseline gap-4">
              <span className="num text-4xl leading-none tracking-tighter">
                {formatPrice(metrics.price)}
              </span>
              <DeltaValue value={metrics.changePct} arrow className="text-lg" />
            </div>
            <WatchToggle
              stockId={company.stockId}
              companyName={company.companyName}
            />
          </div>
        </div>
      </header>

      {/* ── K 線 ─────────────────────────────────────── */}
      <section aria-labelledby="chart-h" className="mb-10">
        <h2 id="chart-h" className="sr-only">
          股價走勢
        </h2>
        <CandleChart data={prices} height={360} />
      </section>

      {/* ── 主要內容：指標 + 評分 ────────────────────── */}
      <div className="mb-10 grid gap-x-10 gap-y-8 lg:grid-cols-[1.4fr_1fr]">
        {/* 財務指標 */}
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <MetricGroup title="估值">
            <MetricRow
              label="本益比"
              value={formatMultiple(metrics.pe, 2)}
              hint={`同業 ${formatMultiple(metrics.industryPe, 1)}`}
            />
            <MetricRow label="股價淨值比" value={formatMultiple(metrics.pb, 2)} />
            <MetricRow
              label="殖利率"
              value={formatPct(metrics.dividendYield, 2, false)}
            />
            <MetricRow label="市值" value={formatTWD(metrics.marketCap)} />
          </MetricGroup>

          {!isEtf && (
            <>
              <MetricGroup title="獲利能力">
                <MetricRow label="ROE" value={formatPct(metrics.roe, 1, false)} />
                <MetricRow label="ROA" value={formatPct(metrics.roa, 1, false)} />
                <MetricRow
                  label="EPS（近四季）"
                  value={`${formatPrice(metrics.eps, 2)} 元`}
                />
                <MetricRow
                  label="EPS 五年 CAGR"
                  value={<DeltaValue value={metrics.epsCagr5y} digits={1} />}
                />
              </MetricGroup>

              <MetricGroup title="利潤結構">
                <MetricRow
                  label="毛利率"
                  value={formatPct(metrics.grossMargin, 1, false)}
                />
                <MetricRow
                  label="營益率"
                  value={formatPct(metrics.operatingMargin, 1, false)}
                />
                <MetricRow
                  label="淨利率"
                  value={formatPct(metrics.netMargin, 1, false)}
                />
                <MetricRow
                  label="營收年增率"
                  value={<DeltaValue value={metrics.revenueYoy} digits={1} />}
                />
              </MetricGroup>

              <MetricGroup title="財務結構">
                <MetricRow
                  label="負債比"
                  value={formatPct(metrics.debtRatio, 1, false)}
                />
                <MetricRow label="自由現金流" value={formatTWD(metrics.fcf)} />
                <MetricRow
                  label="上市日期"
                  value={<span className="text-muted">{company.listingDate}</span>}
                />
              </MetricGroup>
            </>
          )}
        </div>

        {/* 評分 */}
        <aside className="flex flex-col gap-6">
          {score ? (
            <section className="border-t border-border pt-4">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                  加權指標分數
                </h2>
                <div className="flex items-baseline gap-1">
                  <span className="num text-3xl leading-none tracking-tighter">
                    {score.total}
                  </span>
                  <span className="text-xs text-faint">/ 100</span>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                {(Object.keys(SCORE_WEIGHTS) as Array<keyof ScoreBreakdown>).map((k) => (
                  <ScoreBar
                    key={k}
                    label={SCORE_LABELS[k]}
                    value={score.breakdown[k]}
                    weight={SCORE_WEIGHTS[k]}
                  />
                ))}
              </div>
              <p className="mt-3 text-[0.6875rem] leading-relaxed text-faint">
                分數為各指標正規化後依權重加總，反映在所選指標上的相對位置，
                非投資建議。權重可於篩選頁調整。
              </p>
            </section>
          ) : (
            <EmptyState
              title="此標的不適用基本面評分"
              description="ETF 沒有單一公司財報，因此不計算 ROE、毛利率等企業層級指標。可改看成分股的個別評分。"
            />
          )}

          {/* 指標分佈由企業層級財務指標推導；ETF 沒有這些指標，不畫（否則會是一面假的平均值雷達）*/}
          {!isEtf && (
            <section className="border-t border-border pt-4">
              <h2 className="mb-3 text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                指標分佈
              </h2>
              <ScoreRadar dimensions={analysis.dimensions} size={210} />
            </section>
          )}
        </aside>
      </div>

      {/* ── 財報圖表 ─────────────────────────────────── */}
      {/*
        三塊的資料可得性不同，分別開關，不共用一個閘：
        - 利潤率／EPS 趨勢：需要損益表結構，金融股（利息收入型）沒有，derived 為空
        - 月營收：一般業與金融股都有公告，ETF 沒有
        所以金融股會顯示月營收、但不顯示利潤率趨勢，這是正確的，
        不能因為沒有利潤率就把它整段當成「ETF 無財報」。
      */}
      {isEtf ? (
        <EmptyState
          className="mb-10"
          title="無企業財報資料"
          description="此標的為 ETF，不適用損益表與月營收公告。若要分析成分股的基本面，請直接搜尋個股代號。"
        />
      ) : (
        <div className="mb-10 grid gap-x-10 gap-y-8 lg:grid-cols-2">
          {derived.length > 0 && (
            <>
              <section aria-labelledby="margin-h" className="border-t border-border pt-4">
                <h2
                  id="margin-h"
                  className="mb-3 text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
                >
                  利潤率與 ROE 趨勢
                </h2>
                <MarginTrendChart data={derived} />
              </section>

              <section aria-labelledby="eps-h" className="border-t border-border pt-4">
                <h2
                  id="eps-h"
                  className="mb-3 text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
                >
                  季度 EPS
                </h2>
                <EpsChart data={derived} />
              </section>
            </>
          )}

          {monthly.length > 0 && (
            <section
              aria-labelledby="rev-h"
              className="border-t border-border pt-4 lg:col-span-2"
            >
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2
                  id="rev-h"
                  className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
                >
                  月營收（億元，柱體顏色依年增率）
                </h2>
                {latestMonth && (
                  <p className="text-xs text-muted">
                    最新 {latestMonth.month}：
                    <span className="num ml-1">{formatTWD(latestMonth.revenue)}</span>
                    <span className="mx-2 text-faint">年增</span>
                    <DeltaValue value={latestMonth.yoy} digits={1} />
                    <span className="mx-2 text-faint">月增</span>
                    <DeltaValue value={latestMonth.mom} digits={1} />
                  </p>
                )}
              </div>
              <MonthlyRevenueChart data={monthly} />
            </section>
          )}
        </div>
      )}

      {/* ── 股利（ETF 無公司股利，整段不顯示）─────────── */}
      {dividends.length > 0 && (
      <section aria-labelledby="div-h" className="mb-10 border-t border-border pt-4">
        <h2
          id="div-h"
          className="mb-3 text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
        >
          歷年股利
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-xs">
            <thead>
              <tr className="border-b border-border text-left text-faint">
                <th scope="col" className="py-2 pr-4 font-medium">年度</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">現金股利</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">股票股利</th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">配息率</th>
                <th scope="col" className="py-2 text-right font-medium">殖利率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {dividends.map((d) => (
                <tr key={d.year} className="h-9 transition-colors hover:bg-surface">
                  <td className="num py-1 pr-4">{d.year}</td>
                  <td className="num py-1 pr-4 text-right">{formatPrice(d.cashDividend)}</td>
                  <td className="num py-1 pr-4 text-right text-muted">
                    {d.stockDividend > 0 ? formatPrice(d.stockDividend) : "—"}
                  </td>
                  <td className="num py-1 pr-4 text-right text-muted">
                    {d.payoutRatio > 0 ? formatPct(d.payoutRatio, 1, false) : "—"}
                  </td>
                  <td className="num py-1 text-right">{formatPct(d.yieldPct, 2, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {/* ── 財報摘要 ─────────────────────────────────── */}
      <section aria-labelledby="ai-h" className="border-t border-border pt-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="ai-h"
            className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint"
          >
            財報與法說會摘要
          </h2>
          <span className="num text-[0.6875rem] text-faint">
            更新於 {analysis.updatedAt.slice(0, 16).replace("T", " ")}
          </span>
        </div>

        {hasFullAnalysis(id) ? (
          <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[1.3fr_1fr]">
            <div className="flex flex-col gap-5">
              <ul className="flex flex-col gap-2.5">
                {analysis.summary.map((line, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed">
                    <span className="num shrink-0 pt-0.5 text-[0.6875rem] text-faint">
                      0{i + 1}
                    </span>
                    <span className="max-w-[62ch] text-text">{line}</span>
                  </li>
                ))}
              </ul>

              <div>
                <h3 className="mb-2 text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                  公司揭露方向
                </h3>
                <p className="max-w-[62ch] text-sm leading-relaxed text-muted">
                  {analysis.outlook}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <h3 className="mb-2 text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                  風險因子
                </h3>
                <ul className="flex flex-col gap-2">
                  {analysis.risks.map((r, i) => (
                    <li
                      key={i}
                      className="border-l-2 border-up/50 pl-3 text-sm leading-relaxed text-muted"
                    >
                      {r}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                  觀察重點
                </h3>
                <ul className="flex flex-col gap-2">
                  {analysis.catalysts.map((c, i) => (
                    <li
                      key={i}
                      className="border-l-2 border-accent/50 pl-3 text-sm leading-relaxed text-muted"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="尚未產生此檔的財報摘要"
            description="摘要由財報、法說會逐字稿與新聞彙整而成，目前僅涵蓋部分個股。上方的財務指標與月營收趨勢均為實際計算結果，可直接參考。"
            action={
              <Link
                href="/dashboard"
                className="text-xs text-accent hover:underline"
              >
                回市場概況
              </Link>
            }
          />
        )}

        <Disclaimer className="mt-6" />
      </section>
    </div>
  );
}
