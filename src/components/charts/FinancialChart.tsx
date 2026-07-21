"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyRevenue } from "@/lib/schema";
import type { DerivedPoint } from "@/lib/data/financials";
import { CHART_COLORS, formatTWD } from "@/lib/format";

const AXIS = {
  stroke: CHART_COLORS.axis,
  fontSize: 10,
  fontFamily: "var(--font-geist-mono), monospace",
};

const TOOLTIP_STYLE = {
  background: "#1b1b1f",
  border: "1px solid #3f3f46",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "var(--font-geist-mono), monospace",
  padding: "6px 10px",
};

/**
 * Recharts 3 的 Formatter 型別把 value 標為 ValueType | undefined。
 * 這個 wrapper 把它收斂成 number，讓各圖表的 formatter 保持可讀。
 */
function fmt(fn: (value: number, name: string) => [string, string]) {
  return (value: unknown, name: unknown): [string, string] =>
    fn(Number(value ?? 0), String(name ?? ""));
}

/* ── 季度指標趨勢（ROE / 毛利率 / 營益率 / 淨利率）─────── */

const SERIES_META = {
  roe: { label: "ROE", color: CHART_COLORS.accent },
  grossMargin: { label: "毛利率", color: "#a1a1aa" },
  operatingMargin: { label: "營益率", color: "#71717a" },
  netMargin: { label: "淨利率", color: "#52525b" },
} as const;

export function MarginTrendChart({ data }: { data: DerivedPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
          width={44}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: CHART_COLORS.text }}
          formatter={fmt((v, name) => [
            `${v}%`,
            SERIES_META[name as keyof typeof SERIES_META]?.label ?? name,
          ])}
          cursor={{ stroke: CHART_COLORS.axis, strokeDasharray: "3 3" }}
        />
        {(Object.keys(SERIES_META) as Array<keyof typeof SERIES_META>).map((k) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            stroke={SERIES_META[k].color}
            strokeWidth={k === "roe" ? 2 : 1.25}
            dot={false}
            activeDot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── EPS 季度柱狀 ────────────────────────────────────── */

export function EpsChart({ data }: { data: DerivedPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: CHART_COLORS.text }}
          formatter={fmt((v) => [`${v} 元`, "EPS"])}
          cursor={{ fill: "#ffffff08" }}
        />
        <Bar dataKey="eps" radius={[2, 2, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.eps >= 0 ? CHART_COLORS.accent : CHART_COLORS.down}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── 月營收 + YoY ────────────────────────────────────── */

export function MonthlyRevenueChart({ data }: { data: MonthlyRevenue[] }) {
  const chartData = data.map((d) => ({
    label: d.month.slice(2).replace("-", "/"),
    revenue: d.revenue / 1e8, // 億元
    yoy: d.yoy,
  }));

  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(v) => `${Math.round(v)}`}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: CHART_COLORS.text }}
          formatter={fmt((v, name) =>
            name === "revenue"
              ? [`${v.toFixed(1)} 億`, "月營收"]
              : [`${v}%`, "年增率"],
          )}
          cursor={{ fill: "#ffffff08" }}
        />
        {/* 柱體依 YoY 正負上色 — 紅為成長、綠為衰退（台股慣例） */}
        <Bar dataKey="revenue" radius={[2, 2, 0, 0]}>
          {chartData.map((d, i) => (
            <Cell
              key={i}
              fill={d.yoy > 0 ? CHART_COLORS.up : d.yoy < 0 ? CHART_COLORS.down : CHART_COLORS.flat}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ── 現金流 ──────────────────────────────────────────── */

export function CashFlowChart({
  data,
}: {
  data: Array<{ label: string; ocf: number; capex: number; fcf: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -6 }}>
        <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v) => `${Math.round(v / 1e8)}`}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={{ color: CHART_COLORS.text }}
          formatter={fmt((v, name) => [
            formatTWD(v),
            name === "ocf" ? "營業現金流" : name === "capex" ? "資本支出" : "自由現金流",
          ])}
          cursor={{ fill: "#ffffff08" }}
        />
        <Bar dataKey="ocf" fill={CHART_COLORS.accent} fillOpacity={0.8} radius={[2, 2, 0, 0]} />
        <Bar dataKey="capex" fill="#52525b" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
