import Link from "next/link";
import { EmptyState } from "@/components/ui/states";
import { COMPANIES } from "@/lib/data/companies";

export default function StockNotFound() {
  return (
    <div className="density-md px-4 py-6 md:px-8">
      <EmptyState
        title="找不到這檔個股"
        description="目前的資料庫涵蓋範圍有限，僅收錄下列標的。輸入正確的四位數代號，或直接從清單中選擇。"
        action={
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {COMPANIES.map((c) => (
              <li key={c.stockId}>
                <Link
                  href={`/stock/${c.stockId}`}
                  className="num inline-block rounded border border-border px-2 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-text"
                >
                  {c.stockId}
                </Link>
              </li>
            ))}
          </ul>
        }
      />
    </div>
  );
}
