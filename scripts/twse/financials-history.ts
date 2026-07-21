/**
 * 逐季財報歷史 → 真實的季度趨勢與現金流。
 *
 * 快照層（snapshot.ts）只拿得到「最新一季」；要畫季度趨勢、算真實的
 * 自由現金流與 EPS 五年 CAGR，得逐檔逐季查 MOPS 的財務報表本體。
 *
 * 來源：mopsov.twse.com.tw（classic mops.twse.com.tw 已被安全機制擋，
 * 只有這個舊鏡像可用，且必須帶 Referer，否則回「FOR SECURITY REASONS」）。
 *   ajax_t164sb04  綜合損益表（累計）
 *   ajax_t164sb05  現金流量表（累計）
 *   ajax_t164sb03  資產負債表（期末時點，非累計）
 *
 * ── 累計相減的坑（務必看懂再改）────────────────────────────
 * 損益表與現金流量表給的是「年初至今累計」數，畫單季要逐季相減：
 *   單季_Qn = 累計_Qn − 累計_Q(n-1)，Q1 累計即單季。
 * 而 Q2／Q3 的頁面比 Q1／Q4 多一個「第N季(三個月)」欄擠在累計欄前面，
 * 用固定欄位 index 解析會靜默抓到單季當累計，相減後整條趨勢全錯卻看起來合理。
 * 因此一律靠表頭「MM月01日至」認出「本年累計」欄，見 cumulativeColIndex()。
 * 資產負債表是期末時點，不累計、不相減。
 */

import { num, sleep } from "./client.ts";

const MOPS = "https://mopsov.twse.com.tw/mops/web";
/**
 * MOPS 連續請求的間隔。實測連打數十次後會開始回 307（導向反爬蟲頁）；
 * 間隔拉到 1.5s 給多一點餘裕，被擋時再靠長退避把那陣子的限流等過去。
 */
const THROTTLE_MS = 1500;
let lastCall = 0;

async function throttle(): Promise<void> {
  const since = Date.now() - lastCall;
  if (since < THROTTLE_MS) await sleep(THROTTLE_MS - since);
  lastCall = Date.now();
}

type StatementKind = "sb03" | "sb04" | "sb05";
export type ReportType = "general" | "financialHolding";

/**
 * 金控是控股公司，t164 查詢預設回子公司清單頁（step=1）；合併報表要 step=2
 * 才會實際回表（等同 picker 上按「詳細資料」）。一般業維持 step=1。
 */
const stepFor = (t: ReportType): string => (t === "financialHolding" ? "2" : "1");

async function fetchStatement(
  kind: StatementKind,
  coId: string,
  rocYear: number,
  season: string,
  step: string,
  retries = 5,
): Promise<string> {
  const ep = `ajax_t164${kind}`;
  const body = new URLSearchParams({
    encodeURIComponent: "1",
    step,
    firstin: "1",
    off: "1",
    queryName: "co_id",
    inpuType: "co_id",
    TYPEK: "all",
    isnew: "false",
    co_id: coId,
    year: String(rocYear),
    season,
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle();
    try {
      const res = await fetch(`${MOPS}/${ep}`, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          // 不帶 Referer 會被安全機制擋下（回 SECURITY REASONS 頁）
          referer: `${MOPS}/t164${kind}`,
          "user-agent": "twstock-analysis/0.1 (data collector)",
        },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      if (html.includes("SECURITY REASONS")) throw new Error("被安全機制擋下");
      if (!html.includes("會計項目") && !html.includes("查無")) {
        throw new Error("非預期回應（無財報表頭）");
      }
      return html;
    } catch (err) {
      if (attempt === retries) {
        throw new Error(
          `取得財報失敗 ${ep} ${coId} ${rocYear}Q${season}\n  ${(err as Error).message}`,
        );
      }
      // 被限流（307）之後馬上重試只會再被擋；退避拉長，把那陣子的封鎖等過去
      await sleep(3000 * (attempt + 1));
    }
  }
  throw new Error("unreachable");
}

/* ── HTML 解析 ─────────────────────────────────────────── */

function cells(row: string): string[] {
  return [...row.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/ /g, " ").trim(),
  );
}

function rowsOf(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map((m) => cells(m[1]));
}

/**
 * 回傳「本年累計」值欄在資料列中的欄位 index。
 * 表頭列以「會計項目」開頭，其後每個期間佔資料列 2 欄（值、百分比）。
 * 本年累計欄的表頭含「MM月01日至…」的日期區間（例：113年01月01日至113年06月30日）；
 * 而「第N季」是三個月單季欄，不能拿。Q1／Q4 只有單一期間，它本身就是累計。
 */
function cumulativeColIndex(html: string): number {
  for (const c of rowsOf(html)) {
    if (c[0] === "會計項目") {
      const periods = c.slice(1);
      for (let i = 0; i < periods.length; i++) {
        if (/01日至/.test(periods[i])) return 1 + i * 2;
      }
      return 1; // Q1／Q4：單一期間即累計
    }
  }
  throw new Error("找不到財報表頭（會計項目）");
}

