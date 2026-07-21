import type { AiAnalysis, AiDimension } from "@/lib/schema";
import { METRICS_BY_ID } from "./companies";
import { LATEST_DATE } from "./source";

/**
 * 「AI 分析」的定位（PRD 第九節）：對已公開財務資料的描述性整理。
 *
 * 現況誠實說明：PRD 的 AI Analyzer（讀法說會逐字稿、新聞產生摘要）尚未實作，
 * 沒有真實的文字摘要來源。因此：
 *  - summary / risks / catalysts / outlook 一律不對外顯示（hasFullAnalysis 恆為 false），
 *    個股頁會落到「尚未產生摘要」的空狀態，不會出現與真實數字打架的手寫文案。
 *  - 指標分佈雷達圖（dimensions）則由「真實財務指標」推導，是可計算、可驗證的，
 *    所以照常顯示。
 *
 * 換句話說，這支只把「能算的」算出來，不假裝有「還沒做的」文字生成。
 */

/** 把指標線性映射到 0–5，夾在範圍內；缺值回到中性 2.5 */
function to5(value: number | null | undefined, lo: number, hi: number): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 2.5;
  const t = ((value - lo) / (hi - lo)) * 5;
  return Math.round(Math.max(0, Math.min(5, t)) * 10) / 10;
}

/** 越低越好的指標（本益比相對同業、負債比）*/
function to5Inverse(value: number | null | undefined, lo: number, hi: number): number {
  return Math.round((5 - to5(value, lo, hi)) * 10) / 10;
}

function dimensionsFor(stockId: string): AiDimension {
  const m = METRICS_BY_ID.get(stockId);
  if (!m) {
    return { growth: 0, valuation: 0, financialHealth: 0, competitiveness: 0, risk: 0 };
  }
  const peRatio = m.pe !== null && m.industryPe ? m.pe / m.industryPe : null;
  return {
    growth: to5(m.revenueYoy, -15, 45),
    valuation: to5Inverse(peRatio, 0.5, 2),
    financialHealth: to5Inverse(m.debtRatio, 20, 80),
    competitiveness: to5(m.grossMargin, 0, 60),
    // 風險軸：分數越高代表越穩健（負債低、獲利率高）
    risk: Math.round(((to5Inverse(m.debtRatio, 20, 80) + to5(m.netMargin, 0, 40)) / 2) * 10) / 10,
  };
}

const EMPTY = { summary: [] as string[], risks: [], catalysts: [], outlook: "" };

export function getAnalysis(stockId: string): AiAnalysis {
  return {
    stockId,
    updatedAt: `${LATEST_DATE}T00:00:00+08:00`,
    // 這四項不會被渲染（hasFullAnalysis 為 false），僅為型別完整
    summary: [EMPTY.summary[0] ?? "", "", ""] as [string, string, string],
    risks: EMPTY.risks,
    catalysts: EMPTY.catalysts,
    outlook: EMPTY.outlook,
    dimensions: dimensionsFor(stockId),
  };
}

/**
 * 目前沒有任何個股有真實的文字摘要來源，一律回 false，
 * 讓頁面顯示誠實的空狀態，而不是舊 mock 那種與真實數字對不上的手寫文案。
 */
export function hasFullAnalysis(_stockId: string): boolean {
  return false;
}

export const AI_DIMENSION_LABELS = {
  growth: "成長性",
  valuation: "估值",
  financialHealth: "財務健康",
  competitiveness: "競爭力",
  risk: "風險",
} as const;
