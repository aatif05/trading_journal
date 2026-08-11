"use client";

import {
  Activity,
  ChartNoAxesCombined,
  CircleDollarSign,
  Flame,
  Gauge,
  IndianRupee,
  ListChecks,
  ShieldCheck,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { formatCurrency, formatPercent, PortfolioMetrics, TradeMetric } from "@/lib/trades";

type Card = {
  label: string;
  value: string;
  detail?: string;
  tone?: "green" | "amber" | "red" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
};

const tones = {
  green: "text-[#15955f]",
  amber: "text-[#dc8a08]",
  red: "text-[#e14f69]",
  neutral: "text-[#17201b]",
};

function detailFor(label: string, rows: TradeMetric[], metrics: PortfolioMetrics) {
  if (label === "Gross realized P/L") {
    return rows
      .filter((row) => row.positionStatus === "Closed" && row.realized !== 0)
      .sort((a, b) => Math.abs(b.realized) - Math.abs(a.realized))
      .slice(0, 5)
      .map((row) => `${row.name || "Unnamed"} · ${formatCurrency(row.realized, 0)}`);
  }
  if (label === "% invested") {
    return rows
      .filter((row) => row.invested > 0)
      .sort((a, b) => b.invested - a.invested)
      .slice(0, 5)
      .map((row) => `${row.name || "Unnamed"} · ${formatPercent(row.currentAllocation)}`);
  }
  if (label === "Win rate") {
    const closed = rows.filter((row) => row.positionStatus === "Closed");
    const wins = closed.filter((row) => row.grossPL > 0).length;
    return [`${wins} winning trades`, `${closed.length - wins} losing trades`, `${closed.length} closed trades`];
  }
  if (label === "Open positions") {
    return rows.filter((row) => row.positionStatus !== "Closed").slice(0, 5).map((row) => `${row.name || "Unnamed"} · ${formatCurrency(row.unrealized, 0)}`);
  }
  if (label === "Capital at risk") {
    return rows.filter((row) => row.positionStatus !== "Closed" && row.capitalAtRisk > 0).sort((a, b) => b.capitalAtRisk - a.capitalAtRisk).slice(0, 5).map((row) => `${row.name || "Unnamed"} · ${formatCurrency(row.capitalAtRisk, 0)}`);
  }
  if (label === "Unrealized P/L") return [`Open P/L ${formatCurrency(metrics.unrealizedPL, 0)}`, `${rows.filter((row) => row.positionStatus !== "Closed").length} active positions`];
  if (label === "Profit protected") return [`Protected ${formatCurrency(metrics.profitProtected, 0)}`, `${formatPercent(metrics.profitProtectedPercent)} of capital`];
  if (label === "Gross PF impact % (all-time)") return [`Realized impact ${formatPercent(metrics.grossImpact)}`, `${formatCurrency(metrics.realizedPL, 0)} realized`];
  if (label === "Current DD (pre-tax)") return [`Drawdown ${formatPercent(metrics.currentDrawdown)}`, "Based on current portfolio value"];
  if (label === "Profit risk") return [`Risk ${formatPercent(metrics.capitalAtRiskPercent)}`, `${formatCurrency(metrics.capitalAtRisk, 0)} open heat`];
  return [`${metrics.totalTrades} trades recorded`, "Select another card for a breakdown"];
}

export function KpiGrid({ metrics, rows = [] }: { metrics: PortfolioMetrics; rows?: TradeMetric[] }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const cards: Card[] = [
    { label: "Total trades", value: String(metrics.totalTrades), icon: ListChecks, items: detailFor("Total trades", rows, metrics) },
    { label: "Open positions", value: String(metrics.openPositions), tone: "amber", icon: Activity, items: detailFor("Open positions", rows, metrics) },
    { label: "Win rate", value: formatPercent(metrics.winRate), tone: "green", icon: Target, items: detailFor("Win rate", rows, metrics) },
    { label: "Gross realized P/L", value: formatCurrency(metrics.realizedPL, 0), tone: metrics.realizedPL < 0 ? "red" : "green", icon: IndianRupee, items: detailFor("Gross realized P/L", rows, metrics) },
    { label: "Unrealized P/L", value: formatCurrency(metrics.unrealizedPL), detail: `${formatPercent(metrics.unrealizedPercent)} of pf`, tone: metrics.unrealizedPL < 0 ? "red" : "green", icon: TrendingUp, items: detailFor("Unrealized P/L", rows, metrics) },
    { label: "Capital at risk", value: formatPercent(metrics.capitalAtRiskPercent), detail: formatCurrency(metrics.capitalAtRisk, 0), tone: "red", icon: Flame, items: detailFor("Capital at risk", rows, metrics) },
    { label: "Profit risk", value: formatPercent(metrics.capitalAtRiskPercent), tone: "amber", icon: Gauge, items: detailFor("Profit risk", rows, metrics) },
    { label: "Profit protected", value: formatCurrency(metrics.profitProtected, 0), detail: `${formatPercent(metrics.profitProtectedPercent)} of pf`, tone: "green", icon: ShieldCheck, items: detailFor("Profit protected", rows, metrics) },
    { label: "% invested", value: formatPercent(metrics.investedPercent), detail: formatCurrency(metrics.invested), icon: WalletCards, items: detailFor("% invested", rows, metrics) },
    { label: "Gross PF impact % (all-time)", value: formatPercent(metrics.grossImpact), tone: metrics.grossImpact < 0 ? "red" : "green", icon: ChartNoAxesCombined, items: detailFor("Gross PF impact % (all-time)", rows, metrics) },
    { label: "Current DD (pre-tax)", value: formatPercent(metrics.currentDrawdown), tone: metrics.currentDrawdown < 0 ? "red" : "green", icon: CircleDollarSign, items: detailFor("Current DD (pre-tax)", rows, metrics) },
  ];

  return (
    <section aria-label="Portfolio summary" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, value, detail, tone = "neutral", icon: Icon, items }) => (
        <div key={label} className="relative">
          <button type="button" onClick={() => setOpenLabel(openLabel === label ? null : label)} className="block w-full rounded-2xl border border-[#e8ebe9] bg-white p-3.5 text-left shadow-[0_1px_3px_rgba(20,40,30,0.04)] transition hover:border-[#bfd6c8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8bc8aa]">
            <div className="flex items-start justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.045em] text-[#89918c]">{label}</p><span className="rounded-full bg-[#f5f7f6] p-1.5 text-[#a9b1ac]"><Icon className="h-3.5 w-3.5" /></span></div>
            <div className="mt-2 flex flex-wrap items-baseline gap-1.5"><p className={`text-[17px] font-bold tabular-nums ${tones[tone]}`}>{value}</p>{detail && <p className="text-[9px] text-[#929a95]">({detail})</p>}</div>
          </button>
          {openLabel === label && <div role="dialog" aria-label={`${label} details`} className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 rounded-2xl border border-[#cbdced] bg-white p-4 shadow-[0_14px_34px_rgba(22,35,28,0.14)]"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#89918c]">Quick look</p><ul className="mt-2 flex flex-col gap-2 text-xs text-[#4e5952]">{items.map((item) => <li key={item} className="border-b border-[#eef1ef] pb-2 last:border-0 last:pb-0">{item}</li>)}</ul></div>}
        </div>
      ))}
    </section>
  );
}
