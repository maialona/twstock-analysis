/**
 * 歷史序列。這些端點都只給「一天」或「一個月」，所以每往回一段時間
 * 就是一次請求 —— 這裡是整個收集程序的時間成本所在。
 *
 * 三種粒度：
 *  - STOCK_DAY   逐股 × 逐月（FOCUS 檔數 × 月數）
 *  - FMTQIK      逐月（全市場共用，順帶提供交易日曆）
 *  - T86 / CSV   逐日 / 逐月（全市場共用）
 */

import { mustNum, num, rocToIso, www } from "./client.ts";

/* ── TWSE 舊式回應：fields + data 二維陣列 ─────────────── */

type TableResponse = {
  stat: string;
  fields?: string[];
  data?: string[][];
};

function rows(res: TableResponse, label: string): string[][] {
  if (res.stat !== "OK") {
    // 「查詢日期大於可查詢最大日期」等狀況會走到這裡，屬於預期內
    return [];
  }
  if (!res.data) throw new Error(`${label} 回應沒有 data`);
  return res.data;
}

/* ── K 線 ─────────────────────────────────────────────── */

export type PriceRow = {
  date: string;
  stockId: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  turnover: number;
};

/**
 * STOCK_DAY 一次回傳「該月整月」，date 參數只用來指定月份。
 * 停牌或該月無交易的個股會回傳 stat != OK，視為空月份而不是錯誤。
 */
export async function fetchMonthPrices(
  stockId: string,
  yearMonth: { year: number; month: number },
): Promise<PriceRow[]> {
  const date = `${yearMonth.year}${String(yearMonth.month).padStart(2, "0")}01`;
  const res = await www<TableResponse>(
    `exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${stockId}`,
  );

  return rows(res, `STOCK_DAY ${stockId} ${date}`)
    .map((r) => {
      const close = num(r[6]);
      // 無成交的交易日整列是 "--"，跳過
      if (close === null) return null;
      return {
        date: rocToIso(r[0]),
        stockId,
        open: num(r[3]) ?? close,
        high: num(r[4]) ?? close,
        low: num(r[5]) ?? close,
        close,
        volume: num(r[1]) ?? 0,
        turnover: num(r[2]) ?? 0,
      };
    })
    .filter((r): r is PriceRow => r !== null);
}

