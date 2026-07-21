"use client";

import { Bookmark, BookmarkSimple } from "@phosphor-icons/react/dist/ssr";
import { useWatchlist } from "@/lib/useWatchlist";
import { cn } from "@/lib/format";

/**
 * 加入／移除追蹤。
 *
 * server 端會以預設清單渲染（useSyncExternalStore 的 getServerSnapshot），
 * hydration 後才換成使用者實際的清單，因此按鈕狀態可能在載入後翻轉一次。
 * 這裡不用骨架擋住 —— 翻轉的是一個按鈕的樣式，不是任何一個數字，
 * 而阻擋渲染反而會讓標題列在每次載入時跳動。
 */
export function WatchToggle({
  stockId,
  companyName,
}: {
  stockId: string;
  companyName: string;
}) {
  const { ids, toggle } = useWatchlist();
  const watched = ids.includes(stockId);
  const Icon = watched ? Bookmark : BookmarkSimple;

  return (
    <button
      type="button"
      onClick={() => toggle(stockId)}
      aria-pressed={watched}
      aria-label={
        watched
          ? `從追蹤清單移除 ${stockId} ${companyName}`
          : `將 ${stockId} ${companyName} 加入追蹤清單`
      }
      className={cn(
        "flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1 text-xs",
        "transition-all duration-150 active:scale-[0.97]",
        watched
          ? "border-border-strong text-text"
          : "border-border text-muted hover:border-border-strong hover:text-text",
      )}
    >
      <Icon size={13} weight={watched ? "fill" : "regular"} />
      {watched ? "已追蹤" : "加入追蹤"}
    </button>
  );
}
