import { describe, expect, it } from "vitest";
import { COMPANY_BY_ID } from "./mock/companies";
import { DEFAULT_WATCHLIST, parseStored, serialize } from "./watchlist";

/**
 * localStorage 的內容不可信：可能是舊版格式、別的分頁寫壞的、
 * 或使用者自己改過的。壞資料進到頁面會在 COMPANY_BY_ID.get(id)! 上炸掉，
 * 而那是一個沒有 fallback 的驚嘆號 —— 所以擋在這裡。
 */
describe("追蹤清單的儲存解析", () => {
  it("預設清單裡的代號都在收錄範圍內", () => {
    for (const id of DEFAULT_WATCHLIST) {
      expect(COMPANY_BY_ID.has(id), id).toBe(true);
    }
  });

  it("正常內容可以來回轉換", () => {
    const ids = ["2330", "2454"];
    expect(parseStored(serialize(ids))).toEqual(ids);
  });

  it("保留使用者的排列順序", () => {
    expect(parseStored(serialize(["2412", "2330", "2454"]))).toEqual([
      "2412",
      "2330",
      "2454",
    ]);
  });

  it("剔除收錄範圍外的代號，而不是整組放棄", () => {
    expect(parseStored(serialize(["2330", "9999", "2454"]))).toEqual([
      "2330",
      "2454",
    ]);
  });

  it("去除重複 —— 同一檔出現兩次會讓 React key 撞號", () => {
    expect(parseStored(serialize(["2330", "2330", "2454"]))).toEqual([
      "2330",
      "2454",
    ]);
  });

  it("空清單是合法狀態，不該被當成「沒設定過」", () => {
    expect(parseStored(serialize([]))).toEqual([]);
  });

  describe("壞資料一律回傳 null 由呼叫端用預設值", () => {
    it.each([
      ["null 或空字串", null],
      ["空字串", ""],
      ["不是 JSON", "not json"],
      ["不是陣列", '{"a":1}'],
      ["數字陣列", "[1,2,3]"],
      ["混入非字串", '["2330",null]'],
      ["巢狀陣列", '[["2330"]]'],
    ])("%s", (_label, raw) => {
      expect(parseStored(raw)).toBeNull();
    });
  });

  it("全部代號都無效時回傳空陣列（有解析成功，只是都被剔除）", () => {
    expect(parseStored(serialize(["9999", "0000"]))).toEqual([]);
  });
});
