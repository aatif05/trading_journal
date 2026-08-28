import { AlertTriangle } from "lucide-react";
import type { TradeMetric } from "@/lib/trades";
import { findMissingStopLossTrades } from "@/lib/risk";

export function RiskWarning({ metrics }: { metrics: TradeMetric[] }) {
  const trades = findMissingStopLossTrades(metrics);
  if (!trades.length) return null;
  return <aside role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-[#f0c7a9] bg-[#fff8f1] p-4 text-[#8c4e18]"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-semibold">Stop-loss warning</p><p className="mt-1 text-sm leading-6">{trades.length} active trade{trades.length === 1 ? "" : "s"} have no valid SL. Their risk is excluded from percentage totals. Add an SL before relying on risk metrics.</p></div></aside>;
}
