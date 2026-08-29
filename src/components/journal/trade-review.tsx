"use client";

import { useEffect, useState } from "react";
import type { Trade, TradeMetric } from "@/lib/trades";

export function TradeReview({ trade, metric }: { trade: Trade; metric: TradeMetric }) {
  const [review, setReview] = useState<{ wentWell: string[]; morePotentialProfit: string[]; improve: string[]; disclaimer: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const run = async () => { setStatus("loading"); try { const response = await fetch("/api/trade-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trade, metric: { entryPrice: trade.entry, realized: metric.realized, grossPL: metric.grossPL, rewardRisk: metric.rewardRisk, exits: metric.exits } }) }); if (!response.ok) throw new Error("Review unavailable"); setReview(await response.json()); setStatus("idle"); } catch { setStatus("error"); } };
  useEffect(() => { if (metric.positionStatus === "Closed") { const timer = window.setTimeout(() => void run(), 0); return () => window.clearTimeout(timer); } }, [metric.positionStatus]);
  if (metric.positionStatus !== "Closed") return null;
  return <section className="mt-4 rounded-2xl border border-[#dce9e1] bg-[#f7fbf8] p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#11885c]">AI trade review</p><h2 className="mt-1 text-xl font-bold">What this trade taught you</h2></div><button className="rounded-lg border border-[#cfe0d5] px-3 py-2 text-xs font-semibold" onClick={() => void run()} disabled={status === "loading"}>{status === "loading" ? "Reviewing…" : "Refresh"}</button></div>{status === "error" && <p className="mt-4 text-sm text-[#c34f5e]">The review could not be generated. Try again.</p>}{review && <div className="mt-5 grid gap-4 md:grid-cols-3">{[["Went well", review.wentWell], ["More potential profit", review.morePotentialProfit], ["What to improve", review.improve]].map(([title, items]) => <div key={String(title)}><h3 className="font-bold">{String(title)}</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-[#536159]">{(items as string[]).map((item) => <li key={item}>{item}</li>)}</ul></div>)}</div>}{review && <p className="mt-4 text-xs text-[#7b867f]">{review.disclaimer}</p>}</section>;
}
