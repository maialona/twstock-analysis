import { CHART_COLORS } from "@/lib/format";

/**
 * 極輕量 SVG sparkline — 不引入圖表函式庫。
 * 純 server component，無互動、無 JS。
 */

type Props = {
  data: number[];
  width?: number;
  height?: number;
  /** 由呼叫端決定漲跌，避免此元件重複判斷邏輯 */
  trend?: number;
  className?: string;
};

export function Sparkline({
  data,
  width = 96,
  height = 28,
  trend,
  className,
}: Props) {
  if (data.length < 2) {
    return <div style={{ width, height }} className={className} aria-hidden />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });

  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${d} L${width},${height} L0,${height} Z`;

  const direction = trend ?? data[data.length - 1] - data[0];
  const color =
    direction > 0
      ? CHART_COLORS.up
      : direction < 0
        ? CHART_COLORS.down
        : CHART_COLORS.flat;

  const gid = `spark-${Math.abs(Math.round(data[0] * 1000))}-${data.length}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`近 ${data.length} 日走勢，${direction > 0 ? "上漲" : direction < 0 ? "下跌" : "持平"}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
