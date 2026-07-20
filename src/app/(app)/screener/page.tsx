import type { Metadata } from "next";
import { RuleBuilder } from "@/components/screener/RuleBuilder";

export const metadata: Metadata = { title: "選股篩選" };

export default function ScreenerPage() {
  return (
    <div className="density-hi px-4 py-6 md:px-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">選股篩選</h1>
        <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted">
          條件之間以 AND 串接。除了絕對數值，也可把門檻設為「去年同期」或
          「同業平均」— 門檻會隨每檔個股自身的歷史與所屬產業浮動。
        </p>
      </header>

      <RuleBuilder />
    </div>
  );
}
