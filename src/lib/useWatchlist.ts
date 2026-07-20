"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_WATCHLIST,
  STORAGE_KEY,
  parseStored,
  serialize,
} from "./watchlist";

/**
 * 追蹤清單的讀寫。結構刻意比照 useDeltaColors —— 兩者都是
 * 「localStorage 裡的使用者偏好」，沒有理由用兩套寫法。
 *
 * 同樣用 useSyncExternalStore 而非 useEffect + useState：
 * 後者在 hydration 後會多一次串聯渲染，且無法處理多分頁同時修改。
 *
 * 與配色不同的是，追蹤清單影響的是「畫面上有哪幾列」，
 * 不像 CSS 變數能靠阻塞腳本在繪製前就位。因此 server 端一律以
 * getServerSnapshot 的預設清單渲染，hydration 後才換成使用者的清單。
 * useSyncExternalStore 會替我們處理這個交接，不會噴 hydration mismatch。
 */

const listeners = new Set<() => void>();

// getSnapshot 必須回傳穩定參照，否則 React 判定每次都變了而無限重繪。
// 以原始字串為鍵快取解析結果。
let cachedRaw: string | null = null;
let cachedValue: string[] = DEFAULT_WATCHLIST;

function getSnapshot(): string[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseStored(raw) ?? DEFAULT_WATCHLIST;
  }
  return cachedValue;
}

/** SSR 沒有 localStorage */
function getServerSnapshot(): string[] {
  return DEFAULT_WATCHLIST;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // storage 事件只在「其他分頁」寫入時觸發，用來讓多個分頁保持一致。
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function onStorage(e: StorageEvent) {
  if (e.key !== null && e.key !== STORAGE_KEY) return;
  emit();
}

function emit() {
  for (const cb of listeners) cb();
}

function write(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(ids));
  } catch {
    // 無痕模式或 storage 已滿：這次工作階段仍然生效，只是不會被記住。
    // 不值得為此打斷使用者。
    cachedRaw = null;
    cachedValue = ids;
  }
  emit();
}

export function useWatchlist() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const add = useCallback((id: string) => {
    const cur = getSnapshot();
    if (cur.includes(id)) return;
    write([...cur, id]);
  }, []);

  const remove = useCallback((id: string) => {
    write(getSnapshot().filter((x) => x !== id));
  }, []);

  const toggle = useCallback((id: string) => {
    const cur = getSnapshot();
    write(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }, []);

  const reset = useCallback(() => write(DEFAULT_WATCHLIST), []);

  return { ids, add, remove, toggle, reset };
}
