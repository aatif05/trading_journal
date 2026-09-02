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
  if (label === "Unrealized P/L") {
    return rows
      .filter((row) => row.positionStatus !== "Closed")
      .sort((a, b) => Math.abs(b.unrealized) - Math.abs(a.unrealized))
      .slice(0, 5)
      .map((row) => `${row.name || "Unnamed"} · ${formatCurrency(row.unrealized, 0)} (${formatPercent(row.portfolioImpact)})`);
  }
  if (label === "Profit protected") {
    return rows
      .filter((row) => row.positionStatus !== "Closed" && row.profitProtected > 0)
      .sort((a, b) => b.profitProtected - a.profitProtected)
      .slice(0, 5)
      .map((row) => `${row.name || "Unnamed"} · ${formatCurrency(row.profitProtected, 0)}`);
  }
  if (label === "Gross PF impact % (all-time)") {
    return rows
      .filter((row) => row.positionStatus === "Closed" && row.realized !== 0)
      .sort((a, b) => Math.abs(b.portfolioImpact) - Math.abs(a.portfolioImpact))
      .slice(0, 5)
      .map((row) => `${row.name || "Unnamed"} · ${formatPercent(row.portfolioImpact)}`);
  }
  if (label === "Current DD (pre-tax)") {
    return rows
      .filter((row) => row.positionStatus !== "Closed" && row.unrealized < 0)
      .sort((a, b) => a.unrealized - b.unrealized)
      .slice(0, 5)
      .map((row) => `${row.name || "Unnamed"} · ${formatCurrency(row.unrealized, 0)}`);
  }
  if (label === "Profit risk") {
    return rows
      .filter((row) => row.positionStatus !== "Closed" && row.capitalAtRisk > 0)
      .sort((a, b) => b.capitalAtRisk - a.capitalAtRisk)
      .slice(0, 5)
      .map((row) => `${row.name || "Unnamed"} · ${formatCurrency(row.capitalAtRisk, 0)}`);
  }
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

  const popupDisabled = new Set(["Total trades", "Open positions", "Win rate"]);

  return (
    <section aria-label="Portfolio summary" className="relative z-50 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ label, value, detail, tone = "neutral", icon: Icon, items }) => {
        const cardContent = (
          <>
            <div className="flex items-start justify-between gap-2"><p className="text-[11px] font-semibold uppercase tracking-[0.045em] text-[#89918c]">{label}</p><span className="rounded-full bg-[#f5f7f6] p-1.5 text-[#a9b1ac]"><Icon className="h-3.5 w-3.5" /></span></div>
            <div className="mt-2 flex flex-wrap items-baseline gap-1.5"><p className={`text-[17px] font-bold tabular-nums ${tones[tone]}`}>{value}</p>{detail && <p className="text-[9px] text-[#929a95]">({detail})</p>}</div>
          </>
        );

        return (
          <div key={label} className={`relative ${openLabel === label ? "z-[70]" : "z-0"}`}>
            {popupDisabled.has(label) ? (
              <div className="block w-full rounded-2xl border border-[#dfe7e1] bg-white p-4 text-left shadow-[0_4px_12px_rgba(20,40,30,0.035)]">
                {cardContent}
              </div>
            ) : (
              <>
                <button type="button" onClick={() => setOpenLabel(openLabel === label ? null : label)} className="block w-full rounded-2xl border border-[#dfe7e1] bg-white p-4 text-left shadow-[0_4px_12px_rgba(20,40,30,0.035)] transition hover:-translate-y-0.5 hover:border-[#bdd4c5] hover:shadow-[0_8px_18px_rgba(20,40,30,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8e778]">
                  {cardContent}
                </button>
                {openLabel === label && (
                  <div role="dialog" aria-label={`${label} details`} className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[80] rounded-[12px] border border-[#cbdced] bg-white px-2 pb-2 pt-2 shadow-[0_16px_36px_rgba(22,35,28,0.16)] sm:min-w-[300px]">
                    <div className="flex items-start justify-between gap-3"><div><p className="text-[7px] font-bold uppercase tracking-[0.08em] text-[#b5b8b7]">{label === "Gross realized P/L" ? "Gross PF impact" : label === "Unrealized P/L" ? "Unrealized PF impact" : label}</p><p className="mt-0.5 text-[7px] font-medium text-[#adb1af]">{label === "Gross realized P/L" ? "Capital-weighted impact of realized trades." : label === "Unrealized P/L" ? "Capital-weighted impact of active trades." : "A quick breakdown of this portfolio metric."}</p></div><p className={`shrink-0 text-[9px] font-bold tabular-nums ${tones[tone]}`}>{label === "Gross realized P/L" ? formatPercent(metrics.grossImpact) : value}</p></div>
                    <div className="mt-2 flex items-center justify-between border-b border-[#eef1ef] pb-1 text-[7px] font-bold uppercase text-[#3e4654]"><span>{label === "Gross realized P/L" ? "Top realized" : "Breakdown"}</span>{label === "Gross realized P/L" && <label className="flex items-center gap-1 normal-case font-medium text-[#929795]"><input type="checkbox" className="size-3 accent-[#15955f]" /> Group symbols</label>}</div>
                    <ul className="flex flex-col gap-1 pt-1.5">{items.map((item) => { const [name, ...amountParts] = item.split(" · "); const amount = amountParts.join(" · ") || ""; return <li key={item} className="flex items-start justify-between gap-3 text-[7px] font-semibold text-[#7d817f]"><span className="min-w-0 truncate">{name}</span>{amount && <span className={`shrink-0 text-right text-[8px] font-bold ${label === "Capital at risk" || label === "Profit risk" ? "text-[#e14f69]" : amount.includes("-") ? "text-[#e14f69]" : "text-[#4c9a68]"}`}>{amount}</span>}</li>; })}</ul>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
