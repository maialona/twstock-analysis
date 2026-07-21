/**
 * 歷年股利 → 真實的現金／股票股利。
 *
 * 來源：mopsov.twse.com.tw/mops/web/ajax_t05st09_2（股利分派情形），
 * 逐檔查一段年度區間，回傳每一「股利所屬年度」的合計股利。
 *
 * 注意兩點：
 *  1. 這頁的標籤是「大寫」<TR>/<TD>（t164 財報是小寫），解析要 case-insensitive。
 *  2. 台積電等已改「按季配息」，同一所屬年度會有多筆（第1~4季），
 *     年度股利要把該年所有期別的現金／股票股利加總。
 */

import { num, sleep } from "./client.ts";

const MOPS = "https://mopsov.twse.com.tw/mops/web";
const THROTTLE_MS = 1500;
let lastCall = 0;

async function throttle(): Promise<void> {
  const since = Date.now() - lastCall;
  if (since < THROTTLE_MS) await sleep(THROTTLE_MS - since);
  lastCall = Date.now();
}

async function fetchDividendPage(
  coId: string,
  fromRocYear: number,
  toRocYear: number,
  retries = 5,
): Promise<string> {
  const body = new URLSearchParams({
    encodeURIComponent: "1",
    step: "1",
    firstin: "1",
    off: "1",
    TYPEK: "sii", // 上市
    co_id: coId,
    date1: String(fromRocYear),
    date2: String(toRocYear),
    qryType: "1",
  });
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle();
    try {
      const res = await fetch(`${MOPS}/ajax_t05st09_2`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          referer: `${MOPS}/t05st09`,
          "user-agent": "twstock-analysis/0.1 (data collector)",
        },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (html.includes("SECURITY REASONS")) throw new Error("被安全機制擋下");
      return html;
    } catch (err) {
      if (attempt === retries) {
        throw new Error(`取得股利失敗 ${coId} ${fromRocYear}~${toRocYear}\n  ${(err as Error).message}`);
      }
      await sleep(3000 * (attempt + 1));
    }
  }
  throw new Error("unreachable");
}

function cells(row: string): string[] {
  return [...row.matchAll(/<td[^>]*>(.*?)<\/td>/gis)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/&nbsp;| /g, " ").trim(),
  );
}

export type DividendYear = {
  stockId: string;
  year: number; // 西元，股利所屬年度
  cashDividend: number; // 元/股，當年各期合計
  stockDividend: number; // 元/股，當年各期合計
};

/**
 * ajax_t05st09_2 每列 21 欄（見檔頭）；用得到的：
 *   col1  股利所屬年（季）度  例「114年第3季」或「113年」
 *   col10 盈餘分配之現金股利、col11 法定盈餘公積現金、col12 資本公積現金（元/股）
 *   col14 盈餘轉增資配股、col15 法定盈餘公積轉增資、col16 資本公積轉增資（元/股）
 */
export async function fetchDividendHistory(
  stockId: string,
  fromRocYear: number,
  toRocYear: number,
): Promise<DividendYear[]> {
  const html = await fetchDividendPage(stockId, fromRocYear, toRocYear);
  const rows = [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)].map((m) => cells(m[1]));

  const byYear = new Map<number, { cash: number; stock: number }>();
  for (const c of rows) {
    if (c.length < 17) continue;
    const m = /^(\d{2,3})年/.exec(c[1]);
    if (!m) continue;
    const year = Number(m[1]) + 1911;
    const cash = (num(c[10]) ?? 0) + (num(c[11]) ?? 0) + (num(c[12]) ?? 0);
    const stock = (num(c[14]) ?? 0) + (num(c[15]) ?? 0) + (num(c[16]) ?? 0);
    // 整列都沒有數字（標題／小計列）就跳過
    if (num(c[10]) === null && num(c[14]) === null) continue;
    const agg = byYear.get(year) ?? { cash: 0, stock: 0 };
    agg.cash += cash;
    agg.stock += stock;
    byYear.set(year, agg);
  }

  return [...byYear.entries()]
    .map(([year, v]) => ({
      stockId,
      year,
      cashDividend: Math.round(v.cash * 100) / 100,
      stockDividend: Math.round(v.stock * 100) / 100,
    }))
    .sort((a, b) => a.year - b.year);
}
