import { COMPANY_BY_ID } from "@/lib/mock/companies";

export const STORAGE_KEY = "twstock.watchlist";

/**
 * 尚未設定過追蹤清單時的預設內容。
 * 空清單對第一次進站的人來說只是一個空表格，看不出這頁能做什麼，
 * 所以先給一組，使用者可以自行增減。
 */
export const DEFAULT_WATCHLIST = [
  "2330",
  "2454",
  "2382",
  "2308",
  "3034",
  "2412",
];

/**
 * 解析 localStorage 內容。
 *
 * 這裡的輸入不可信 —— 可能是舊版格式、別的分頁寫壞的、
 * 或使用者自己改過的。任何一項不合法就整筆退回 null 由呼叫端用預設值，
 * 比讓半壞的清單進到畫面上安全。
 *
 * 同時過濾掉不存在的代號：收錄範圍變動後（例如某檔下市），
 * 舊清單裡的代號會讓頁面在 COMPANY_BY_ID.get(id)! 上炸掉。
 */
export function parseStored(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((v) => typeof v === "string")) return null;

    const seen = new Set<string>();
    const ids = (parsed as string[]).filter((id) => {
      if (seen.has(id) || !COMPANY_BY_ID.has(id)) return false;
      seen.add(id);
      return true;
    });
    return ids;
  } catch {
    return null;
  }
}

export function serialize(ids: string[]): string {
  return JSON.stringify(ids);
}
