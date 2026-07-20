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
| 選股篩選 | `/screener` | 自訂條件篩選（支援相對條件），條件存在網址 |
| 追蹤清單 | `/watchlist` | 追蹤標的的價格與基本面變化，存在 localStorage |

收錄 12 檔標的：2330、2454、2382、3711、2317、2891、1301、2308、2412、3034、1216、0050。

篩選條件除了絕對數值，也支援「高於去年」與「低於同業平均」——
門檻會隨每檔個股自身的歷史與所屬產業浮動。

## 兩處使用者狀態

**篩選條件放在網址，不放在 component state。** 調出一組有意義的條件之後，
使用者會想存書籤或貼給別人；放在 state 裡重新整理就沒了，也沒有東西可以分享。
格式是看得懂的字串，網址本身就是說明：

```
/screener?q=roe:gt:15,revenueYoy:gt:10,debtRatio:lt:50,pe:lt:ia
```

`ly` = 去年同期、`ia` = 同業平均。網址是不可信輸入 —— 壞掉的單一條件會被跳過
而不是整組退回預設，因為分享出去的連結少一個條件比整個篩選器重置好懂。
編解碼與防禦見 `src/lib/rule-url.ts`。

**追蹤清單放在 localStorage**，結構比照既有的漲跌配色偏好（`useDeltaColors`）——
兩者都是「localStorage 裡的使用者偏好」，沒有理由用兩套寫法。
同樣以 `useSyncExternalStore` 訂閱，因此多個分頁會保持一致。

清單只決定「顯示哪幾列」，每一列的欄位值仍由 server component 先算好再傳進來，
不需要把整個 mock 資料層打包進 client bundle。

## 開發

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 靜態預渲染 19 頁
npm test        # vitest
```

測試集中在會靜默出錯的地方：`deltaClass()` 的紅漲綠跌、
screener 的相對條件（去年 / 同業平均），以及價格序列與
`changePct` 的一致性 —— 這些算錯時畫面看起來完全正常，
每個數字單看都合理，只有湊在一起才是錯的。

另外兩處是不可信輸入的解析：網址裡的篩選條件與 localStorage 裡的追蹤清單。
兩者都可能是舊格式、別的分頁寫壞的、或使用者自己改過的，
壞資料會一路走到 `COMPANY_BY_ID.get(id)!` 那個沒有 fallback 的驚嘆號。

## 技術

Next.js 16（App Router）· React 19 · TypeScript · Tailwind v4
· TradingView Lightweight Charts（K 線）· Recharts（財務圖表）· zod

## 兩個實作上的重點

**台股漲跌顏色與歐美相反 —— 紅漲綠跌，且可由使用者自訂。**
所有漲跌配色必須經過 `deltaClass()`（`src/lib/format.ts`），
不要在元件裡直接寫 `text-red-500`。圖表用 `CHART_COLORS`。

自訂配色只換 `--color-up` / `--color-down` 兩個 CSS 變數的值，
語意 token 名稱不動 —— 因此全站 80 幾個 `text-up` / `bg-down`
使用點都不需要修改。偏好存在 localStorage，並由 `layout.tsx` 中的
阻塞腳本在繪製前套用（若等 hydration 才套，會有一瞬間顯示相反的漲跌資訊）。

例外是 canvas 繪製的 K 線圖：`var()` 在 canvas 中無效，
必須用 `useChartColors()` 取實際色碼，見 `src/components/charts/useChartColors.ts`。

**Tailwind v4 的 CSS 變數語法。**
色彩 token 定義在 `globals.css` 的 `@theme`，會自動產生 `text-up`、`bg-surface`
等 utility。**不要**用 v3 的 `text-[--color-up]` 寫法 —— v4 會輸出
`color: --color-up`（缺少 `var()`），瀏覽器直接丟棄，顏色會靜默失效。

## 視覺驗證

介面已實際目視檢查過。5 個頁面（含 ETF 的 `/stock/0050`）在
1280×800、768×1024、375×812 三種視窗下逐頁截圖確認，
預設配色與自訂配色（橘漲藍跌）各跑一輪，console 無錯誤。

先前只由程式碼路徑保證的部分現已實際觀察：K 線（canvas）
與 Recharts 的長條、折線都會跟著使用者的配色改變；
阻塞腳本有效，重新整理不會閃出相反的漲跌色。

這輪檢查抓到並修掉的問題：

- **表頭漲跌幅與 K 線最後一根不一致。** `changePct` 原本套用在序列的
  第一天，但序列是縮放成「最後一根等於現價」，兩者互不相干 ——
  12 檔裡有 6 檔的表頭方向與自己的 K 線相反（台積電表頭 ▲ +1.36%，
  K 線最後一根卻收黑 −1.55%）。已改為由前一日收盤反推，
  並加上 `src/lib/mock/prices.test.ts` 防止再次脫鉤。
- **自訂配色時 console 會噴 hydration mismatch。** 阻塞腳本在
  hydration 前就把 inline style 寫進 `<html>`，與 server HTML 不同。
  這個差異是設計換來的，已在該節點標註 `suppressHydrationWarning`。
- **K 線約有一半的載入會被擠成右側一小條。** `createChart()` 沒有帶 width，
  函式庫自己量容器；這個 effect 可能在版面尚未穩定（字體還在載入）時就跑，
  量到的寬度偏小，`fitContent()` 據此算出很窄的 bar spacing，
  之後 ResizeObserver 把畫布拉寬時 spacing 不會重算。
  已改為明確帶入寬度，並在每次 resize 後重新 `fitContent()`。
- 成交量的最後值標籤蓋住價格軸刻度（`9.98B` 疊在 `800.00` 上）。
- 行動版頂欄「測度」被搜尋框擠成兩行。
- 三大法人的漲跌色沒走 `deltaClass()` / `deltaBg()`，淨額為 0 時會顯示綠色。

高密度表格在窄螢幕採容器內橫向捲動（`overflow-x-auto` + `min-w`），
頁面本身不會橫向溢出 —— 維持數字對齊優先於塞進畫面。

仍未涵蓋：只在單一 Chromium 核心的內建瀏覽器上看過，
未在 Safari / Firefox 或實機測試；也還沒有視覺回歸測試，
版面若被改壞不會有測試擋下來。

## 授權

MIT，見 [LICENSE](LICENSE)。
