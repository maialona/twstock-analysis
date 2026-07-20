"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_DELTA, STORAGE_KEY, parseStored, type DeltaColors } from "./delta-colors";

/**
 * 漲跌配色偏好的讀寫。
 *
 * localStorage 是 React 之外的可變狀態，所以用 useSyncExternalStore 訂閱，
 * 而不是 useEffect + useState 去「同步」它 —— 後者在 hydration 時會多一次
 * 串聯渲染，而且無法正確處理多分頁同時修改的情況。
 *
 * 不需要 Provider：顏色本身透過 <html> 的 CSS 變數傳遞，
 * 絕大多數元件（含 server component 與所有 SVG 圖表）寫 var(--color-up)
 * 就會自動跟著變。這個 hook 只服務設定介面與 canvas 圖表。
 */

const listeners = new Set<() => void>();

// getSnapshot 必須回傳穩定的參照，否則 React 會判定每次都變了而無限重繪。
// 因此以原始字串為鍵快取解析結果。
let cachedRaw: string | null = null;
let cachedValue: DeltaColors = DEFAULT_DELTA;

function getSnapshot(): DeltaColors {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parseStored(raw) ?? DEFAULT_DELTA;
  }
  return cachedValue;
}

/** SSR 沒有 localStorage，一律以預設值渲染 */
function getServerSnapshot(): DeltaColors {
  return DEFAULT_DELTA;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  // storage 事件只在「其他分頁」寫入時觸發，用來讓多個分頁保持一致 ——
  // 否則兩個分頁會對同一支股票顯示相反的顏色。
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

function applyToDocument(c: DeltaColors) {
  const r = document.documentElement;
  r.style.setProperty("--color-up", c.up);
  r.style.setProperty("--color-down", c.down);
}

function write(c: DeltaColors | null) {
  try {
    if (c) localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 無痕模式或 storage 已滿：配色在本次工作階段仍然生效，只是不會被記住。
    // 不值得為此打斷使用者。
  }
  applyToDocument(c ?? DEFAULT_DELTA);
  emit();
}

export function useDeltaColors() {
  const colors = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setColors = useCallback((c: DeltaColors) => write(c), []);
  const reset = useCallback(() => write(null), []);
  return { colors, setColors, reset };
}
