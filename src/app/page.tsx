import Link from "next/link";
import { ArrowRight, ChartLineUp } from "@phosphor-icons/react/dist/ssr";
import { DeltaValue } from "@/components/data/DeltaValue";
import { Sparkline } from "@/components/data/Sparkline";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { COMPANY_BY_ID, METRICS_BY_ID } from "@/lib/data/companies";
import { MARKET_INDICES, getCloseSeries } from "@/lib/data/prices";
import { RANKED_SCORES } from "@/lib/data/scoring";
import { formatPrice } from "@/lib/format";

/**
 * 落地頁 — density 3、variance 8。
 * 不對稱分割版面，文案靠左，右側為真實的篩選結果預覽。
 * 刻意不使用置中 hero。
 */

const PIPELINE = [
  {
    step: "01",
    title: "抓取公開資料",
    body: "每日收盤後從證交所與公開資訊觀測站取得股價、月營收、法人買賣超；財報則於每季公告後匯入。",
  },
  {
    step: "02",
    title: "計算基本面指標",
    body: "ROE、ROA、毛利率、負債比、自由現金流、EPS 五年 CAGR — 全部由原始財報欄位推導，不依賴第三方已計算的數值。",
  },
  {
    step: "03",
    title: "依自訂條件篩選",
    body: "門檻可以是絕對數值，也可以是「高於去年」或「低於同業平均」— 讓標準隨個股歷史與產業結構浮動。",
  },
  {
    step: "04",
    title: "追蹤基本面變化",
    body: "持股的月營收年增轉負、負債比走高、毛利率連兩季下滑時，在追蹤清單優先標示。",
  },
];

const BOUNDARIES = [
  "不預測股價，也不產生目標價。",
  "不提供買賣建議。指標與分數是排序工具，權重由你設定，換一組權重就換一個排序。",
  "不做技術分析選股。K 線在個股頁面只作為價格脈絡，不參與篩選條件。",
  "不宣稱資料即時。所有數字都是收盤後更新，財報則等公告。",
];

