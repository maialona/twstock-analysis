import type { AiAnalysis } from "@/lib/schema";

/**
 * AI Analyzer 輸出（PRD 第九節）。
 *
 * 定位約束：所有文字都是對「已公開財務資料」的描述性整理，
 * 不含買賣建議、目標價、或「適合投資」這類判斷。
 * summary 陳述事實，risks / catalysts 列出可觀察的變因，
 * outlook 描述公司自身揭露的方向 — 由使用者自行判讀。
 */

const ANALYSES: Record<string, Omit<AiAnalysis, "stockId">> = {
  "2330": {
    updatedAt: "2026-07-17T14:32:00+08:00",
    summary: [
      "近四季營收年增 33.6%，毛利率維持在 58.7%，先進製程占整體晶圓營收比重續揚。",
      "海外廠陸續進入量產階段，資本支出維持高檔，自由現金流仍達 5,874 億元。",
      "ROE 30.4% 高於同業中位數，負債比 29.6% 為業內偏低水準。",
    ],
    risks: [
      "海外廠初期成本結構較高，短期稀釋整體毛利率",
      "終端消費性電子需求波動直接影響成熟製程稼動率",
      "匯率變動：新台幣兌美元每升值 1%，毛利率約減少 0.4 個百分點",
      "地緣政治影響客戶供應鏈布局決策",
    ],
    catalysts: [
      "先進製程產能於下半年逐季開出",
      "高效能運算相關客戶下單能見度延伸至次年",
      "先進封裝產能擴充計畫",
    ],
    outlook:
      "公司於最近一次法說會揭露，全年美元營收年增率目標維持在中段二十百分比區間，資本支出區間未調整。管理層說明先進製程需求能見度較高，成熟製程稼動率則視消費性終端庫存去化進度。",
    dimensions: {
      growth: 5,
      valuation: 3,
      financialHealth: 5,
      competitiveness: 5,
      risk: 3,
    },
  },
  "2454": {
    updatedAt: "2026-07-17T14:28:00+08:00",
    summary: [
      "近四季 EPS 71.43 元，年增率放緩至 14.3%，毛利率 48.9% 較去年同期小幅下滑。",
      "旗艦平台出貨比重提升帶動平均單價，但入門產品線競爭導致整體毛利承壓。",
      "殖利率 4.09% 於半導體族群中偏高，配息率維持穩定。",
    ],
    risks: [
      "手機晶片市場競爭加劇，價格壓力持續",
      "客戶集中度偏高，前五大客戶占營收逾四成",
      "研發費用率上升侵蝕營益率",
    ],
    catalysts: [
      "旗艦平台導入新客戶",
      "車用與 AI 邊緣運算產品線營收占比提升",
      "庫存水位回到正常區間",
    ],
    outlook:
      "公司預期次季營收季增率落在低個位數百分比，毛利率區間與本季相近。管理層指出旗艦產品出貨動能為主要變數。",
    dimensions: {
      growth: 4,
      valuation: 4,
      financialHealth: 5,
      competitiveness: 4,
      risk: 3,
    },
  },
  "2382": {
    updatedAt: "2026-07-17T14:25:00+08:00",
    summary: [
      "近四季營收年增 41.7%，為追蹤清單中成長最快，但毛利率僅 9.2%。",
      "AI 伺服器出貨放量帶動營收規模，代工模式使獲利率結構性偏低。",
      "負債比 71.4% 明顯高於同業，主因應付帳款隨營收規模同步擴張。",
    ],
    risks: [
      "毛利率僅個位數，營收成長對淨利貢獻有限",
      "負債比 71.4% 偏高，利率變動對財務費用敏感",
      "單一客戶訂單調整將直接反映於營收",
      "本益比 17.07 倍已高於自身五年均值",
    ],
    catalysts: [
      "AI 伺服器機櫃出貨量持續攀升",
      "液冷方案導入提升單機價值",
      "產品組合改善帶動毛利率回升",
    ],
    outlook:
      "公司揭露 AI 伺服器全年出貨目標維持不變，並說明產能配置以高階機種為優先。毛利率改善幅度取決於產品組合變化。",
    dimensions: {
      growth: 5,
      valuation: 3,
      financialHealth: 2,
      competitiveness: 4,
      risk: 2,
    },
  },
  "1301": {
    updatedAt: "2026-07-17T14:19:00+08:00",
    summary: [
      "近四季營收年減 6.4%，EPS 1.18 元，五年 CAGR 為 -14.7%。",
      "石化產品價差持續受壓縮，營益率降至 1.3%。",
      "自由現金流為負 34 億元，股價淨值比 0.87 倍低於帳面價值。",
    ],
    risks: [
      "產品價差受原油與供給循環影響，波動度高",
      "自由現金流轉負，配息能力受限",
      "區域新產能開出使供給端壓力延續",
      "本益比 36.27 倍係因獲利基期偏低所致，非估值偏貴的直接指標",
    ],
    catalysts: [
      "區域需求回溫帶動產品價差修復",
      "高值化產品比重提升",
      "同業產能調節",
    ],
    outlook:
      "公司說明目前產業處於供給調整階段，並未提供明確的價差回升時程。管理層表示將優先控制營運資金與資本支出。",
    dimensions: {
      growth: 1,
      valuation: 3,
      financialHealth: 3,
      competitiveness: 3,
      risk: 2,
    },
  },
};

/** 預設模板，供沒有專屬分析的個股使用 */
function fallback(): Omit<AiAnalysis, "stockId"> {
  return {
    updatedAt: "2026-07-17T14:00:00+08:00",
    summary: [
      "本檔尚未產生完整的財報摘要，以下指標由公開財務資料直接計算。",
      "資料涵蓋近 12 季財報與近 12 個月營收公告。",
      "如需完整分析，請於資料更新後重新產生。",
    ],
    risks: ["尚未產生風險因子清單"],
    catalysts: ["尚未產生觀察重點清單"],
    outlook: "尚未產生。可先參考左側的財務指標與月營收趨勢自行判讀。",
    dimensions: {
      growth: 3,
      valuation: 3,
      financialHealth: 3,
      competitiveness: 3,
      risk: 3,
    },
  };
}

export function getAnalysis(stockId: string): AiAnalysis {
  const a = ANALYSES[stockId] ?? fallback();
  return { stockId, ...a };
}

export function hasFullAnalysis(stockId: string): boolean {
  return stockId in ANALYSES;
}

export const AI_DIMENSION_LABELS = {
  growth: "成長性",
  valuation: "估值",
  financialHealth: "財務健康",
  competitiveness: "競爭力",
  risk: "風險",
} as const;
