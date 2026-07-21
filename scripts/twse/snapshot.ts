/**
 * 全市場快照 → 公司基本資料、指標、同業本益比。
 *
 * 這一層只用「一個請求涵蓋整個市場」的端點，所以即使納入上千檔
 * 也只花五、六次請求。逐檔的歷史資料在 history.ts。
 */

import { adToIso, mustNum, num, openApi, rocToIso } from "./client.ts";
import { ETF_TICKERS } from "./universe.ts";

/* ── 端點的原始列型別（欄位名就是 TWSE 給的中文）───────── */

type DayRow = {
  Date: string;
  Code: string;
  Name: string;
  TradeVolume: string;
  TradeValue: string;
  OpeningPrice: string;
  HighestPrice: string;
  LowestPrice: string;
  ClosingPrice: string;
  Change: string;
  Transaction: string;
};

type BwibbuRow = {
  Code: string;
  Name: string;
  PEratio: string;
  DividendYield: string;
  PBratio: string;
};

type InfoRow = Record<string, string>;
type RevenueRow = Record<string, string>;
type FinancialRow = Record<string, string>;

/* ── 正規化後的中間結構 ───────────────────────────────── */

export type Quote = {
  stockId: string;
  name: string;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  turnover: number;
  changePct: number;
};

export type Fundamentals = {
  /** 一般業有、金融業沒有的欄位一律 null，不要填 0 */
  revenue: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  netIncome: number | null;
  eps: number | null;
  equity: number | null;
  asset: number | null;
  liability: number | null;
  bookValuePerShare: number | null;
  /** 財報類型，決定上面哪些欄位有值 */
  reportType: "general" | "financialHolding" | "bank" | "securities";
  year: number;
  quarter: number;
};

export type Snapshot = {
  tradeDate: string;
  quotes: Map<string, Quote>;
  valuation: Map<string, { pe: number | null; pb: number | null; dividendYield: number | null }>;
  info: Map<string, InfoRow>;
  revenue: Map<string, RevenueRow>;
  financials: Map<string, Fundamentals>;
  /** 產業別 → 該產業全市場本益比中位數 */
  industryPe: Map<string, number>;
  /** 個股 → 產業別名稱 */
  industryOf: Map<string, string>;
  marketBreadth: {
    advancing: number;
    declining: number;
    unchanged: number;
    /** 漲跌停：TWSE 未直接提供，以漲跌幅逼近 ±10% 認定，屬近似值 */
    limitUp: number;
    limitDown: number;
  };
  marketTurnover: number;
  /** 大盤各類指數的當日快照（無歷史序列，序列另從 FMTQIK 取） */
  indices: IndexQuote[];
};

export type IndexQuote = { name: string; code: string; value: number; changePct: number };

type IndexRow = { 指數: string; 收盤指數: string; 漲跌百分比: string };

/** dashboard 指數列要顯示的幾檔，對應 MI_INDEX 的「指數」名稱 */
const WANTED_INDICES: Array<{ match: string; name: string; code: string }> = [
  { match: "發行量加權股價指數", name: "加權指數", code: "TAIEX" },
  { match: "臺灣50指數", name: "台灣50", code: "T50" },
  { match: "半導體類指數", name: "半導體", code: "SEMI" },
  { match: "其他電子類指數", name: "其他電子", code: "OTHR" },
];

/* ── 抓取 ─────────────────────────────────────────────── */

const byKey = <T extends Record<string, string>>(rows: T[], key: string): Map<string, T> =>
  new Map(rows.map((r) => [r[key], r]));