export default function LandingPage() {
  const preview = RANKED_SCORES.slice(0, 5);
  const taiex = MARKET_INDICES[0];

  return (
    <div className="density-lo min-h-[100dvh]">
      {/* ── 頂欄 ─────────────────────────────────────── */}
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 md:px-8">
        <div className="flex items-center gap-2">
          <ChartLineUp size={20} weight="bold" className="text-accent" />
          <span className="text-sm font-semibold tracking-tight">測度</span>
        </div>
        <Link
          href="/dashboard"
          className="group flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-text"
        >
          進入工具
          <ArrowRight
            size={14}
            weight="bold"
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          />
        </Link>
      </header>

      {/* ── Hero：不對稱分割（左文案 / 右資料）─────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-12 md:px-8 md:pb-32 md:pt-20">
        <div className="grid items-start gap-x-16 gap-y-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* 左：文案 */}
          <div className="max-w-[36rem]">
            <p className="mb-5 text-xs uppercase tracking-[0.18em] text-faint">
              台股基本面研究工具
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tighter md:text-5xl">
              把財報讀成
              <br />
              可以比較的數字
            </h1>
            <p className="mt-6 max-w-[52ch] text-base leading-relaxed text-muted">
              證交所與公開資訊觀測站每天釋出的資料是分散的 PDF 與表格。
              這個工具把它們整理成同一組欄位，算出指標，
              然後讓你用自己的標準去篩。
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/screener"
                className="group flex items-center gap-2 rounded bg-text px-4 py-2.5 text-sm font-medium text-bg transition-all duration-200 hover:bg-white active:translate-y-[1px]"
              >
                開始篩選
                <ArrowRight
                  size={14}
                  weight="bold"
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                />
              </Link>
              <Link
                href="/dashboard"
                className="rounded border border-border px-4 py-2.5 text-sm text-muted transition-all duration-200 hover:border-border-strong hover:text-text active:translate-y-[1px]"
              >
                看今日市場
              </Link>
            </div>

            {/* 涵蓋範圍 — 具體數字，不誇大 */}
            <dl className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-border pt-6">
              {[
                { k: "追蹤標的", v: "12" },
                { k: "歷史季報", v: "14 季" },
                { k: "計算指標", v: "14 項" },
              ].map((s) => (
                <div key={s.k} className="flex flex-col gap-1.5">
                  <dt className="text-xs text-faint">{s.k}</dt>
                  <dd className="num text-xl tracking-tight">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* 右：真實資料預覽，不是裝飾用假圖 */}
          <div className="lg:pt-4">
            <div className="rounded-lg border border-border bg-surface p-5 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]">
              {/* 大盤 */}
              <div className="flex items-end justify-between border-b border-border pb-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                    {taiex.name}
                  </span>
                  <span className="num text-2xl leading-none tracking-tight">
                    {formatPrice(taiex.value)}
                  </span>
                  <DeltaValue value={taiex.changePct} arrow className="text-xs" />
                </div>
                <Sparkline
                  data={taiex.series}
                  trend={taiex.changePct}
                  width={120}
                  height={40}
                />
              </div>

              {/* 篩選結果預覽 */}
              <div className="pt-4">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
                    加權指標排序
                  </span>
                  <span className="num text-[0.6875rem] text-faint">
                    ROE &gt; 15% · 負債比 &lt; 50%
                  </span>
                </div>
                <ul className="divide-y divide-border/60">
                  {preview.map((s) => {
                    const c = COMPANY_BY_ID.get(s.stockId)!;
                    const m = METRICS_BY_ID.get(s.stockId)!;
                    return (
                      <li key={s.stockId} className="flex h-9 items-center gap-3 text-xs">
                        <span className="num w-11 shrink-0 text-accent">
                          {s.stockId}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-text">
                          {c.companyName}
                        </span>
                        <Sparkline
                          data={getCloseSeries(s.stockId, 40)}
                          trend={m.changePct}
                          width={48}
                          height={16}
                          className="hidden shrink-0 sm:block"
                        />
                        <div className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-raised">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${s.total}%` }}
                          />
                        </div>
                        <span className="num w-6 shrink-0 text-right">{s.total}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            <p className="mt-3 text-xs text-faint">
              以上為實際計算結果，資料截至 2026 年 7 月 17 日收盤。
            </p>
          </div>
        </div>
      </section>

      {/* ── 流程：2 欄交錯，非 3 卡片列 ───────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-24 md:px-8 md:py-32">
          <h2 className="max-w-[24ch] text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
            資料從公開來源進來，指標在本地算完
          </h2>

          <div className="mt-16 grid gap-x-16 gap-y-14 md:grid-cols-2">
            {PIPELINE.map((p, i) => (
              <div key={p.step} className={i % 2 === 1 ? "md:pt-16" : undefined}>
                <div className="flex items-baseline gap-4 border-t border-border pt-5">
                  <span className="num text-xs text-faint">{p.step}</span>
                  <div>
                    <h3 className="text-base font-medium tracking-tight">{p.title}</h3>
                    <p className="mt-2.5 max-w-[46ch] text-sm leading-relaxed text-muted">
                      {p.body}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 邊界說明：誠實講清楚不做什麼 ───────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-24 md:px-8">
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[0.85fr_1.15fr]">
            <h2 className="text-2xl font-semibold leading-tight tracking-tight">
              這個工具不做什麼
            </h2>
            <div className="flex flex-col gap-5">
              {BOUNDARIES.map((line, i) => (
                <p
                  key={i}
                  className="border-l-2 border-border-strong pl-4 text-base leading-relaxed text-muted"
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 頁尾 ─────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-12 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ChartLineUp size={16} weight="bold" className="text-accent" />
              <span className="text-sm font-medium tracking-tight">測度</span>
            </div>
            <Link
              href="/dashboard"
              className="text-sm text-muted transition-colors hover:text-text"
            >
              進入工具
            </Link>
          </div>
          <Disclaimer variant="footer" />
        </div>
      </footer>
    </div>
  );
}
