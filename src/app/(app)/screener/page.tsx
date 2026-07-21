import { Suspense } from "react";
import type { Metadata } from "next";
import { RuleBuilder } from "@/components/screener/RuleBuilder";
import { Skeleton } from "@/components/ui/states";

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

      {/*
        RuleBuilder 用 useSearchParams 讀條件。這是預渲染路由，
        Next.js 要求這類元件包在 Suspense 裡 —— 否則整棵子樹會被迫
        改成 client-side render，連上面的靜態內容都不會出現在初始 HTML。
      */}
      <Suspense fallback={<RuleBuilderSkeleton />}>
        <RuleBuilder />
      </Suspense>
    </div>
  );
}

/** 版面與 RuleBuilder 的雙欄一致，避免條件載入時整頁跳動 */
function RuleBuilderSkeleton() {
  return (
    <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[22rem_1fr]">
      <div className="flex flex-col gap-1.5" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
