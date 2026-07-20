/**
 * 漲跌配色偏好。
 *
 * 台股預設紅漲綠跌，但習慣美股的使用者會把顏色讀反 —— 這不是美感問題，
 * 是會讓人誤判持股的問題。因此開放自訂。
 *
 * 實作上刻意只換 --color-up / --color-down 兩個 CSS 變數的「值」，
 * 語意 token 名稱不動。deltaClass() 與全站 80 幾個 text-up / bg-down
 * 使用點因此完全不需要修改 —— 它們表達的是「漲」「跌」，不是「紅」「綠」。
 */

export type DeltaColors = {
  /** 上漲色 */
  up: string;
  /** 下跌色 */
  down: string;
};

export const STORAGE_KEY = "twstock.delta-colors";

/** 頁面背景色，對比度計算的基準（對應 globals.css 的 --color-bg） */
export const BG_HEX = "#09090b";

export const DEFAULT_DELTA: DeltaColors = { up: "#e5484d", down: "#30a46c" };

export const PRESETS: Array<{ name: string; note: string; colors: DeltaColors }> = [
  { name: "台股", note: "紅漲綠跌", colors: DEFAULT_DELTA },
  { name: "美股", note: "綠漲紅跌", colors: { up: "#30a46c", down: "#e5484d" } },
  {
    name: "色覺友善",
    note: "橘漲藍跌",
    // 紅綠是對色覺辨識最不友善的一組配色。改用橘 / 藍，
    // 在各類色覺條件下都能區分，且亮度差異也夠。
    colors: { up: "#f0883e", down: "#4c8dff" },
  },
];

/**
 * 圖表中不隨偏好變動的中性色。canvas 需要實際色碼，無法用 var()。
 * 與 globals.css 的一致性由測試把關（見 delta-colors.test.ts）。
 */
export const CHART_NEUTRALS = {
  flat: "#71717a",
  accent: "#0ea5e9",
  border: "#27272a",
  faint: "#71717a",
  muted: "#a1a1aa",
} as const;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHex(s: unknown): s is string {
  return typeof s === "string" && HEX_RE.test(s);
}

/** 解析 localStorage 內容；任何不合法的輸入都退回 null，由呼叫端決定預設值 */
export function parseStored(raw: string | null): DeltaColors | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as unknown;
    if (typeof o !== "object" || o === null) return null;
    const { up, down } = o as Record<string, unknown>;
    if (!isValidHex(up) || !isValidHex(down)) return null;
    return { up: up.toLowerCase(), down: down.toLowerCase() };
  } catch {
    return null;
  }
}

/* ── 對比度 ────────────────────────────────────────────
   使用者可以選到任何顏色，包含在深色背景上幾乎看不見的深藍、
   或與另一個方向難以區分的鄰近色。這裡不阻擋選擇（那是使用者的自由），
   但必須明確警告 —— 一個看不見的漲跌色等於沒有漲跌資訊。
──────────────────────────────────────────────────── */

function channels(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** WCAG 相對亮度 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 對比度，1–21 */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** 表格中的數字屬於小尺寸文字，套用 WCAG AA 的 4.5:1 */
export const MIN_CONTRAST = 4.5;

/**
 * 兩色是否過於接近而難以區分。
 *
 * 注意：這是啟發式判斷，不是嚴謹的色差公式。單看 WCAG 對比度會誤判 ——
 * 紅 #e5484d 與綠 #30a46c 的亮度極為接近（對比度僅約 1.24），
 * 但沒有人會覺得紅綠難以分辨。因此改用 RGB 空間的歐氏距離，
 * 門檻由實測抓一個保守值：紅綠約 205，兩個相近的紅約 12。
 */
export function tooSimilar(a: string, b: string): boolean {
  const [r1, g1, b1] = channels(a);
  const [r2, g2, b2] = channels(b);
  const d = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  return d < 60;
}

export type ColorWarning = { kind: "contrast" | "similar"; message: string };

/** 回傳所有該提醒使用者的問題；空陣列代表配色沒問題 */
export function checkColors(c: DeltaColors): ColorWarning[] {
  const out: ColorWarning[] = [];

  for (const [key, label] of [
    ["up", "上漲"],
    ["down", "下跌"],
  ] as const) {
    const ratio = contrastRatio(c[key], BG_HEX);
    if (ratio < MIN_CONTRAST) {
      out.push({
        kind: "contrast",
        message: `${label}色在深色背景上的對比度僅 ${ratio.toFixed(1)}:1，低於易讀標準 ${MIN_CONTRAST}:1，數字會看不清楚。`,
      });
    }
  }

  if (tooSimilar(c.up, c.down)) {
    out.push({
      kind: "similar",
      message: "上漲與下跌的顏色過於接近，兩者將難以區分。",
    });
  }

  return out;
}

/**
 * 在頁面繪製前套用偏好色的行內腳本。
 *
 * 必須是同步阻塞腳本：若等到 React hydrate 後才套用，使用者會先看到
 * 一瞬間的預設配色再跳成自訂色。在一個用顏色表達漲跌的工具裡，
 * 那一瞬間顯示的是「相反的資訊」，不是單純的樣式閃爍。
 */
export const APPLY_SCRIPT = `(function(){try{
var r=document.documentElement,s=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
if(!s)return;var o=JSON.parse(s),h=/^#[0-9a-fA-F]{6}$/;
if(h.test(o.up))r.style.setProperty('--color-up',o.up);
if(h.test(o.down))r.style.setProperty('--color-down',o.down);
}catch(e){}})();`;
