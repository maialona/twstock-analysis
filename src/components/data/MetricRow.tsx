import { cn } from "@/lib/format";

/**
 * 指標列。刻意不使用 card —
 * 高密度儀表板用 1px 分隔線與負空間分組，不用容器盒子。
 */

type Props = {
  label: string;
  value: React.ReactNode;
  /** 次要說明，例如「同業 26.4x」 */
  hint?: string;
  className?: string;
};

export function MetricRow({ label, value, hint, className }: Props) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2",
        "text-[length:var(--fs-data,0.8125rem)]",
        className,
      )}
    >
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="flex items-baseline gap-2 text-right">
        {hint && <span className="text-xs text-faint">{hint}</span>}
        <span className="tabular-nums">{value}</span>
      </dd>
    </div>
  );
}

/**
 * 指標群組。用 border-t + 標題做邏輯分組，取代 card 容器。
 */
export function MetricGroup({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-border pt-3", className)}>
      <h3 className="mb-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-faint">
        {title}
      </h3>
      <dl className="divide-y divide-border/60">{children}</dl>
    </section>
  );
}

/**
 * 大數字展示，用於 KPI。同樣不用 card。
 */
export function StatBlock({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <span className="num text-2xl leading-none tracking-tight">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}
