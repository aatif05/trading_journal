"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, Info, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";

import { BottomNav } from "@/components/layout/bottom-nav";
import { useTrades } from "@/hooks/use-trades";
import { fetchLatestPrices, type PriceTick } from "@/lib/prices";
import { findMissingStopLossTrades, momentumSignal, safePercent } from "@/lib/risk";
import { calculateTradeMetrics, formatCurrency } from "@/lib/trades";
import { classifyEntrySetup, classifyReEntry, type PatternCandidate, type ThemeSummary } from "@/lib/patterns";

import { ReEntryMonitor } from "@/components/research/re-entry-monitor";
import { FreshSetupRadar } from "@/components/research/fresh-setup-radar";

export default function ResearchPage() {
  const { trades } = useTrades();

  const symbols = useMemo(
    () => [...new Set(trades.map((t) => t.name.trim().toUpperCase()).filter(Boolean))],
    [trades]
  );

  const [symbol, setSymbol] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [previous, setPrevious] = useState<number | null>(null);
  const [status, setStatus] = useState("Select a symbol to begin research.");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [patterns, setPatterns] = useState<PatternCandidate[]>([]);
  const [marketSeries, setMarketSeries] = useState<Array<{ symbol: string; ticks: PriceTick[] }>>([]);
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [marketStatus, setMarketStatus] = useState("Loading candle history…");

  useEffect(() => {
    if (!symbols.length) {
      setMarketSeries([]);
      setPatterns([]);
      return;
    }

    fetch(`/api/research/market?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then((response) => response.json())
      .then((data) => {
        setPatterns(data.patterns ?? []);
        setMarketSeries(data.series ?? []);
        setThemes(data.themes ?? []);
        setMarketStatus(
          data.series?.length
            ? `Daily history loaded · ${new Date(data.fetchedAt).toLocaleTimeString()}`
            : "No daily history available"
        );
      })
      .catch(() => setMarketStatus("Market history unavailable"));
  }, [symbols]);

  const myThemes = useMemo(
    () =>
      [...new Set(trades.map((trade) => trade.name.trim().toUpperCase()).filter(Boolean))]
        .map((item) => themes.find((theme) => theme.symbols.includes(item))?.theme ?? "Unclassified")
        .filter((item, index, all) => all.indexOf(item) === index),
    [themes, trades]
  );

  const selectedTrade = trades
    .filter((t) => t.name.trim().toUpperCase() === symbol && t.positionStatus !== "Closed")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

  const change = price !== null && previous !== null && previous !== 0
    ? ((price - previous) / previous) * 100
    : null;

  const signal = momentumSignal(change);
  const metrics = calculateTradeMetrics(trades);

  const openSymbols = useMemo(() => {
    return new Set(
      metrics
        .filter((m) => m.positionStatus === "Open" || m.positionStatus === "Partial")
        .map((m) => m.name.trim().toUpperCase())
        .filter(Boolean)
    );
  }, [metrics]);

  const missingSL = findMissingStopLossTrades(metrics);

  const freshSetupRadar = useMemo(
    () =>
      marketSeries
        .filter((market) => !openSymbols.has(market.symbol))
        .map((market) => {
          const setup = classifyEntrySetup(market.ticks);
          return { symbol: market.symbol, setup };
        })
        .filter((item): item is { symbol: string; setup: NonNullable<typeof item.setup> } =>
          item.setup !== null && item.setup.state !== "BREAKDOWN"
        )
        .sort((a, b) => b.setup.score - a.setup.score),
    [marketSeries, openSymbols]
  );

  const reentryCandidates = useMemo(
    () =>
      metrics
        .filter((trade) => trade.positionStatus !== "Closed" && trade.sl > 0)
        .map((trade) => {
          const tradeSymbol = trade.name.trim().toUpperCase();
          const market = marketSeries.find((item) => item.symbol === tradeSymbol);

          if (!market) return null;

          const setup = classifyReEntry(market.ticks, trade.entry, trade.sl);
          if (!setup) return null;

          if (setup.state !== "RE-ENTRY WATCH" && setup.state !== "ENTRY") return null;

          return { trade, symbol: tradeSymbol, setup };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => {
          const score = (item: typeof a) =>
            (item.setup.pocketPivot ? 40 : 0) +
            (item.setup.trend.strong ? 25 : 0) +
            (item.setup.pullback.healthy ? 20 : 0) +
            (item.setup.pullback.contraction ? 10 : 0) +
            (item.setup.pullback.higherLow ? 5 : 0);
          return score(b) - score(a);
        }),
    [metrics, marketSeries]
  );

  async function refresh() {
    if (!symbol) return;
    setStatus("Refreshing market data…");
    try {
      const result = await fetchLatestPrices([symbol]);
      setPrevious(price);
      setPrice(result[symbol] ?? null);
      setStatus(result[symbol] ? "Live quote loaded." : "No recent quote available.");
    } catch {
      setStatus("Market data unavailable. Try again later.");
    }
  }

  async function askAI(mode: "analysis" | "ideas") {
    if (!symbol) return;
    setAiLoading(true);
    setAiText("");
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          mode,
          inputs: {
            price,
            changePercent: change,
            sector: "Unavailable",
            stopLoss: selectedTrade?.sl ?? null,
          },
        }),
      });
      const result = await response.json();
      setAiText(result.text ?? result.error ?? "Research unavailable.");
    } catch {
      setAiText("Research unavailable. Check the connection and try again.");
    } finally {
      setAiLoading(false);
    }
  }

  const selectedSetup = useMemo(() => {
    if (!symbol) return null;
    const market = marketSeries.find((item) => item.symbol === symbol);
    return market ? classifyEntrySetup(market.ticks) : null;
  }, [symbol, marketSeries]);

  return (
    <main className="min-h-screen bg-[#f7f9f7] pb-28 text-[#202923]">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#11885c]">Research desk</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Context before conviction</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66716a]">
              Trend → pullback → confirmation. Fresh setups and open-trade re-entries are evaluated by separate engines.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowGuide(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6e1] bg-white px-3 py-2 text-sm font-semibold text-[#202923] hover:bg-[#f7f9f7]"
            >
              <Info className="h-4 w-4" />
              Guide
            </button>

            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="rounded-xl border border-[#dfe6e1] bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose symbol</option>
              {symbols.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <button
              onClick={refresh}
              disabled={!symbol}
              className="inline-flex items-center gap-2 rounded-xl bg-[#202923] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </header>

        {missingSL.length > 0 && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#f0c7a9] bg-[#fff8f1] p-4 text-[#8c4e18]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">
                {missingSL.length} active trade{missingSL.length === 1 ? "" : "s"} missing a stop loss
              </p>
              <p className="mt-1 text-sm">
                Risk percentages exclude these positions until an SL is recorded:{" "}
                {missingSL.map((t) => `#${t.tradeNo} ${t.name}`).join(", ")}.
              </p>
            </div>
          </div>
        )}

        {/* Use the new components */}
       <ReEntryMonitor candidates={reentryCandidates} />
        <FreshSetupRadar setups={freshSetupRadar} />

        {/* Rest of your existing page (Selected Symbol Summary, Pattern Radar, etc.) */}
        {/* ... keep the rest of your page as is ... */}
      </div>

      {/* Guide Modal - keep as is */}
      {showGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowGuide(false)}>
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between border-b border-[#edf0ee] pb-3">
              <h2 className="text-xl font-bold text-[#202923]">Research Guide</h2>
              <button onClick={() => setShowGuide(false)} className="rounded-lg p-1 text-[#7b867f] hover:bg-[#f7f9f7] hover:text-[#202923]">✕</button>
            </div>
            {/* Guide content - keep your existing guide content */}
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