/** 取某會計項目在「本年累計」欄的數值；標籤有多個別名時取第一個命中。 */
function cumValue(html: string, labels: string[], colIndex: number): number | null {
  for (const c of rowsOf(html)) {
    if (labels.includes(c[0])) {
      const v = num(c[colIndex]);
      if (v !== null) return v;
    }
  }
  return null;
}

/* ── 會計項目標籤（一般業）───────────────────────────────── */

const IS_LABELS = {
  revenue: ["營業收入合計", "營業收入"],
  grossProfit: ["營業毛利（毛損）淨額", "營業毛利（毛損）"],
  operatingIncome: ["營業利益（損失）"],
  // 金控合併損益表沒有「營業收入」，稅後淨利的欄名也不同
  netIncome: ["本期淨利（淨損）", "本期稅後淨利（淨損）"],
  eps: ["基本每股盈餘"],
};
const CF_LABELS = {
  operatingCashFlow: ["營業活動之淨現金流入（流出）", "營業活動之淨現金流入"],
  capex: ["取得不動產、廠房及設備"],
};
const BS_LABELS = {
  asset: ["資產總額", "資產總計"],
  liability: ["負債總額", "負債總計"],
  equity: ["權益總額", "權益總計"],
};

/* ── 逐季抓取與相減 ───────────────────────────────────────── */

/** 一季的累計原始值（尚未相減）。資產負債為期末時點、不參與相減。 */
type CumQuarter = {
  year: number; // 西元
  quarter: number;
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  netIncome: number | null;
  eps: number | null;
  operatingCashFlow: number | null;
  capex: number | null; // 累計，帶號（流出為負）
  asset: number | null;
  liability: number | null;
  equity: number | null;
};

export type QuarterlyFinancial = {
  stockId: string;
  year: number;
  quarter: number;
  // 金控合併損益表沒有營收與利潤結構，也不畫現金流 —— 這些對金控為 null
  revenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  operatingCashFlow: number | null;
  capex: number | null; // 正值（單季資本支出金額）
  // 損益核心與資產負債金控與一般業都有
  netIncome: number;
  eps: number;
  equity: number;
  asset: number;
  liability: number;
};

const season = (q: number): string => String(q).padStart(2, "0");

async function fetchCumQuarter(
  coId: string,
  year: number,
  quarter: number,
  reportType: ReportType,
): Promise<CumQuarter> {
  const rocYear = year - 1911;
  const s = season(quarter);
  const step = stepFor(reportType);
  const isFh = reportType === "financialHolding";

  const isHtml = await fetchStatement("sb04", coId, rocYear, s, step);
  const bsHtml = await fetchStatement("sb03", coId, rocYear, s, step);
  // 金控不畫現金流（銀行的營業現金流由存放款主導，與「營業CF vs capex」的敘事不同），
  // 少抓一張表也省請求
  const cfHtml = isFh ? null : await fetchStatement("sb05", coId, rocYear, s, step);

  const isCol = cumulativeColIndex(isHtml);
  const bsCol = cumulativeColIndex(bsHtml);
  const cfCol = cfHtml ? cumulativeColIndex(cfHtml) : 0;

  return {
    year,
    quarter,
    revenue: cumValue(isHtml, IS_LABELS.revenue, isCol),
    grossProfit: cumValue(isHtml, IS_LABELS.grossProfit, isCol),
    operatingIncome: cumValue(isHtml, IS_LABELS.operatingIncome, isCol),
    netIncome: cumValue(isHtml, IS_LABELS.netIncome, isCol),
    eps: cumValue(isHtml, IS_LABELS.eps, isCol),
    operatingCashFlow: cfHtml ? cumValue(cfHtml, CF_LABELS.operatingCashFlow, cfCol) : null,
    capex: cfHtml ? cumValue(cfHtml, CF_LABELS.capex, cfCol) : null,
    asset: cumValue(bsHtml, BS_LABELS.asset, bsCol),
    liability: cumValue(bsHtml, BS_LABELS.liability, bsCol),
    equity: cumValue(bsHtml, BS_LABELS.equity, bsCol),
  };
}

