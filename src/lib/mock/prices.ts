import type { DailyPrice, InstitutionalFlow } from "@/lib/schema";
import { METRICS_BY_ID } from "./companies";
import { gaussian, mulberry32, round, seedFrom } from "./rng";

const TRADING_DAYS = 250;

/** 產生交易日序列（跳過週末，往回推） */
function tradingDates(count: number, endISO: string): string[] {
  const out: string[] = [];
  const d = new Date(`${endISO}T00:00:00Z`);
  while (out.length < count) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      out.push(d.toISOString().slice(0, 10));
    }
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out.reverse();
}

export const LATEST_DATE = "2026-07-17";
const DATES = tradingDates(TRADING_DAYS, LATEST_DATE);

/**
 * 以幾何布朗運動反推 250 日 OHLC，讓最後一根收盤價
 * 精確等於 companies.ts 中的現價 — 避免圖表與指標對不上。
 *
 * 「對不上」不只是現價：最後一根的漲跌幅也必須等於 metrics.changePct。
 * 表頭、儀表板、追蹤清單顯示的都是 changePct，若 K 線最後一根
 * 自己走自己的，同一頁就會出現「▲ +1.36%」配一根綠色收黑的 K 棒。
 * 因此縮放基準取「前一日收盤」，再把最後一根釘在現價上。
 */
function buildSeries(stockId: string): DailyPrice[] {
  const m = METRICS_BY_ID.get(stockId);
  if (!m) return [];

  const rand = mulberry32(seedFrom(stockId));
  const drift = 0.00042;
  const vol = 0.0168;

  // 先產生相對走勢，最後統一縮放到現價
  const rel: number[] = [1];
  for (let i = 1; i < TRADING_DAYS; i++) {
    const shock = gaussian(rand) * vol + drift;
    rel.push(rel[i - 1] * Math.exp(shock));
  }

  // 先讓「前一日」落在 現價 / (1 + 漲跌幅)，再把最後一根釘死在現價，
  // 如此最後一根的漲跌幅正好等於 m.changePct。
  const prevClose = m.price / (1 + m.changePct / 100);
  const scale = prevClose / rel[rel.length - 2];
  const closes = rel.map((r) => r * scale);
  closes[closes.length - 1] = m.price;

  return DATES.map((date, i) => {
    const close = closes[i];
    const prev = i === 0 ? close : closes[i - 1];

    const open = i === 0 ? prev : prev * (1 + gaussian(rand) * 0.004);
    const bodyHi = Math.max(open, close);
    const bodyLo = Math.min(open, close);
    const high = bodyHi * (1 + Math.abs(gaussian(rand)) * 0.006);
    const low = bodyLo * (1 - Math.abs(gaussian(rand)) * 0.006);

    // 成交量與當日振幅正相關
    const swing = Math.abs(close - open) / open;
    const baseLots = m.marketCap / m.price / 4000;
    const volume = Math.round(baseLots * (0.6 + swing * 26 + rand() * 0.8)) * 1000;

    const digits = close >= 100 ? 1 : 2;
    // 最後一根不套用位數四捨五入 —— 它必須逐字等於 metrics.price，
    // 否則表頭（讀 metrics）與 K 線最後一根會差一個進位，
    // 例如 0050 標價 208.35、圖上卻標 208.4。
    const isLast = i === DATES.length - 1;
    const closeOut = isLast ? m.price : round(close, digits);
    return {
      date,
      stockId,
      open: round(open, digits),
      high: Math.max(round(high, digits), closeOut),
      low: Math.min(round(low, digits), closeOut),
      close: closeOut,
      volume,
      turnover: Math.round(volume * close),
    };
  });
}

const CACHE = new Map<string, DailyPrice[]>();

export function getPrices(stockId: string): DailyPrice[] {
  let s = CACHE.get(stockId);
  if (!s) {
    s = buildSeries(stockId);
    CACHE.set(stockId, s);
  }
  return s;
}

export function getLatestPrice(stockId: string): DailyPrice | undefined {
  const s = getPrices(stockId);
  return s[s.length - 1];
}

/** Sparkline 用：只取收盤價 */
export function getCloseSeries(stockId: string, days = 60): number[] {
  return getPrices(stockId)
    .slice(-days)
    .map((p) => p.close);
}

/* ── 法人買賣超 ──────────────────────────────────────── */

export function getInstitutionalFlow(stockId: string, days = 20): InstitutionalFlow[] {
  const rand = mulberry32(seedFrom(`${stockId}-inst`));
  const m = METRICS_BY_ID.get(stockId);

  // base 的單位是「張」。流通張數 = 市值 / 股價 / 1000。
  // 法人單日淨買賣大約落在流通張數的 0.05% 上下 —
  // 2330 約 ±1.5 萬張，與實際盤後統計同一個量級。
  const lotsOutstanding = m ? m.marketCap / m.price / 1000 : 4_000_000;
  const base = lotsOutstanding * 0.0006;

  return DATES.slice(-days).map((date) => {
    // 外資部位最大，投信次之，自營商最小
    const bias = m && m.changePct > 0 ? 0.22 : -0.16;
    return {
      date,
      stockId,
      foreign: Math.round((gaussian(rand) + bias) * base) * 1000,
      trust: Math.round((gaussian(rand) + bias * 0.6) * base * 0.28) * 1000,
      dealer: Math.round(gaussian(rand) * base * 0.12) * 1000,
    };
  });
}

/* ── 大盤指數 ────────────────────────────────────────── */

export type MarketIndex = {
  name: string;
  code: string;
  value: number;
  change: number;
  changePct: number;
  series: number[];
};

function buildIndex(
  name: string,
  code: string,
  latest: number,
  changePct: number,
  vol: number,
): MarketIndex {
  const rand = mulberry32(seedFrom(code));
  const rel: number[] = [1];
  for (let i = 1; i < 60; i++) {
    rel.push(rel[i - 1] * Math.exp(gaussian(rand) * vol + 0.0005));
  }
  const scale = latest / rel[rel.length - 1];
  const series = rel.map((r) => round(r * scale, 2));
  const change = round((latest * changePct) / 100, 2);
  return { name, code, value: latest, change, changePct, series };
}

export const MARKET_INDICES: MarketIndex[] = [
  buildIndex("加權指數", "TAIEX", 24_186.42, 0.87, 0.0092),
  buildIndex("櫃買指數", "TPEX", 254.73, -0.34, 0.0114),
  buildIndex("台灣50", "T50", 21_407.86, 1.12, 0.0098),
  buildIndex("半導體類指數", "SEMI", 6_842.19, 1.43, 0.0136),
];

/* ── 市場概況 ────────────────────────────────────────── */

export const MARKET_BREADTH = {
  advancing: 621,
  declining: 318,
  unchanged: 94,
  limitUp: 17,
  limitDown: 3,
};

export const MARKET_TURNOVER = {
  value: 486_270_000_000,
  changePct: 12.4,
  fiveDayAvg: 432_180_000_000,
};

/** 三大法人整體買賣超（單位：元） */
export const MARKET_INSTITUTIONAL = [
  { name: "外資", net: 18_640_000_000, streak: 4 },
  { name: "投信", net: 3_270_000_000, streak: 9 },
  { name: "自營商", net: -1_840_000_000, streak: -2 },
];
