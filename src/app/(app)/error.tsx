"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 之後接上錯誤追蹤服務時，這裡送出 error.digest
    console.error(error);
  }, [error]);

  return (
    <div className="px-4 py-10 md:px-8">
      <ErrorState
        title="這個頁面的資料載入失敗"
        description="可能是資料來源暫時無回應。重新載入通常可以解決；若持續發生，代表該標的的資料尚未同步完成。"
        onRetry={reset}
      />
    </div>
  );
}
