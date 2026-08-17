"use client";

import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarDays, ChevronDown, Info, SlidersHorizontal } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useTrades } from "@/hooks/use-trades";
import { useCapitalFlows } from "@/hooks/use-capital-flows";
import { calculateAnalytics, calculatePerformanceSeries, calculateTopPerformers } from "@/lib/analytics";
import { calculateCurrentCapital } from "@/lib/fund-management";
import { formatCurrency, formatPercent } from "@/lib/trades";

const metricItems = [
  ["Total trades", (m: ReturnType<typeof calculateAnalytics>) => m.totalTrades.toString()],
  ["Win rate", (m: ReturnType<typeof calculateAnalytics>) => formatPercent(m.winRate)],
  ["Average gain", (m: ReturnType<typeof calculateAnalytics>) => formatPercent(m.avgGain)],
  ["Average loss", (m: ReturnType<typeof calculateAnalytics>) => formatPercent(m.avgLoss)],
  ["Average position size", (m: ReturnType<typeof calculateAnalytics>) => formatPercent(m.investedPercent)],
  ["Average holding days", (m: ReturnType<typeof calculateAnalytics>) => m.avgHoldingDays.toFixed(1)],
  ["Profit factor", (m: ReturnType<typeof calculateAnalytics>) => Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : "∞"],
  ["Expectancy", (m: ReturnType<typeof calculateAnalytics>) => formatCurrency(m.expectancy)],
  ["Open positions", (m: ReturnType<typeof calculateAnalytics>) => m.openPositions.toString()],
  ["Capital at risk", (m: ReturnType<typeof calculateAnalytics>) => formatCurrency(m.capitalAtRisk)],
] as const;

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-[#e8ebe9] bg-white ${className}`}>
      <div className="flex items-center justify-between border-b border-[#edf0ee] px-6 py-5">
        <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#202421]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function AnalyticsDashboard() {
  const { trades, hydrated: tradesHydrated } = useTrades();
  const { flows, hydrated: flowsHydrated } = useCapitalFlows();
  const [range, setRange] = useState("All time");
  const [mode, setMode] = useState<"growth" | "pnl">("growth");

  const filteredTrades = useMemo(() => {
    if (range === "All time") return trades;
    const year = new Date().getFullYear();
    return trades.filter((trade) => new Date(`${trade.date}T00:00:00`).getFullYear() === year);
  }, [range, trades]);
  const capital = useMemo(() => calculateCurrentCapital(filteredTrades, flows), [filteredTrades, flows]);
  const metrics = useMemo(() => calculateAnalytics(filteredTrades, flows, capital), [filteredTrades, flows, capital]);
  const series = useMemo(() => calculatePerformanceSeries(filteredTrades, flows, capital), [filteredTrades, flows, capital]);
  const performers = useMemo(() => calculateTopPerformers(filteredTrades), [filteredTrades]);
  const chartData = series.map((point) => ({ ...point, label: new Date(`${point.date}T00:00:00`).toLocaleDateString("en-IN", { month: "short", day: "numeric" }), value: mode === "growth" ? point.cumulativePnLPercent : point.cumulativePnL }));
  const positive = metrics.grossImpact >= 0;

  if (!tradesHydrated || !flowsHydrated) return <main className="min-h-screen bg-[#fbfcfb]" />;

  return (
    <main className="min-h-screen bg-[#fbfcfb] px-4 pb-28 pt-8 text-[#202421] sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#87908a]">Performance workspace</p>
            <h1 className="text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">Analytics</h1>
            <p className="mt-2 text-sm text-[#737b76]">A clear view of your trading performance.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="flex items-center gap-2 rounded-full border border-[#e8ebe9] bg-white px-4 py-2.5 text-sm font-medium shadow-sm">
              <SlidersHorizontal className="size-4" /> Customize dashboard
            </button>
            <button type="button" onClick={() => setRange(range === "All time" ? "This year" : "All time")} className="flex items-center gap-2 rounded-full border border-[#e8ebe9] bg-white px-4 py-2.5 text-sm font-medium shadow-sm">
              <CalendarDays className="size-4" /> {range} <ChevronDown className="size-4" />
            </button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_1.15fr_0.92fr]">
          <Panel title="Performance metrics">
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 p-6 sm:p-8">
              {metricItems.map(([label, getValue]) => (
                <div key={label}>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#929a95]">{label}</p>
                  <p className="mt-2 text-2xl font-medium tracking-[-0.04em] text-[#202421]">{getValue(metrics)}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Portfolio performance" className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${positive ? "bg-[#d9f7e6] text-[#008a52]" : "bg-[#ffe3e3] text-[#d63b3b]"}`}>
                  {positive ? <ArrowUpRight className="mr-1 inline size-4" /> : <ArrowDownRight className="mr-1 inline size-4" />}{formatPercent(metrics.grossImpact)}
                </span>
                <span className="text-sm text-[#818983]">All time</span>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-[#e4e8e5] text-xs font-medium">
                <button type="button" onClick={() => setMode("growth")} className={`px-3 py-2 ${mode === "growth" ? "bg-[#e9eeeb] text-[#202421]" : "bg-white text-[#8a938d]"}`}>Growth</button>
                <button type="button" onClick={() => setMode("pnl")} className={`px-3 py-2 ${mode === "pnl" ? "bg-[#e9eeeb] text-[#202421]" : "bg-white text-[#8a938d]"}`}>P&L</button>
              </div>
            </div>
            <div className="h-[360px] px-2 pb-5 sm:h-[430px] sm:px-4">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 12, left: 0, bottom: 8 }}>
                    <defs><linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2aa765" stopOpacity={0.24} /><stop offset="100%" stopColor="#2aa765" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid stroke="#e7ebe8" strokeDasharray="4 5" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#929a95", fontSize: 12 }} minTickGap={28} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fill: "#929a95", fontSize: 12 }} tickFormatter={(value) => mode === "growth" ? `${value}%` : `${Math.round(value)}`} width={48} />
                    <Tooltip contentStyle={{ borderRadius: 14, border: "1px solid #e8ebe9", boxShadow: "0 8px 24px rgba(32,36,33,.08)" }} formatter={(value) => [mode === "growth" ? `${Number(value).toFixed(2)}%` : formatCurrency(Number(value)), mode === "growth" ? "Growth" : "P&L"]} />
                    <Area type="monotone" dataKey="value" stroke="#16a35a" strokeWidth={3} fill="url(#analyticsFill)" dot={{ r: 3, fill: "#16a35a", strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-sm text-[#8b948e]">Close trades to build your performance curve.</div>}
            </div>
          </Panel>

          <Panel title="Top performers" className="overflow-hidden">
            <div className="flex flex-col gap-2 p-4 sm:p-5">
              {performers.length ? performers.map((performer, index) => {
                const isPositive = performer.gain >= 0;
                return (
                  <article key={`${performer.name}-${performer.date}`} className="flex items-center gap-3 rounded-2xl border border-[#edf0ee] bg-[#fcfdfc] p-3 transition-colors hover:bg-[#f7faf8]">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#edf7f1] text-xs font-bold text-[#4d8d69]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#202421]">{performer.name || "Unnamed trade"}</p>
                      <p className="mt-1 truncate text-xs text-[#8a938d]">{performer.date || "No date"} · {performer.side}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold tabular-nums ${isPositive ? "text-[#00945a]" : "text-[#e33d48]"}`}>{isPositive ? "+" : ""}{formatPercent(performer.gainPercent)}</p>
                      <p className="mt-1 text-[11px] text-[#8a938d]">Impact {formatPercent(performer.impact)}</p>
                    </div>
                  </article>
                );
              }) : <div className="rounded-2xl bg-[#f6f8f6] p-5 text-sm leading-6 text-[#7b847e]">Your top performers will appear after you record closed trades.</div>}
            </div>
          </Panel>
        </div>

        <div className="flex items-center gap-2 text-xs text-[#8b948e]"><Info className="size-4" /> Analytics use closed-trade results and your recorded capital flows.</div>
      </div>
      <BottomNav />
    </main>
  );
}

export { formatCurrency };
