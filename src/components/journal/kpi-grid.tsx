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
import { formatCurrency, formatPercent, PortfolioMetrics } from "@/lib/trades";

type Card = {
  label: string;
  value: string;
  detail?: string;
  tone?: "green" | "amber" | "red" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
};

const tones = {
  green: "text-[#15955f]",
  amber: "text-[#dc8a08]",
  red: "text-[#e14f69]",
  neutral: "text-[#17201b]",
};

export function KpiGrid({ metrics }: { metrics: PortfolioMetrics }) {
  const cards: Card[] = [
    { label: "Total trades", value: String(metrics.totalTrades), icon: ListChecks },
    {
      label: "Open positions",
      value: String(metrics.openPositions),
      tone: "amber",
      icon: Activity,
    },
    { label: "Win rate", value: formatPercent(metrics.winRate), tone: "green", icon: Target },
    {
      label: "Gross realized P/L",
      value: formatCurrency(metrics.realizedPL, 0),
      tone: metrics.realizedPL < 0 ? "red" : "green",
      icon: IndianRupee,
    },
    {
      label: "Unrealized P/L",
      value: formatCurrency(metrics.unrealizedPL),
      detail: `${formatPercent((metrics.unrealizedPL * 100) / 350_000)} of pf`,
      tone: metrics.unrealizedPL < 0 ? "red" : "green",
      icon: TrendingUp,
    },
    {
      label: "Capital at risk",
      value: formatPercent(metrics.capitalAtRiskPercent),
      detail: formatCurrency(metrics.capitalAtRisk, 0),
      tone: "red",
      icon: Flame,
    },
    {
      label: "Profit risk",
      value: formatPercent(metrics.capitalAtRiskPercent),
      tone: "amber",
      icon: Gauge,
    },
    {
      label: "Profit protected",
      value: formatCurrency(metrics.profitProtected, 0),
      detail: `${formatPercent(metrics.profitProtectedPercent)} of pf`,
      tone: "green",
      icon: ShieldCheck,
    },
    {
      label: "% invested",
      value: formatPercent(metrics.investedPercent),
      detail: formatCurrency(metrics.invested),
      icon: WalletCards,
    },
    {
      label: "Gross PF impact % (all-time)",
      value: formatPercent(metrics.grossImpact),
      tone: metrics.grossImpact < 0 ? "red" : "green",
      icon: ChartNoAxesCombined,
    },
    {
      label: "Current DD (pre-tax)",
      value: formatPercent(metrics.currentDrawdown),
      tone: metrics.currentDrawdown < 0 ? "red" : "green",
      icon: CircleDollarSign,
    },
  ];

  return (
    <section
      aria-label="Portfolio summary"
      className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6"
    >
      {cards.map(({ label, value, detail, tone = "neutral", icon: Icon }) => (
        <article
          key={label}
          className="min-h-[92px] rounded-2xl border border-[#e8ebe9] bg-white p-3.5 shadow-[0_1px_3px_rgba(20,40,30,0.04)]"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.045em] text-[#89918c]">
              {label}
            </p>
            <span className="rounded-full bg-[#f5f7f6] p-1.5 text-[#a9b1ac]">
              <Icon className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
            <p className={`text-[17px] font-bold tabular-nums ${tones[tone]}`}>{value}</p>
            {detail && <p className="text-[9px] text-[#929a95]">({detail})</p>}
          </div>
        </article>
      ))}
    </section>
  );
}