export async function fetchSnapshot(): Promise<Snapshot> {
  const [day, bwibbu, info, revenue, isCi, bsCi, isFh, bsFh, indexSnap] =
    await Promise.all([
      openApi<DayRow[]>("exchangeReport/STOCK_DAY_ALL"),
      openApi<BwibbuRow[]>("exchangeReport/BWIBBU_ALL"),
      openApi<InfoRow[]>("opendata/t187ap03_L"),
      openApi<RevenueRow[]>("opendata/t187ap05_L"),
      openApi<FinancialRow[]>("opendata/t187ap06_L_ci"),
      openApi<FinancialRow[]>("opendata/t187ap07_L_ci"),
      openApi<FinancialRow[]>("opendata/t187ap06_L_fh"),
      openApi<FinancialRow[]>("opendata/t187ap07_L_fh"),
      openApi<IndexRow[]>("exchangeReport/MI_INDEX"),
    ]);

  const tradeDate = rocToIso(day[0].Date);

  const quotes = new Map<string, Quote>();
  let advancing = 0;
  let declining = 0;
  let unchanged = 0;
  let limitUp = 0;
  let limitDown = 0;
  let turnover = 0;

  for (const r of day) {
    const close = num(r.ClosingPrice);
    const change = num(r.Change);
    // 全額交割股或當日無成交時整列可能沒有價格 —— 跳過而不是記成 0
    if (close === null || change === null || close === 0) continue;

    const prev = close - change;
    const value = num(r.TradeValue) ?? 0;
    turnover += value;
    const pct = prev > 0 ? (change / prev) * 100 : 0;

    if (change > 0) advancing++;
    else if (change < 0) declining++;
    else unchanged++;
    // 台股漲跌幅上限 10%，收在 9.9% 以外者視為觸及漲跌停（近似）
    if (pct >= 9.9) limitUp++;
    else if (pct <= -9.9) limitDown++;

    quotes.set(r.Code, {
      stockId: r.Code,
      name: r.Name.trim(),
      close,
      open: num(r.OpeningPrice) ?? close,
      high: num(r.HighestPrice) ?? close,
      low: num(r.LowestPrice) ?? close,
      volume: num(r.TradeVolume) ?? 0,
      turnover: value,
      // 用前一日收盤當分母。TWSE 只給價差，沒有給百分比。
      changePct: prev > 0 ? (change / prev) * 100 : 0,
    });
  }

  const valuation = new Map(
    bwibbu.map((r) => [
      r.Code,
      {
        // 虧損的公司本益比是空字串，不是 0（例：1301 台塑）
        pe: num(r.PEratio),
        pb: num(r.PBratio),
        dividendYield: num(r.DividendYield),
      },
    ]),
  );

  const infoMap = byKey(info, "公司代號");
  const revenueMap = byKey(revenue, "公司代號");

  const financials = new Map<string, Fundamentals>();
  collectGeneral(financials, isCi, bsCi);
  collectFinancialHolding(financials, isFh, bsFh);

  const industryOf = new Map<string, string>();
  for (const [id, row] of revenueMap) {
    const name = row["產業別"]?.trim();
    if (name) industryOf.set(id, name);
  }

  const indices: IndexQuote[] = WANTED_INDICES.map((want) => {
    const row = indexSnap.find((r) => r["指數"].includes(want.match));
    return {
      name: want.name,
      code: want.code,
      value: row ? mustNum(row["收盤指數"], want.name) : 0,
      changePct: row ? num(row["漲跌百分比"]) ?? 0 : 0,
    };
  });

  return {
    tradeDate,
    quotes,
    valuation,
    info: infoMap,
    revenue: revenueMap,
    financials,
    industryPe: computeIndustryPe(industryOf, valuation),
    industryOf,
    marketBreadth: { advancing, declining, unchanged, limitUp, limitDown },
    marketTurnover: turnover,
    indices,
  };
}

/* ── 財報正規化 ───────────────────────────────────────── */

function collectGeneral(
  out: Map<string, Fundamentals>,
  income: FinancialRow[],
  balance: FinancialRow[],
): void {
  const bs = byKey(balance, "公司代號");

  for (const r of income) {
    const id = r["公司代號"];
    const b = bs.get(id);
    if (!b) continue;

    const revenue = num(r["營業收入"]);
    const netIncome = num(r["本期淨利（淨損）"]);
    const asset = num(b["資產總額"]);
    const pct = (part: number | null): number | null =>
      part === null || revenue === null || revenue === 0 ? null : (part / revenue) * 100;

    out.set(id, {
      revenue,
      grossMargin: pct(num(r["營業毛利（毛損）淨額"]) ?? num(r["營業毛利（毛損）"])),
      operatingMargin: pct(num(r["營業利益（損失）"])),
      netMargin: pct(netIncome),
      netIncome,
      eps: num(r["基本每股盈餘（元）"]),
      equity: num(b["權益總額"]),
      asset,
      liability: num(b["負債總額"]),
      bookValuePerShare: num(b["每股參考淨值"]),
      reportType: "general",
      year: Number(r["年度"]) + 1911,
      quarter: Number(r["季別"]),
    });
  }
}

