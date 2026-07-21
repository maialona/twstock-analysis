/**
 * TWSE 端點的共用取得層。
 *
 * 兩組來源、兩種脾氣：
 *  - openapi.twse.com.tw  乾淨的 JSON，全市場快照，沒有速率限制的跡象
 *  - www.twse.com.tw      逐股逐月的歷史檔，會擋人（連續打會收到空回應）
 *
 * 因此所有請求都走 fetchJson()，由它統一負責節流與重試 ——
 * 呼叫端不需要自己記得 sleep。
 */

const OPEN_API = "https://openapi.twse.com.tw/v1";
const WWW = "https://www.twse.com.tw";

/** www.twse.com.tw 連續請求的間隔。低於 1 秒實測會開始收到空回應。 */
const THROTTLE_MS = 1200;

let lastWwwCall = 0;

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function throttleWww(): Promise<void> {
  const since = Date.now() - lastWwwCall;
  if (since < THROTTLE_MS) await sleep(THROTTLE_MS - since);
  lastWwwCall = Date.now();
}

type FetchOptions = {
  /** 失敗時重試幾次（不含第一次） */
  retries?: number;
};

async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const isWww = url.startsWith(WWW);

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (isWww) await throttleWww();
    try {
      const res = await fetch(url, {
        headers: {
          // 不帶 UA 時 www.twse.com.tw 有時直接回 HTML 錯誤頁
          "user-agent": "twstock-analysis/0.1 (data collector)",
          accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text.trim()) throw new Error("空回應（多半是被擋）");
      return JSON.parse(text) as T;
    } catch (err) {
      if (attempt === retries) {
        throw new Error(`取得失敗 ${url}\n  ${(err as Error).message}`);
      }
      // 退避：被擋之後馬上重試只會再被擋一次
      await sleep(THROTTLE_MS * (attempt + 2));
    }
  }
  throw new Error("unreachable");
}

export function openApi<T>(path: string): Promise<T> {
  return fetchJson<T>(`${OPEN_API}/${path}`);
}

export function www<T>(path: string): Promise<T> {
  return fetchJson<T>(`${WWW}/${path}`);
}

/* ── 民國紀年 ─────────────────────────────────────────── */

/**
 * TWSE 全站使用民國年，且格式不只一種：
 *   "1150717"    出表日期 / STOCK_DAY_ALL 的 Date
 *   "115/07/17"  STOCK_DAY data[] 裡的日期
 *   "19940905"   t187ap03_L 的上市日期（這個是西元，不要轉）
 */
export function rocToIso(roc: string): string {
  const digits = roc.replace(/\//g, "").trim();
  if (digits.length !== 7) {
    throw new Error(`不是預期的民國日期格式：${roc}`);
  }
  const year = Number(digits.slice(0, 3)) + 1911;
  return `${year}-${digits.slice(3, 5)}-${digits.slice(5, 7)}`;
}

/** t187ap03_L 的上市日期本來就是西元 YYYYMMDD */
export function adToIso(ad: string): string {
  const d = ad.trim();
  if (!/^\d{8}$/.test(d)) throw new Error(`不是預期的西元日期格式：${ad}`);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

/* ── 數值解析 ─────────────────────────────────────────── */

/**
 * TWSE 的數字欄位有三種「沒有值」的表示法：空字串、"-"、"--"，
 * 而且千分位逗號到處都是。全部收斂成 null，由呼叫端決定怎麼處理 ——
 * 這裡刻意不回傳 0，因為 0 和「沒有這個數字」在財報上意義完全不同
 * （1301 台塑虧損所以沒有本益比，不是本益比為 0）。
 */
export function num(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "--") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** 同 num()，但用在「這個欄位一定要有值」的地方，缺了就讓收集程序停下來 */
export function mustNum(raw: string | number | null | undefined, label: string): number {
  const n = num(raw);
  if (n === null) throw new Error(`缺少必要欄位：${label}（原值 ${JSON.stringify(raw)}）`);
  return n;
}
