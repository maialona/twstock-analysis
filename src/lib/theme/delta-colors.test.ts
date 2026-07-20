import { describe, expect, it } from "vitest";
import {
  APPLY_SCRIPT,
  BG_HEX,
  DEFAULT_DELTA,
  MIN_CONTRAST,
  PRESETS,
  checkColors,
  contrastRatio,
  isValidHex,
  parseStored,
  tooSimilar,
} from "./delta-colors";

describe("isValidHex", () => {
  it("只接受 6 位 #rrggbb", () => {
    expect(isValidHex("#e5484d")).toBe(true);
    expect(isValidHex("#E5484D")).toBe(true);
    expect(isValidHex("#fff")).toBe(false);
    expect(isValidHex("red")).toBe(false);
    expect(isValidHex("#e5484dff")).toBe(false);
    expect(isValidHex("")).toBe(false);
    expect(isValidHex(null)).toBe(false);
    expect(isValidHex(123)).toBe(false);
  });
});

describe("parseStored", () => {
  it("讀回合法的偏好並正規化為小寫", () => {
    expect(parseStored('{"up":"#AABBCC","down":"#112233"}')).toEqual({
      up: "#aabbcc",
      down: "#112233",
    });
  });

  it("任何壞資料都退回 null，而不是丟出例外", () => {
    // localStorage 是使用者可以隨手改的地方，也可能殘留舊版格式。
    // 這裡若丟例外，阻塞腳本會中斷、整站失去配色。
    for (const bad of [
      null,
      "",
      "not json",
      "[]",
      "null",
      '"#e5484d"',
      "{}",
      '{"up":"#e5484d"}',
      '{"up":"red","down":"#30a46c"}',
      '{"up":"#e5484d","down":null}',
    ]) {
      expect(parseStored(bad)).toBeNull();
    }
  });
});

describe("contrastRatio", () => {
  it("同色為 1、黑白為 21", () => {
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
  });

  it("與比較順序無關", () => {
    expect(contrastRatio("#e5484d", BG_HEX)).toBeCloseTo(
      contrastRatio(BG_HEX, "#e5484d"),
      5,
    );
  });
});

describe("checkColors", () => {
  it("預設配色沒有任何警告", () => {
    expect(checkColors(DEFAULT_DELTA)).toEqual([]);
  });

  it("所有內建 preset 都沒有警告", () => {
    // preset 是我們掛保證的選項，不該推薦一組會被自己警告的配色
    for (const p of PRESETS) {
      expect(checkColors(p.colors), p.name).toEqual([]);
    }
  });

  it("在深色背景上幾乎看不見的顏色會被警告", () => {
    const warnings = checkColors({ up: "#12121a", down: "#30a46c" });
    expect(warnings.some((w) => w.kind === "contrast")).toBe(true);
  });

  it("漲跌選成相近色會被警告", () => {
    const warnings = checkColors({ up: "#e5484d", down: "#d9434a" });
    expect(warnings.some((w) => w.kind === "similar")).toBe(true);
  });

  it("紅綠不算相近 —— 亮度接近但明顯可辨", () => {
    // 這是刻意不用 WCAG 對比度判斷相似度的原因：
    // 紅 #e5484d 與綠 #30a46c 的對比度僅約 1.2，卻沒有人會混淆。
    expect(contrastRatio(DEFAULT_DELTA.up, DEFAULT_DELTA.down)).toBeLessThan(1.5);
    expect(tooSimilar(DEFAULT_DELTA.up, DEFAULT_DELTA.down)).toBe(false);
  });

  it("同時低對比又難以區分時，兩種警告都出現", () => {
    const warnings = checkColors({ up: "#101018", down: "#141420" });
    expect(new Set(warnings.map((w) => w.kind))).toEqual(
      new Set(["contrast", "similar"]),
    );
  });
});

describe("預設配色的可讀性", () => {
  it("預設漲跌色在頁面背景上達到 AA 標準", () => {
    expect(contrastRatio(DEFAULT_DELTA.up, BG_HEX)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    expect(contrastRatio(DEFAULT_DELTA.down, BG_HEX)).toBeGreaterThanOrEqual(
      MIN_CONTRAST,
    );
  });
});

describe("APPLY_SCRIPT", () => {
  it("是自我封閉的 IIFE 且包住 try/catch", () => {
    // 這段是阻塞腳本，一旦丟出例外會擋住後續繪製。
    expect(APPLY_SCRIPT.startsWith("(function(){try{")).toBe(true);
    expect(APPLY_SCRIPT).toContain("catch(e){}");
  });

  it("不含未跳脫的 </script>，避免提前結束標籤", () => {
    expect(APPLY_SCRIPT.toLowerCase()).not.toContain("</script");
  });

  it("實際執行時能套用合法值、忽略非法值", () => {
    const set = new Map<string, string>();
    const doc = { documentElement: { style: { setProperty: (k: string, v: string) => set.set(k, v) } } };

    function run(stored: string | null) {
      set.clear();
      new Function("document", "localStorage", APPLY_SCRIPT)(doc, {
        getItem: () => stored,
      });
    }

    run('{"up":"#00ff00","down":"#ff0000"}');
    expect(set.get("--color-up")).toBe("#00ff00");
    expect(set.get("--color-down")).toBe("#ff0000");

    run('{"up":"javascript:alert(1)","down":"#ff0000"}');
    expect(set.has("--color-up")).toBe(false);
    expect(set.get("--color-down")).toBe("#ff0000");

    // 壞資料不得丟出例外
    for (const bad of [null, "", "{", "[]"]) {
      expect(() => run(bad)).not.toThrow();
    }
  });
});
