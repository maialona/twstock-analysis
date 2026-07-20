import { cn } from "@/lib/format";

/**
 * 免責聲明。常駐於所有 AI 輸出區塊、評分區塊與頁尾。
 *
 * 這是產品定位的一部分：本平台呈現公開財務資料與依使用者設定
 * 計算出的指標，不構成投資建議。請勿移除。
 */

export function Disclaimer({
  variant = "block",
  className,
}: {
  variant?: "block" | "inline" | "footer";
  className?: string;
}) {
  const text =
    variant === "inline"
      ? "本區內容為公開財務資料之整理，非投資建議。"
      : "本平台所有數據來自公開資訊，指標與分數係依使用者設定之條件計算而得，僅供研究參考，不構成任何投資建議或買賣要約。投資決策應自行判斷並承擔風險。";

  if (variant === "inline") {
    return (
      <p className={cn("text-xs leading-relaxed text-faint", className)}>
        {text}
      </p>
    );
  }

  if (variant === "footer") {
    return (
      <p
        className={cn(
          "max-w-[70ch] text-xs leading-relaxed text-faint",
          className,
        )}
      >
        {text}
      </p>
    );
  }

  return (
    <aside
      className={cn(
        "border-l-2 border-border-strong pl-3 text-xs leading-relaxed text-faint",
        className,
      )}
    >
      {text}
    </aside>
  );
}
