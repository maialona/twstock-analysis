import type { AiDimension } from "@/lib/schema";
import { AI_DIMENSION_LABELS } from "@/lib/mock/analysis";
import { CHART_COLORS } from "@/lib/format";

/**
 * 五軸雷達圖，取代 PRD 中的 ★★★★★ 星號呈現。
 * 純 SVG server component — 無互動、無 JS、無圖表函式庫。
 */

const KEYS = ["growth", "valuation", "financialHealth", "competitiveness", "risk"] as const;

type Props = {
  dimensions: AiDimension;
  size?: number;
};

export function ScoreRadar({ dimensions, size = 220 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  const n = KEYS.length;

  // 從正上方開始，順時針
  const angleAt = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;

  const pointAt = (i: number, ratio: number) => {
    const a = angleAt(i);
    return [cx + Math.cos(a) * r * ratio, cy + Math.sin(a) * r * ratio] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];

  const polygon = (ratio: number) =>
    KEYS.map((_, i) => pointAt(i, ratio).map((v) => v.toFixed(2)).join(","))
      .join(" ");

  const dataPolygon = KEYS.map((k, i) =>
    pointAt(i, dimensions[k] / 5)
      .map((v) => v.toFixed(2))
      .join(","),
  ).join(" ");

  return (
    <figure className="flex flex-col items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={KEYS.map(
          (k) => `${AI_DIMENSION_LABELS[k]} ${dimensions[k]} 分（滿分 5）`,
        ).join("，")}
      >
        {/* 網格 */}
        {rings.map((ratio) => (
          <polygon
            key={ratio}
            points={polygon(ratio)}
            fill="none"
            stroke={CHART_COLORS.grid}
            strokeWidth="1"
          />
        ))}
        {/* 軸線 */}
        {KEYS.map((_, i) => {
          const [x, y] = pointAt(i, 1);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke={CHART_COLORS.grid}
              strokeWidth="1"
            />
          );
        })}
        {/* 資料區域 */}
        <polygon
          points={dataPolygon}
          fill={CHART_COLORS.accent}
          fillOpacity="0.16"
          stroke={CHART_COLORS.accent}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {KEYS.map((k, i) => {
          const [x, y] = pointAt(i, dimensions[k] / 5);
          return <circle key={k} cx={x} cy={y} r="2.5" fill={CHART_COLORS.accent} />;
        })}
        {/* 軸標籤 */}
        {KEYS.map((k, i) => {
          const [x, y] = pointAt(i, 1.28);
          return (
            <text
              key={k}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="10"
              fill={CHART_COLORS.text}
            >
              {AI_DIMENSION_LABELS[k]}
            </text>
          );
        })}
      </svg>

      {/* 無障礙：提供資料表替代 */}
      <figcaption className="sr-only">
        <table>
          <tbody>
            {KEYS.map((k) => (
              <tr key={k}>
                <th scope="row">{AI_DIMENSION_LABELS[k]}</th>
                <td>{dimensions[k]} / 5</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

/** 分數條，用於 Scoring Engine 的權重明細 */
export function ScoreBar({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: number;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-xs">
      <span className="w-20 shrink-0 text-muted">{label}</span>
      <span className="num w-9 shrink-0 text-right text-faint">
        {Math.round(weight * 100)}%
      </span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="num w-9 shrink-0 text-right text-text">
        {value.toFixed(0)}
      </span>
    </div>
  );
}
