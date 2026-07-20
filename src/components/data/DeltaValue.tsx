import { cn, deltaClass, formatPct, formatSigned } from "@/lib/format";

/**
 * 漲跌數值顯示。所有顏色都經過 deltaClass()，
 * 確保台股「紅漲綠跌」慣例只在一處定義。
 */

type Props = {
  value: number | null | undefined;
  /** 顯示格式：百分比或帶正負號的絕對值 */
  format?: "pct" | "signed";
  digits?: number;
  className?: string;
  /** 加上 ▲▼ 方向標記 */
  arrow?: boolean;
};

export function DeltaValue({
  value,
  format = "pct",
  digits = 2,
  className,
  arrow = false,
}: Props) {
  const text =
    format === "pct" ? formatPct(value, digits) : formatSigned(value, digits);

  const mark =
    !arrow || value === null || value === undefined || value === 0
      ? null
      : value > 0
        ? "▲"
        : "▼";

  return (
    <span className={cn("num", deltaClass(value), className)}>
      {mark && <span className="mr-0.5 text-[0.85em]">{mark}</span>}
      {text}
    </span>
  );
}

/** 純數值，不帶漲跌色 */
export function NumValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("num", className)}>{children}</span>;
}
