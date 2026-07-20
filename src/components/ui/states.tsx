import { cn } from "@/lib/format";

/* ── Skeleton ────────────────────────────────────────────
   骨架尺寸必須與實際內容一致，避免載入完成時版面跳動。
   不使用圓形 spinner。

   注意：本專案不使用 route-level loading.tsx。
   這幾條路由全部是 SSG 靜態預渲染、沒有任何非同步取數，
   loading.tsx 只會多產生一個 Suspense boundary 而沒有實際等待對象。
   實測在本機 production build 中，加上 loading.tsx 後該路由會停在
   fallback 不顯示內容（該次觀察是在不會渲染的預覽分頁中取得，
   若要沿用 loading.tsx 請先在一般瀏覽器中複驗）。
   骨架一律放在真正有等待的元件內部處理（見 CandleChart）。
──────────────────────────────────────────────────────── */

export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={cn("shimmer rounded", className)} style={style} aria-hidden />;
}

/* ── Empty ───────────────────────────────────────────────
   空狀態必須說明「如何取得資料」，而非只寫「無資料」。
──────────────────────────────────────────────────────── */

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 border-t border-border py-14",
        className,
      )}
    >
      {/* 簡潔 SVG 圖形，非 emoji */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-border-strong"
        aria-hidden
      >
        <path d="M3 17.5 8.5 12l3.5 3.5L21 6.5" />
        <path d="M3 21h18" />
      </svg>
      <h3 className="text-sm font-medium text-text">{title}</h3>
      <p className="max-w-[46ch] text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action}
    </div>
  );
}

/* ── Error ───────────────────────────────────────────────
   行內錯誤 + 重試，不用全頁攔截。
──────────────────────────────────────────────────────── */

export function ErrorState({
  title = "資料載入失敗",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-2 border-l-2 border-up bg-up-dim/40 px-4 py-3",
        className,
      )}
    >
      <h3 className="text-sm font-medium text-text">{title}</h3>
      <p className="text-sm text-muted">{description}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 cursor-pointer rounded border border-border-strong px-2.5 py-1 text-xs text-text transition-transform duration-150 hover:border-faint active:scale-[0.97]"
        >
          重新載入
        </button>
      )}
    </div>
  );
}
