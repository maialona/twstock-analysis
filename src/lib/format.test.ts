import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHART_COLORS, deltaBg, deltaClass, formatNetLots, formatPct, formatTWD, formatVolume } from "./format";

/**
 * 這支測試存在的理由只有一個：台股紅漲綠跌寫反了，畫面看起來完全正常，
 * 使用者卻會把漲讀成跌。沒有任何型別或 lint 能擋下這種錯誤。
 */

describe("deltaClass — 台股漲跌配色", () => {
  it("漲用 up、跌用 down", () => {
    expect(deltaClass(1.36)).toBe("text-up");
    expect(deltaClass(-2.06)).toBe("text-down");
  });

  it("平盤與無資料都是 flat，不落入漲或跌", () => {
    expect(deltaClass(0)).toBe("text-flat");
    expect(deltaClass(-0)).toBe("text-flat");
    expect(deltaClass(null)).toBe("text-flat");
    expect(deltaClass(undefined)).toBe("text-flat");
    expect(deltaClass(NaN)).toBe("text-flat");
  });

  it("deltaBg 與 deltaClass 對同一個值給出同一個語意", () => {
    for (const n of [3.4, -1.2, 0, null, NaN]) {
      expect(deltaBg(n)).toBe(deltaClass(n).replace("text-", "bg-"));
    }
  });
});

describe("up/down token 的實際色碼", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../app/globals.css", import.meta.url)),
    "utf8",
  );

  function tokenValue(name: string): string {
    const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (!m) throw new Error(`globals.css 找不到 --color-${name}`);
    return m[1].toLowerCase();
  }

  /** #rrggbb → 紅通道是否明顯高於綠通道 */
  function isReddish(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    return r > g + 40;
  }

  it("--color-up 是紅色、--color-down 是綠色（與歐美相反）", () => {
    expect(isReddish(tokenValue("up"))).toBe(true);
    expect(isReddish(tokenValue("down"))).toBe(false);
  });

  it("CHART_COLORS 與 globals.css 沒有漂移", () => {
    // 圖表庫吃 hex、UI 吃 CSS 變數，兩份定義必須一致，
    // 否則會出現「表格紅、K 線綠」這種只有肉眼抓得到的錯位。
    expect(CHART_COLORS.up).toBe(tokenValue("up"));
    expect(CHART_COLORS.down).toBe(tokenValue("down"));
    expect(CHART_COLORS.flat).toBe(tokenValue("flat"));
    expect(CHART_COLORS.accent).toBe(tokenValue("accent"));
  });
});

describe("formatTWD — 億 / 萬", () => {
  it("依量級切換單位", () => {
    expect(formatTWD(281_400_000_000)).toBe("2,814.0 億");
    expect(formatTWD(35_600_000)).toBe("3,560.0 萬");
    expect(formatTWD(4_200)).toBe("4,200");
  });

  it("負數保留符號", () => {
    expect(formatTWD(-3_400_000_000)).toBe("-34.0 億");
  });

  it("無資料顯示破折號而不是 0", () => {
    expect(formatTWD(null)).toBe("—");
    expect(formatTWD(NaN)).toBe("—");
  });
});

describe("成交量 / 法人買賣超的股數→張數換算", () => {
  it("1000 股 = 1 張", () => {
    expect(formatVolume(1_000)).toBe("1 張");
    expect(formatVolume(28_500_000)).toBe("2.9 萬張");
  });

  it("法人買賣超帶正負號", () => {
    expect(formatNetLots(29_774_000)).toBe("+29,774");
    expect(formatNetLots(-935_000)).toBe("-935");
    expect(formatNetLots(0)).toBe("0");
  });
});

describe("formatPct", () => {
  it("預設帶號，signed=false 時不帶", () => {
    expect(formatPct(12.4)).toBe("+12.40%");
    expect(formatPct(-6.4)).toBe("-6.40%");
    expect(formatPct(30.4, 1, false)).toBe("30.4%");
  });
});
