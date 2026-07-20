import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_TC } from "next/font/google";
import { APPLY_SCRIPT } from "@/lib/theme/delta-colors";
import "./globals.css";

/**
 * 字體雙軌：拉丁字母與數字走 Geist，中文自動 fallback 至 Noto Sans TC。
 * globals.css 的 --font-sans 把兩者串成同一條 fallback chain。
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const notoTC = Noto_Sans_TC({
  variable: "--font-noto-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "測度 — 台股基本面研究工具",
    template: "%s — 測度",
  },
  description:
    "彙整台股公開財報、月營收與法人進出，計算基本面指標並依自訂條件篩選。資料僅供研究參考，不構成投資建議。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="zh-Hant-TW"
      className={`${geistSans.variable} ${geistMono.variable} ${notoTC.variable} h-full antialiased`}
    >
      <head>
        {/*
          在任何繪製之前套用使用者的漲跌配色。
          若改成等 hydration 後才套用，使用者會先看到一瞬間的預設配色 ——
          在這個介面裡那代表「短暫顯示了相反的漲跌資訊」，不只是樣式閃爍。
          內容為本檔案內建的常數字串，不含任何外部或使用者輸入。
        */}
        <script dangerouslySetInnerHTML={{ __html: APPLY_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-text">
        {children}
      </body>
    </html>
  );
}
