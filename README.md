# 測度 — 台股基本面研究工具（前端）

彙整台股公開財報、月營收與法人進出，計算基本面指標，並依使用者自訂條件篩選個股。

> **這是前端原型，資料為模擬值。**
> 目前所有數字都由 `src/lib/mock/` 以固定種子產生，**不是真實市場資料**。
> 本專案呈現公開資料與依設定計算出的指標，**不構成投資建議**。

## 現況

只有前端 + 型別化的 mock 資料層。PRD 中的 Data Collector、PostgreSQL、
FastAPI、AI Analyzer 皆尚未實作 —— mock 層刻意以固定介面隔開，
之後接上真實 API 時 UI 層不需改動。

| 頁面 | 路徑 | 說明 |
| --- | --- | --- |
| 落地頁 | `/` | 專案說明與範圍邊界 |
| 市場概況 | `/dashboard` | 大盤、成交量、三大法人、漲跌家數 |
| 個股 | `/stock/[id]` | K 線、財務指標、月營收、股利、財報摘要 |
| 選股篩選 | `/screener` | 自訂條件篩選（支援相對條件） |
| 追蹤清單 | `/watchlist` | 追蹤標的的價格與基本面變化 |

收錄 12 檔標的：2330、2454、2382、3711、2317、2891、1301、2308、2412、3034、1216、0050。

篩選條件除了絕對數值，也支援「高於去年」與「低於同業平均」——
門檻會隨每檔個股自身的歷史與所屬產業浮動。

## 開發

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 靜態預渲染 19 頁
npm test        # vitest
```

測試集中在兩處會靜默出錯的地方：`deltaClass()` 的紅漲綠跌，
以及 screener 的相對條件（去年 / 同業平均）——
這兩者算錯時畫面看起來完全正常，只有結果是錯的。

## 技術

Next.js 16（App Router）· React 19 · TypeScript · Tailwind v4
· TradingView Lightweight Charts（K 線）· Recharts（財務圖表）· zod

## 兩個實作上的重點

**台股漲跌顏色與歐美相反 —— 紅漲綠跌。**
所有漲跌配色必須經過 `deltaClass()`（`src/lib/format.ts`），
不要在元件裡直接寫 `text-red-500`。圖表用 `CHART_COLORS`。

**Tailwind v4 的 CSS 變數語法。**
色彩 token 定義在 `globals.css` 的 `@theme`，會自動產生 `text-up`、`bg-surface`
等 utility。**不要**用 v3 的 `text-[--color-up]` 寫法 —— v4 會輸出
`color: --color-up`（缺少 `var()`），瀏覽器直接丟棄，顏色會靜默失效。

## 尚未驗證

介面未經實際視覺確認（開發時的預覽分頁無法算繪、截圖不可用），
所有驗證都是透過 computed style 與 DOM 斷言完成。
版面、間距與圖表可讀性建議先 `npm run dev` 目視檢查。

## 授權

MIT，見 [LICENSE](LICENSE)。
