"use client";

import { useMemo } from "react";
import { useDeltaColors } from "@/lib/theme/useDeltaColors";
import { CHART_NEUTRALS } from "@/lib/theme/delta-colors";

/**
 * canvas 圖表用的實際色碼。
 *
 * SVG 圖表可以直接寫 var(--color-up)，canvas 不行 —— lightweight-charts
 * 會把字串原封不動交給 CanvasRenderingContext2D，var() 在那裡無效，
 * 畫出來會是靜默的黑色。所以這裡必須給出真正的色碼。
 *
 * 中性色（格線、座標軸、文字）在執行期不會變，直接用常數；
 * 只有漲跌色是使用者可調的，從偏好讀。這比 getComputedStyle 可靠 ——
 * 不必擔心樣式表尚未套用時讀到空字串。
 * 常數與 globals.css 的一致性由 delta-colors.test.ts 把關。
 */

export type ResolvedChartColors = typeof CHART_NEUTRALS & {
  up: string;
  down: string;
};

export function useChartColors(): ResolvedChartColors {
  const { colors } = useDeltaColors();
  // 必須記憶化：CandleChart 把這個物件放在 useEffect 依賴中，
  // 每次渲染都給新參照的話，K 線圖會不斷重建。
  return useMemo(
    () => ({ ...CHART_NEUTRALS, up: colors.up, down: colors.down }),
    [colors],
  );
}
