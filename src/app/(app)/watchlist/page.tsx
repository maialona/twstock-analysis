import type { Metadata } from "next";
import {
  WatchlistTable,
  type WatchRow,
} from "@/components/watchlist/WatchlistTable";
import { Disclaimer } from "@/components/ui/Disclaimer";
import { COMPANIES, METRICS_BY_ID } from "@/lib/data/companies";
import { getCloseSeries, getInstitutionalFlow } from "@/lib/data/prices";
import { getMonthlyRevenue } from "@/lib/data/financials";
import { getScore } from "@/lib/data/scoring";

export const metadata: Metadata = { title: "追蹤清單" };

/**
 * 追蹤哪幾檔存在 localStorage，只有 client 知道；
 * 但每一檔的欄位值不必因此搬到 client 算。
 * 這裡先把整個收錄範圍（12 檔）算好，由 WatchlistTable 依偏好挑出要顯示的列。
 * 12 檔的量級下，多算幾筆遠比把整個 mock 資料層打包進 client bundle 划算。
 */
function buildRows(): WatchRow[] {
  return COMPANIES.map((company) => {
    const id = company.stockId;
    const metrics = METRICS_BY_ID.get(id)!;
    const monthly = getMonthlyRevenue(id);
    const flows = getInstitutionalFlow(id, 5);
    return {
      stockId: id,
      companyName: company.companyName,
      price: metrics.price,
      changePct: metrics.changePct,
      pe: metrics.pe,
      roe: metrics.roe,
      monthlyYoy: monthly[monthly.length - 1]?.yoy ?? null,
      foreignNet: flows.reduce((s, f) => s + f.foreign, 0),
      score: getScore(id)?.total ?? 0,
      spark: getCloseSeries(id, 60),
    };
  });
}

export default function WatchlistPage() {
  return (
    <div className="density-hi px-4 py-6 md:px-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">追蹤清單</h1>
        <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted">
          追蹤標的的價格、最新月營收與近五日外資買賣超。
          基本面出現變化時（月營收年增轉負、負債比走高）會在此優先呈現。
        </p>
      </header>

      <WatchlistTable rows={buildRows()} />

      <Disclaimer variant="inline" className="mt-6" />
    </div>
  );
}