/** 累計 → 單季：損益與現金流相減，資產負債直接沿用期末值。 */
function decumulate(cum: CumQuarter[]): QuarterlyFinancial[] {
  const byYear = new Map<number, Map<number, CumQuarter>>();
  for (const c of cum) {
    let m = byYear.get(c.year);
    if (!m) byYear.set(c.year, (m = new Map()));
    m.set(c.quarter, c);
  }

  const out: QuarterlyFinancial[] = [];
  const flow = (
    cur: number | null,
    prev: CumQuarter | undefined,
    key: "revenue" | "grossProfit" | "operatingIncome" | "netIncome" | "eps" | "operatingCashFlow" | "capex",
  ): number | null => {
    if (cur === null) return null;
    if (!prev) return cur; // Q1：累計即單季
    const p = prev[key];
    return p === null ? null : cur - p;
  };

  for (const [year, quarters] of byYear) {
    for (const [q, c] of quarters) {
      const prev = q > 1 ? quarters.get(q - 1) : undefined;
      // Q2 以上但缺前一季 → 無法相減，跳過而不是輸出錯的單季
      if (q > 1 && !prev) continue;

      const revenue = flow(c.revenue, prev, "revenue");
      const grossProfit = flow(c.grossProfit, prev, "grossProfit");
      const operatingIncome = flow(c.operatingIncome, prev, "operatingIncome");
      const netIncome = flow(c.netIncome, prev, "netIncome");
      const eps = flow(c.eps, prev, "eps");
      const ocf = flow(c.operatingCashFlow, prev, "operatingCashFlow");
      const capexSigned = flow(c.capex, prev, "capex");

      // 金控與一般業共通的核心欄位缺一不可；缺就整季跳過。
      // 營收／利潤結構／現金流是「一般業有、金控沒有」，允許為 null。
      if (
        netIncome === null || eps === null ||
        c.asset === null || c.liability === null || c.equity === null
      ) {
        continue;
      }

      // MOPS 財報數字以「仟元」計，全站金額一律用「元」（月營收、市值皆然），
      // 統一在此換算，讓 quarterly.json 與 metrics.fcf 直接可餵給 formatTWD / 圖表。
      // EPS 是每股元、非總額，不換算。
      const K = 1000;
      const kOrNull = (n: number | null): number | null =>
        n === null ? null : Math.round(n) * K;
      out.push({
        stockId: "", // 由呼叫端填
        year,
        quarter: q,
        revenue: kOrNull(revenue),
        grossProfit: kOrNull(grossProfit),
        operatingIncome: kOrNull(operatingIncome),
        netIncome: Math.round(netIncome) * K,
        eps: Math.round(eps * 100) / 100,
        equity: Math.round(c.equity) * K,
        asset: Math.round(c.asset) * K,
        liability: Math.round(c.liability) * K,
        operatingCashFlow: kOrNull(ocf),
        capex: capexSigned === null ? null : Math.abs(Math.round(capexSigned)) * K,
      });
    }
  }

  out.sort((a, b) => a.year - b.year || a.quarter - b.quarter);
  return out;
}

/**
 * 抓某檔近 count 季的真實逐季財報。
 * 以「最新可得季」為錨往回，補足整個會計年度以利年內相減，最後取近 count 季。
 */
export async function fetchQuarterlyHistory(
  stockId: string,
  latest: { year: number; quarter: number },
  count: number,
  reportType: ReportType = "general",
): Promise<QuarterlyFinancial[]> {
  // 需要幾個完整年度才涵蓋 count 季（+1 保險，讓年初的 Q 也有前一季可減）
  const yearsBack = Math.ceil((count + latest.quarter) / 4);
  const cum: CumQuarter[] = [];
  for (let year = latest.year; year > latest.year - yearsBack; year--) {
    for (let q = 4; q >= 1; q--) {
      // 跳過尚未公布的未來季
      if (year === latest.year && q > latest.quarter) continue;
      cum.push(await fetchCumQuarter(stockId, year, q, reportType));
    }
  }
  const single = decumulate(cum).map((s) => ({ ...s, stockId }));
  return single.slice(-count);
}

/* ── EPS 五年 CAGR ────────────────────────────────────────── */

/** 抓某年度的全年 EPS（Q4 累計即全年），拿不到回 null。 */
export async function fetchAnnualEps(
  coId: string,
  year: number,
  reportType: ReportType = "general",
): Promise<number | null> {
  try {
    const html = await fetchStatement("sb04", coId, year - 1911, "04", stepFor(reportType));
    return cumValue(html, IS_LABELS.eps, cumulativeColIndex(html));
  } catch {
    return null;
  }
}

/**
 * EPS 五年 CAGR。以最新「完整會計年度」與其前五年的全年 EPS 計算。
 * 任一端拿不到、或起點非正（無法取幾何成長率）→ null，不硬湊。
 */
export async function fetchEpsCagr5y(
  stockId: string,
  latest: { year: number; quarter: number },
  reportType: ReportType = "general",
): Promise<number | null> {
  const baseFY = latest.quarter === 4 ? latest.year : latest.year - 1;
  const [endEps, startEps] = [
    await fetchAnnualEps(stockId, baseFY, reportType),
    await fetchAnnualEps(stockId, baseFY - 5, reportType),
  ];
  if (endEps === null || startEps === null || startEps <= 0 || endEps <= 0) {
    return null;
  }
  const cagr = ((endEps / startEps) ** (1 / 5) - 1) * 100;
  return Math.round(cagr * 10) / 10;
}
