import Link from "next/link";
import type { Metadata } from "next";
import { DeltaValue } from "@/components/data/DeltaValue";
import { Sparkline } from "@/components/data/Sparkline";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { COMPANY_BY_ID, METRICS_BY_ID } from "@/lib/mock/companies";
import { getCloseSeries, getInstitutionalFlow } from "@/lib/mock/prices";
import { getMonthlyRevenue } from "@/lib/mock/financials";
import { getScore } from "@/lib/mock/scoring";
import { formatNetLots, formatPct, formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "追蹤清單" };

/** 之後接上帳號系統時，這裡改為讀取使用者的追蹤設定 */
const WATCHED = ["2330", "2454", "2382", "2308", "3034", "2412"];

export default function WatchlistPage() {
  const rows = WATCHED.map((id) => {
    const company = COMPANY_BY_ID.get(id)!;
    const metrics = METRICS_BY_ID.get(id)!;
    const monthly = getMonthlyRevenue(id);
    const flows = getInstitutionalFlow(id, 5);
    const foreignNet = flows.reduce((s, f) => s + f.foreign, 0);
    return {
      company,
      metrics,
      latestMonth: monthly[monthly.length - 1],
      foreignNet,
      score: getScore(id)?.total ?? 0,
    };
  });

  return (
    <div className="density-hi px-4 py-6 md:px-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">追蹤清單</h1>
        <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted">
          追蹤標的的價格、最新月營收與近五日外資買賣超。
          基本面出現變化時（月營收年增轉負、負債比走高）會在此優先呈現。
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-xs">
          <thead>
            <tr className="th-sticky border-b border-border text-left text-faint">
              <th scope="col" className="py-2 pr-3 font-medium">代號</th>
              <th scope="col" className="py-2 pr-3 font-medium">名稱</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">收盤</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">漲跌幅</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">本益比</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">ROE</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">最新月營收 YoY</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">外資 5 日</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">分數</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">近 60 日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map(({ company, metrics, latestMonth, foreignNet, score }) => (
              <tr
                key={company.stockId}
                className="h-8 transition-colors hover:bg-surface"
              >
                <td className="num py-1 pr-3">
                  <Link
                    href={`/stock/${company.stockId}`}
                    className="text-accent hover:underline"
                  >
                    {company.stockId}
                  </Link>
                </td>
                <td className="py-1 pr-3 text-text">{company.companyName}</td>
                <td className="num py-1 pr-3 text-right">{formatPrice(metrics.price)}</td>
                <td className="py-1 pr-3 text-right">
                  <DeltaValue value={metrics.changePct} arrow />
                </td>
                <td className="num py-1 pr-3 text-right text-muted">
                  {formatPrice(metrics.pe, 1)}x
                </td>
                <td className="num py-1 pr-3 text-right text-muted">
                  {formatPct(metrics.roe, 1, false)}
                </td>
                <td className="py-1 pr-3 text-right">
                  {latestMonth ? (
                    <DeltaValue value={latestMonth.yoy} digits={1} />
                  ) : (
                    <span className="num text-faint">—</span>
                  )}
                </td>
                <td className="py-1 pr-3 text-right">
                  <span
                    className={
                      foreignNet > 0
                        ? "num text-up"
                        : foreignNet < 0
                          ? "num text-down"
                          : "num text-flat"
                    }
                  >
                    {formatNetLots(foreignNet)}
                  </span>
                </td>
                <td className="num py-1 pr-3 text-right">{score}</td>
                <td className="py-1 pl-3">
                  <div className="flex justify-end">
                    <Sparkline
                      data={getCloseSeries(company.stockId, 60)}
                      trend={metrics.changePct}
                      width={68}
                      height={18}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Disclaimer variant="inline" className="mt-6" />
    </div>
  );
}
