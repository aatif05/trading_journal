"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatPercent, type Trade, type TradeMetric } from "@/lib/trades";

type Props = { trades: Trade[]; rows: TradeMetric[] };

export function ProJournalInsights({ trades, rows }: Props) {
  const [reviewFilter, setReviewFilter] = useState<"all" | "wins" | "losses" | "open" | "review">("all");
  const closed = rows.filter((r) => r.positionStatus === "Closed");
  const wins = closed.filter((r) => r.grossPL > 0);
  const losses = closed.filter((r) => r.grossPL < 0);
  const net = closed.reduce((sum, r) => sum + r.grossPL, 0);
  const grossWins = wins.reduce((sum, r) => sum + r.grossPL, 0);
  const grossLosses = Math.abs(losses.reduce((sum, r) => sum + r.grossPL, 0));
  const profitFactor = grossLosses ? grossWins / grossLosses : grossWins ? Infinity : 0;
  const expectancy = closed.length ? net / closed.length : 0;
  const filtered = useMemo(() => rows.filter((r) => reviewFilter === "all" || (reviewFilter === "wins" && r.grossPL > 0) || (reviewFilter === "losses" && r.grossPL < 0) || (reviewFilter === "open" && r.positionStatus !== "Closed") || (reviewFilter === "review" && !r.quickNote)), [reviewFilter, rows]);
  const setupStats = Object.entries(rows.reduce<Record<string, { pl: number; count: number }>>((acc, r) => { const key = r.setup || "No setup"; acc[key] ??= { pl: 0, count: 0 }; acc[key].pl += r.grossPL; acc[key].count++; return acc; }, {})).sort((a, b) => b[1].pl - a[1].pl).slice(0, 5);
  const maxDrawdown = rows.reduce((state, row) => { const equity = state.equity + row.grossPL; const peak = Math.max(state.peak, equity); return { equity, peak, drawdown: Math.min(state.drawdown, equity - peak) }; }, { equity: 0, peak: 0, drawdown: 0 }).drawdown;
  const reviewed = trades.filter((t) => t.quickNote || t.planFollowed).length;

  return <section className="flex flex-col gap-3" aria-label="Professional trading insights">
    <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-[#e5e9e6] bg-[#17251d] p-4 text-white shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9db3a5]">Trading edge</p><h2 className="mt-1 text-xl font-bold tracking-tight">Review the process behind the result.</h2><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="text-[10px] text-[#9db3a5]">Expectancy</p><p className={`mt-1 text-lg font-bold ${expectancy >= 0 ? "text-[#74d49b]" : "text-[#ff9dad]"}`}>{formatCurrency(expectancy, 0)}</p></div><div><p className="text-[10px] text-[#9db3a5]">Profit factor</p><p className="mt-1 text-lg font-bold text-[#74d49b]">{Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : "∞"}</p></div><div><p className="text-[10px] text-[#9db3a5]">Max drawdown</p><p className="mt-1 text-lg font-bold text-[#ff9dad]">{formatCurrency(maxDrawdown, 0)}</p></div><div><p className="text-[10px] text-[#9db3a5]">Reviewed</p><p className="mt-1 text-lg font-bold text-[#b7d7c1]">{reviewed}/{trades.length}</p></div></div></div>
      <div className="rounded-2xl border border-[#e5e9e6] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#89918c]">Setup scorecard</p><p className="mt-1 text-sm font-bold text-[#253129]">Where your edge is showing</p></div><p className="text-xs font-bold text-[#15955f]">{formatPercent(closed.length ? wins.length / closed.length * 100 : 0)}</p></div><div className="mt-4 flex flex-col gap-2">{setupStats.length ? setupStats.map(([name, stat]) => <div key={name} className="flex items-center justify-between text-xs"><span className="truncate text-[#606a64]">{name}</span><span className={stat.pl >= 0 ? "font-bold text-[#15955f]" : "font-bold text-[#e14f69]"}>{formatCurrency(stat.pl, 0)} <span className="font-normal text-[#a0a7a3]">· {stat.count}</span></span></div>) : <p className="text-xs text-[#89918c]">Add trades to build your scorecard.</p>}</div></div>
    </div>
    <div className="rounded-2xl border border-[#e5e9e6] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#89918c]">Review queue</p><p className="mt-1 text-sm font-bold text-[#253129]">Use the existing trade-row notes and plan fields</p></div><span className="text-xs text-[#89918c]">{filtered.length} trades</span></div><div className="mt-3 flex flex-wrap gap-1.5">{(["all", "wins", "losses", "open", "review"] as const).map((filter) => <button key={filter} type="button" onClick={() => setReviewFilter(filter)} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${reviewFilter === filter ? "bg-[#17251d] text-white" : "bg-[#f2f5f3] text-[#65716a]"}`}>{filter}</button>)}</div><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{filtered.slice(0, 8).map((row) => <div key={row.id} className="rounded-lg bg-[#f7f9f8] px-3 py-2 text-xs"><div className="flex justify-between gap-2"><span className="font-semibold text-[#425047]">{row.name || "Unnamed"}</span><span className={row.grossPL >= 0 ? "text-[#15955f]" : "text-[#e14f69]"}>{row.positionStatus === "Closed" ? formatCurrency(row.grossPL, 0) : "Open"}</span></div><p className="mt-1 truncate text-[#89918c]">{row.quickNote || "Needs a written review"}</p></div>)}</div></div>
  </section>;
}

export default ProJournalInsights;