/** 產生往回 n 個月的年月清單（含當月），由舊到新 */
export function recentMonths(count: number, from: Date): Array<{ year: number; month: number }> {
  const out: Array<{ year: number; month: number }> = [];
  let y = from.getFullYear();
  let m = from.getMonth() + 1;
  for (let i = 0; i < count; i++) {
    out.push({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out.reverse();
}

/* ── 大盤：加權指數與成交金額 ─────────────────────────── */

export type MarketDay = {
  date: string;
  taiex: number;
  change: number;
  turnover: number;
  volume: number;
};

export async function fetchMarketMonth(ym: {
  year: number;
  month: number;
}): Promise<MarketDay[]> {
  const date = `${ym.year}${String(ym.month).padStart(2, "0")}01`;
  const res = await www<TableResponse>(`exchangeReport/FMTQIK?response=json&date=${date}`);

  return rows(res, `FMTQIK ${date}`).map((r) => ({
    date: rocToIso(r[0]),
    turnover: mustNum(r[2], "成交金額"),
    volume: mustNum(r[1], "成交股數"),
    taiex: mustNum(r[4], "發行量加權股價指數"),
    change: mustNum(r[5], "漲跌點數"),
  }));
}

/* ── 三大法人 ─────────────────────────────────────────── */

export type FlowRow = {
  date: string;
  stockId: string;
  foreign: number;
  trust: number;
  dealer: number;
};

/**
 * T86 是逐日的全市場檔，一次請求就涵蓋所有個股，
 * 因此外層只要迴圈日期、不要迴圈個股。
 *
 * 「外資」採市場慣例＝外陸資（不含外資自營商）＋ 外資自營商，
 * 與 TWSE 三大法人合計表的口徑一致；只取前者會與新聞數字對不上。
 */
export async function fetchFlowsForDate(
  isoDate: string,
  keep: Set<string>,
): Promise<FlowRow[]> {
  const compact = isoDate.replace(/-/g, "");
  const res = await www<TableResponse>(
    `fund/T86?response=json&date=${compact}&selectType=ALL`,
  );

  const focus: FlowRow[] = [];
  for (const r of rows(res, `T86 ${compact}`)) {
    const stockId = r[0].trim();
    if (!keep.has(stockId)) continue;
    focus.push({
      date: isoDate,
      stockId,
      foreign: (num(r[4]) ?? 0) + (num(r[7]) ?? 0),
      trust: num(r[10]) ?? 0,
      dealer: num(r[11]) ?? 0,
    });
  }
  return focus;
}

/* ── 全市場三大法人買賣超金額 ─────────────────────────── */

export type InstitutionalMoney = {
  date: string;
  foreign: number;
  trust: number;
  dealer: number;
};

/**
 * BFI82U 是全市場三大法人的「買賣超金額」（單位：元），與 T86 的
 * 「股數」不同 —— dashboard 顯示的是金額（億元），所以用這支，不要拿
 * T86 的股數去湊。外資＝外資及陸資＋外資自營商；自營商＝自行買賣＋避險。
 */
export async function fetchInstitutionalMoney(
  isoDate: string,
): Promise<InstitutionalMoney | null> {
  const compact = isoDate.replace(/-/g, "");
  const res = await www<TableResponse>(
    `fund/BFI82U?response=json&dayDate=${compact}&type=day`,
  );
  const data = rows(res, `BFI82U ${compact}`);
  if (!data.length) return null;

  const netOf = (label: string): number =>
    data
      .filter((r) => r[0].includes(label))
      .reduce((sum, r) => sum + (num(r[3]) ?? 0), 0);

  return {
    date: isoDate,
    foreign: netOf("外資"),
    trust: netOf("投信"),
    dealer: netOf("自營商"),
  };
}

/* ── 月營收 ───────────────────────────────────────────── */

export type RevenueRow = {
  stockId: string;
  month: string;
  revenue: number;
  mom: number;
  yoy: number;
};

/**
 * MOPS 的月營收 CSV。一個檔涵蓋當月全部上市公司，
 * 所以 24 個月只要 24 次請求，不需要逐檔抓。
 *
 * 檔名用民國年月，內容是 UTF-8 with BOM（同目錄的 .html 卻是 Big5，
 * 不要沿用 HTML 那邊的編碼假設）。
 */
export async function fetchRevenueMonth(ym: {
  year: number;
  month: number;
}): Promise<RevenueRow[]> {
  const rocYear = ym.year - 1911;
  // 同目錄下的 .html 檔名多一個 _0 後綴，.csv 沒有 —— 沿用 HTML 的檔名會全數 404
  const url = `https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_${rocYear}_${ym.month}.csv`;

  const res = await fetch(url, {
    headers: { "user-agent": "twstock-analysis/0.1 (data collector)" },
  });
  if (!res.ok) return [];

  const text = (await res.text()).replace(/^﻿/, "");
  const monthKey = `${ym.year}-${String(ym.month).padStart(2, "0")}`;

  const out: RevenueRow[] = [];
  for (const line of text.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const cells = parseCsvLine(line);
    // 檔案中夾雜產業別小計與說明列，欄位數不足者略過
    if (cells.length < 10) continue;

    const stockId = cells[2];
    const revenueThousands = num(cells[5]);
    if (!/^\d{4}$/.test(stockId) || revenueThousands === null) continue;

    out.push({
      stockId,
      month: monthKey,
      // CSV 的營收欄位單位是「千元」，UI 一律以「元」顯示與換算，這裡先乘回來
      revenue: revenueThousands * 1000,
      mom: num(cells[8]) ?? 0,
      yoy: num(cells[9]) ?? 0,
    });
  }
  return out;
}

/** 欄位值以雙引號包住且可能含逗號，不能直接 split(",") */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}