/**
 * 金控與銀行的損益表沒有「營業收入」這個概念 —— 收入端是利息淨收益
 * 與利息以外淨收益。因此毛利率／營益率／淨利率對它們不成立，一律留 null，
 * 而不是硬拿「淨收益」當分母湊一個數字出來。
 * 資產負債表的欄位名也不同（資產總計 vs 資產總額）。
 */
function collectFinancialHolding(
  out: Map<string, Fundamentals>,
  income: FinancialRow[],
  balance: FinancialRow[],
): void {
  const bs = byKey(balance, "公司代號");

  for (const r of income) {
    const id = r["公司代號"];
    const b = bs.get(id);
    if (!b) continue;

    out.set(id, {
      revenue: null,
      grossMargin: null,
      operatingMargin: null,
      netMargin: null,
      netIncome: num(r["本期稅後淨利（淨損）"]),
      eps: num(r["基本每股盈餘（元）"]),
      equity: num(b["權益總計"]),
      asset: num(b["資產總計"]),
      liability: num(b["負債總計"]),
      bookValuePerShare: num(b["每股參考淨值"]),
      reportType: "financialHolding",
      year: Number(r["年度"]) + 1911,
      quarter: Number(r["季別"]),
    });
  }
}

/* ── 同業本益比 ───────────────────────────────────────── */

/**
 * 用中位數而不是平均數。本益比的分布嚴重右偏 —— 一家獲利趨近於零的公司
 * 可以有 PE 800，一檔就足以把整個產業的平均值拉到沒有參考價值。
 * 中位數對這種離群值不敏感，而 screener 的「低於同業平均」要的正是
 * 「比一半的同業便宜」這個語意。
 */
function computeIndustryPe(
  industryOf: Map<string, string>,
  valuation: Map<string, { pe: number | null }>,
): Map<string, number> {
  const buckets = new Map<string, number[]>();

  for (const [id, industry] of industryOf) {
    const pe = valuation.get(id)?.pe;
    // 虧損股沒有本益比，不能當成 0 拉低同業水準
    if (pe === null || pe === undefined || pe <= 0) continue;
    const list = buckets.get(industry);
    if (list) list.push(pe);
    else buckets.set(industry, [pe]);
  }

  const out = new Map<string, number>();
  for (const [industry, values] of buckets) {
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    const median =
      values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
    out.set(industry, Math.round(median * 100) / 100);
  }
  return out;
}

/* ── 公司基本資料 ─────────────────────────────────────── */

export type CompanyOut = {
  id: number;
  stockId: string;
  companyName: string;
  industry: string;
  market: "TWSE" | "OTC" | "ETF";
  listingDate: string;
};

export function buildCompany(
  stockId: string,
  index: number,
  snap: Snapshot,
): CompanyOut {
  const quote = snap.quotes.get(stockId);
  if (!quote) throw new Error(`${stockId} 不在當日成交行情中`);

  if (ETF_TICKERS.has(stockId)) {
    return {
      id: index + 1,
      stockId,
      companyName: quote.name,
      industry: "ETF",
      market: "ETF",
      // ETF 不在 t187ap03_L 裡，沒有上市日期可查
      listingDate: "",
    };
  }

  const info = snap.info.get(stockId);
  if (!info) throw new Error(`${stockId} 不在公司基本資料中`);

  return {
    id: index + 1,
    stockId,
    // 用簡稱：「台積電」而不是「台灣積體電路製造股份有限公司」，
    // 高密度表格塞不下全名
    companyName: (info["公司簡稱"] ?? quote.name).trim(),
    industry: snap.industryOf.get(stockId) ?? "其他",
    market: "TWSE",
    listingDate: adToIso(info["上市日期"]),
  };
}

/** 流通股數。TWSE 只給實收資本額，得自己除面額。 */
export function sharesOutstanding(info: InfoRow): number {
  const capital = mustNum(info["實收資本額"], "實收資本額");
  // "新台幣                 10.0000元" —— 面額幾乎都是 10，但不要寫死
  const parValue = num(info["普通股每股面額"]?.replace(/[^\d.]/g, "")) ?? 10;
  return capital / parValue;
}
