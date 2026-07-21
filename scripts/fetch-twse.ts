/**
 * TWSE 資料收集器。
 *
 *   node scripts/fetch-twse.ts
 *
 * 把公開資料抓下來、正規化，寫進 data/*.json。前端只讀那些檔案，
 * 建置與執行期都不會對外連線 —— TWSE 會擋連續請求，不適合放在
 * request path 上，而且行情資料每天只更新一次。
 *
 * 這是 PRD 裡 Data Collector 的前身，差別只在落地成 JSON 而不是 PostgreSQL。
 *
 * ── 已知的資料缺口（不是 bug，是來源就沒有）──────────────
 *  fcf         TWSE 公開資料沒有現金流量表，自由現金流無從計算
 *  epsCagr5y   openapi 只給最新一季，沒有五年歷史可回歸
 *  金融股      金控／銀行損益表沒有「營業收入」，毛利率等比率不成立
 *  虧損股      沒有本益比（例：1301 台塑）
 *  ETF         沒有財報、月營收、本益比
 * 缺的一律寫 null，不要用 0 或估計值填補。
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sleep } from "./twse/client.ts";
import {
  fetchFlowsForDate,
  fetchInstitutionalMoney,
  fetchMarketMonth,
  fetchMonthPrices,
  fetchRevenueMonth,
  recentMonths,
  type FlowRow,
  type InstitutionalMoney,
  type MarketDay,
  type PriceRow,
  type RevenueRow,
} from "./twse/history.ts";
import {
  buildCompany,
  fetchSnapshot,
  sharesOutstanding,
  type Snapshot,
} from "./twse/snapshot.ts";
import {
  ETF_TICKERS,
  FOCUS_TICKERS,
  INSTITUTIONAL_DAYS,
  PRICE_HISTORY_MONTHS,
} from "./twse/universe.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "data");

const log = (msg: string) => console.log(msg);

/* ── 指標 ─────────────────────────────────────────────── */

type MetricsOut = {
  stockId: string;
  price: number;
  changePct: number;
  eps: number | null;
  epsCagr5y: number | null;
  roe: number | null;
  roa: number | null;
  pe: number | null;
  pb: number | null;
  dividendYield: number | null;
  debtRatio: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  fcf: number | null;
  revenueYoy: number | null;
  industryPe: number | null;
  marketCap: number | null;
};

const r1 = (n: number | null): number | null =>
  n === null ? null : Math.round(n * 10) / 10;
const r2 = (n: number | null): number | null =>
  n === null ? null : Math.round(n * 100) / 100;

function buildMetrics(
  stockId: string,
  snap: Snapshot,
  latestYoy: number | null,
): MetricsOut {
  const quote = snap.quotes.get(stockId)!;
  const val = snap.valuation.get(stockId);
  const fin = snap.financials.get(stockId);
  const info = snap.info.get(stockId);
  const industry = snap.industryOf.get(stockId);

  const pe = val?.pe ?? null;

  // TWSE 的本益比定義就是「股價 ÷ 近四季每股盈餘」，
  // 所以反推回去得到的 EPS 與官方口徑一致，不需要自己加總四季。
  // 虧損公司沒有本益比，EPS 也就無從反推 —— 留 null。
  const eps = pe !== null && pe > 0 ? quote.close / pe : null;

  // 單季淨利年化。真正的 ROE 應該用近四季，但 openapi 只給最新一季；
  // 年化是可辨識的近似，好過拿一季的數字假裝是全年。
  const annualNet = fin?.netIncome !== null && fin?.netIncome !== undefined
    ? fin.netIncome * 4
    : null;
  const roe =
    annualNet !== null && fin?.equity ? (annualNet / fin.equity) * 100 : null;
  const roa =
    annualNet !== null && fin?.asset ? (annualNet / fin.asset) * 100 : null;
  const debtRatio =
    fin?.liability !== null && fin?.liability !== undefined && fin?.asset
      ? (fin.liability / fin.asset) * 100
      : null;

  return {
    stockId,
    price: quote.close,
    changePct: r2(quote.changePct)!,
    eps: r2(eps),
    // 需要五年歷史財報，openapi 只給最新一季
    epsCagr5y: null,
    roe: r1(roe),
    roa: r1(roa),
    pe,
    pb: val?.pb ?? null,
    dividendYield: val?.dividendYield ?? null,
    debtRatio: r1(debtRatio),
    grossMargin: r1(fin?.grossMargin ?? null),
    operatingMargin: r1(fin?.operatingMargin ?? null),
    netMargin: r1(fin?.netMargin ?? null),
    // TWSE 公開資料沒有現金流量表
    fcf: null,
    revenueYoy: r1(latestYoy),
    industryPe: industry ? snap.industryPe.get(industry) ?? null : null,
    marketCap: info ? Math.round(quote.close * sharesOutstanding(info)) : null,
  };
}

/* ── 主流程 ───────────────────────────────────────────── */

async function main(): Promise<void> {
  const started = Date.now();
  await mkdir(DATA_DIR, { recursive: true });

  log("① 全市場快照…");
  const snap = await fetchSnapshot();
  log(
    `   交易日 ${snap.tradeDate}｜行情 ${snap.quotes.size} 檔` +
      `｜財報 ${snap.financials.size} 檔｜產業 ${snap.industryPe.size} 類`,
  );

  const focus = new Set(FOCUS_TICKERS);
  const months = recentMonths(PRICE_HISTORY_MONTHS, new Date(snap.tradeDate));

  log(`② 月營收（${months.length} 個月，全市場檔）…`);
  const revenueByStock = new Map<string, RevenueRow[]>();
  for (const ym of months) {
    const all = await fetchRevenueMonth(ym);
    for (const row of all) {
      if (!focus.has(row.stockId)) continue;
      const list = revenueByStock.get(row.stockId);
      if (list) list.push(row);
      else revenueByStock.set(row.stockId, [row]);
    }
    process.stdout.write(`   ${ym.year}-${ym.month} ${all.length ? "✓" : "—"}\n`);
    await sleep(300);
  }

  log(`③ 大盤成交與加權指數（${months.length} 個月）…`);
  const marketDays: MarketDay[] = [];
  for (const ym of months) {
    marketDays.push(...(await fetchMarketMonth(ym)));
  }
  marketDays.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = marketDays.length - truncate(marketDays, snap.tradeDate).length;
  marketDays.length = marketDays.length - trimmed;
  log(`   ${marketDays.length} 個交易日${trimmed ? `（捨棄快照日之後的 ${trimmed} 日）` : ""}`);

  log(`④ K 線（${FOCUS_TICKERS.length} 檔 × ${months.length} 月）…`);
  const pricesByStock = new Map<string, PriceRow[]>();
  for (const stockId of FOCUS_TICKERS) {
    const rows: PriceRow[] = [];
    for (const ym of months) {
      rows.push(...(await fetchMonthPrices(stockId, ym)));
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    pricesByStock.set(stockId, truncate(rows, snap.tradeDate));
    log(`   ${stockId} ${pricesByStock.get(stockId)!.length} 筆`);
  }

  // 交易日曆直接沿用 FMTQIK 的日期，不要自己推算（會踩到颱風假與補班日）
  const tradingDays = marketDays
    .map((d) => d.date)
    .slice(-INSTITUTIONAL_DAYS);

  log(`⑤ 三大法人 —— 逐檔（${tradingDays.length} 日）…`);
  const flows: FlowRow[] = [];
  for (const date of tradingDays) {
    flows.push(...(await fetchFlowsForDate(date, focus)));
  }
  log(`   ${flows.length} 筆`);

  log(`⑥ 三大法人 —— 大盤買賣超金額（${tradingDays.length} 日）…`);
  const marketFlows: InstitutionalMoney[] = [];
  for (const date of tradingDays) {
    const row = await fetchInstitutionalMoney(date);
    if (row) marketFlows.push(row);
  }
  log(`   ${marketFlows.length} 日`);

  log("⑦ 組裝…");
  const companies = FOCUS_TICKERS.map((id, i) => buildCompany(id, i, snap));
  const metrics = FOCUS_TICKERS.map((id) => {
    const rev = revenueByStock.get(id);
    const latestYoy = rev?.length ? rev[rev.length - 1].yoy : null;
    return buildMetrics(id, snap, latestYoy);
  });

  const financials = Object.fromEntries(
    FOCUS_TICKERS.filter((id) => snap.financials.has(id)).map((id) => [
      id,
      snap.financials.get(id)!,
    ]),
  );

  const latest = marketDays[marketDays.length - 1];
  const prevDay = marketDays[marketDays.length - 2];
  const prevTurnover = marketDays.slice(-6, -1);
  const taiexSeries = marketDays.slice(-60).map((d) => d.taiex);

  // 指數序列只有加權指數（TAIEX）拿得到真實日資料，其餘只有當日快照。
  // Sparkline 對空序列會渲染空白，不會硬湊一條假的走勢。
  const indices = snap.indices.map((idx) => ({
    name: idx.name,
    code: idx.code,
    value: idx.value,
    changePct: idx.changePct,
    series: idx.code === "TAIEX" ? taiexSeries : [],
  }));

  const market = {
    tradeDate: snap.tradeDate,
    indices,
    turnover: {
      value: latest.turnover,
      // 成交金額的日變化，用真實前一交易日算，不再寫死
      changePct: r1(((latest.turnover - prevDay.turnover) / prevDay.turnover) * 100),
      fiveDayAvg: Math.round(
        prevTurnover.reduce((s, d) => s + d.turnover, 0) / prevTurnover.length,
      ),
    },
    breadth: snap.marketBreadth,
    institutional: buildInstitutional(marketFlows),
  };

  assertPriceConsistency(metrics, pricesByStock, snap.tradeDate);

  await write("meta.json", {
    fetchedAt: new Date().toISOString(),
    tradeDate: snap.tradeDate,
    focusTickers: FOCUS_TICKERS,
    source: "臺灣證券交易所公開資料（openapi.twse.com.tw、www.twse.com.tw、mopsov.twse.com.tw）",
  });
  await write("companies.json", companies);
  await write("metrics.json", metrics);
  await write("market.json", market);
  await write("financials.json", financials);
  await write("prices.json", Object.fromEntries(pricesByStock));
  await write("monthly-revenue.json", Object.fromEntries(revenueByStock));
  await write("institutional.json", groupBy(flows, (f) => f.stockId));

  const secs = ((Date.now() - started) / 1000).toFixed(0);
  log(`\n完成，耗時 ${secs} 秒。資料日期 ${snap.tradeDate}`);
  reportGaps(metrics);
}

/**
 * 各來源的更新時間不一致。收盤後 www.twse.com.tw 的逐日檔（K 線、FMTQIK）
 * 會先有當天資料，openapi 的全市場快照要晚一段時間才跟上 ——
 * 抓取當下實測就差了一個交易日。
 *
 * 快照日必須是唯一的基準日：本益比、股價淨值比、漲跌家數只有快照有，
 * 沒辦法為更新的那一天補上。因此把所有序列砍到快照日為止，
 * 寧可少一天，也不要表頭寫 2290、K 線最後一根卻收 2320。
 */
function truncate<T extends { date: string }>(rows: T[], tradeDate: string): T[] {
  return rows.filter((r) => r.date <= tradeDate);
}

/**
 * 表頭（metrics）與 K 線最後一根必須是同一天的同一個價格。
 * 這兩者來自不同端點，沒有任何機制保證它們一致 —— 一旦脫鉤，
 * 畫面上每個數字單看都合理，只有湊在一起才是錯的，肉眼很難發現。
 * 所以在寫檔前擋下來，讓收集程序失敗，而不是產生一份錯的快照。
 */
function assertPriceConsistency(
  metrics: MetricsOut[],
  prices: Map<string, PriceRow[]>,
  tradeDate: string,
): void {
  const problems: string[] = [];

  for (const m of metrics) {
    const series = prices.get(m.stockId);
    if (!series?.length) {
      problems.push(`${m.stockId} 沒有價格序列`);
      continue;
    }
    const last = series[series.length - 1];
    if (last.date !== tradeDate) {
      problems.push(`${m.stockId} K 線最後一根是 ${last.date}，基準日是 ${tradeDate}`);
    }
    if (last.close !== m.price) {
      problems.push(`${m.stockId} 表頭 ${m.price}，K 線最後一根 ${last.close}`);
    }
  }

  if (problems.length) {
    throw new Error(`資料不一致，已中止寫檔：\n  ${problems.join("\n  ")}`);
  }
}

/**
 * 大盤三大法人：最新一日的買賣超金額，加上「連續買／賣超天數」。
 * streak 從最新往回數同號的天數，正為連續買超、負為連續賣超。
 * marketFlows 由舊到新排列。
 */
function buildInstitutional(
  marketFlows: InstitutionalMoney[],
): Array<{ name: string; net: number; streak: number }> {
  const cols: Array<{ name: string; pick: (m: InstitutionalMoney) => number }> = [
    { name: "外資", pick: (m) => m.foreign },
    { name: "投信", pick: (m) => m.trust },
    { name: "自營商", pick: (m) => m.dealer },
  ];

  return cols.map(({ name, pick }) => {
    const latest = pick(marketFlows[marketFlows.length - 1]);
    const dir = Math.sign(latest);
    let streak = 0;
    for (let i = marketFlows.length - 1; i >= 0; i--) {
      if (Math.sign(pick(marketFlows[i])) !== dir || dir === 0) break;
      streak++;
    }
    return { name, net: Math.round(latest), streak: dir * streak };
  });
}

function groupBy<T>(rows: T[], key: (r: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const row of rows) (out[key(row)] ??= []).push(row);
  return out;
}

async function write(name: string, value: unknown): Promise<void> {
  await writeFile(join(DATA_DIR, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

/**
 * 把缺漏印出來。收集器不該在資料有洞時假裝成功 ——
 * 這份清單就是 README 裡「哪些欄位不是真的」的依據。
 */
function reportGaps(metrics: MetricsOut[]): void {
  const fields = Object.keys(metrics[0]).filter(
    (k) => k !== "stockId" && k !== "price" && k !== "changePct",
  ) as Array<keyof MetricsOut>;

  const missing = fields
    .map((f) => ({ f, ids: metrics.filter((m) => m[f] === null).map((m) => m.stockId) }))
    .filter((x) => x.ids.length > 0);

  if (missing.length === 0) {
    log("所有指標皆有值。");
    return;
  }
  log("\n缺漏欄位：");
  for (const { f, ids } of missing) {
    log(`  ${String(f).padEnd(14)} ${ids.length}/${metrics.length} 檔缺：${ids.join(" ")}`);
  }
}

await main();
