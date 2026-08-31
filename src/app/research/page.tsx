"use client";

import { useEffect, useMemo, useState } from "react";
import { PatternMiniChart } from "@/components/research/pattern-mini-chart";
import type { PatternCandidate, ThemeSummary } from "@/lib/patterns";
import { AlertTriangle, BrainCircuit, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useTrades } from "@/hooks/use-trades";
import { fetchLatestPrices } from "@/lib/prices";
import { findMissingStopLossTrades, momentumSignal, safePercent } from "@/lib/risk";
import { calculateTradeMetrics, formatCurrency } from "@/lib/trades";

const CHART_WINDOW = 30;

export default function ResearchPage() {
  const { trades } = useTrades();
  const symbols = useMemo(
    () => [...new Set(trades.map((t) => t.name.trim().toUpperCase()).filter(Boolean))],
    [trades],
  );

  const [symbol, setSymbol] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [previous, setPrevious] = useState<number | null>(null);
  const [status, setStatus] = useState("Select a symbol to begin research.");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [patterns, setPatterns] = useState<PatternCandidate[]>([]);
  const [marketSeries, setMarketSeries] = useState<{ symbol: string; ticks: string[][] }[]>([]);
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [marketStatus, setMarketStatus] = useState("Loading candle history…");

  useEffect(() => {
    if (!symbols.length) return;
    fetch(`/api/research/market?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then((response) => response.json())
      .then((data) => {
        setPatterns(data.patterns ?? []);
        setMarketSeries(data.series ?? []);
        setThemes(data.themes ?? []);
        setMarketStatus(
          data.series?.length
            ? `Daily history loaded · ${new Date(data.fetchedAt).toLocaleTimeString()}`
            : "No daily history available",
        );
      })
      .catch(() => setMarketStatus("Market history unavailable"));
  }, [symbols]);

  const myThemes = useMemo(
    () =>
      [...new Set(trades.map((trade) => trade.name.trim().toUpperCase()).filter(Boolean))]
        .map((item) => themes.find((theme) => theme.symbols.includes(item))?.theme ?? "Unclassified")
        .filter((item, index, all) => all.indexOf(item) === index),
    [themes, trades],
  );

  const selectedTrade = trades.find((t) => t.name.trim().toUpperCase() === symbol);
  const change =
    price !== null && previous !== null && previous !== 0 ? ((price - previous) / previous) * 100 : null;
  const signal = momentumSignal(change);
  const metrics = calculateTradeMetrics(trades);
  const missingSL = findMissingStopLossTrades(metrics);

  const reentryCandidates = metrics
    .filter((trade) => trade.positionStatus !== "Closed" && trade.sl > 0)
    .map((trade) => {
      const market = marketSeries.find((item) => item.symbol === trade.name.trim().toUpperCase());
      const closes = market?.ticks.map((tick) => Number(tick[4])).filter(Number.isFinite) ?? [];
      const current = closes.at(-1) ?? trade.cmp;
      const ma20 =
        closes.slice(-20).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.min(20, closes.length));
      const distance = ma20 ? (Math.abs(current - ma20) / ma20) * 100 : 999;
      return { trade, current, ma20, distance, eligible: distance <= 6 && current > trade.sl };
    })
    .filter((candidate) => candidate.eligible)
    .sort((a, b) => a.distance - b.distance);

  async function refresh() {
    if (!symbol) return;
    setStatus("Refreshing market data…");
    try {
      const result = await fetchLatestPrices([symbol]);
      setPrevious(price);
      setPrice(result[symbol] ?? null);
      setStatus(
        result[symbol]
          ? "Live quote loaded from the existing price API."
          : "No recent quote available; showing no-data state.",
      );
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
            sector: "Unavailable from existing price API",
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

  return (
    <main className="min-h-screen bg-[#f7f9f7] pb-28 text-[#202923]">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#11885c]">Research desk</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Context before conviction</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66716a]">
              Review price behavior and momentum, then ask for a cautious research brief. Signals are
              informational, not predictions or financial advice.
            </p>
          </div>
          <div className="flex gap-2">
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="rounded-xl border border-[#dfe6e1] bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose symbol</option>
              {symbols.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
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

        {reentryCandidates.length > 0 && (
          <section className="mt-6 rounded-2xl border border-[#cfe0d5] bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#11885c]">Open trade monitor</p>
                <h2 className="mt-1 text-xl font-bold">Potential re-entry zones</h2>
              </div>
              <p className="text-xs text-[#7b867f]">Decision support, not a buy signal</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {reentryCandidates.map(({ trade, current, ma20, distance }) => (
                <div key={trade.id} className="rounded-xl bg-[#f7f9f7] p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{trade.name}</p>
                    <span className="text-xs font-bold text-[#11885c]">{distance.toFixed(1)}% from MA20</span>
                  </div>
                  <p className="mt-2 text-sm text-[#66716a]">
                    CMP {formatCurrency(current)} · MA20 {formatCurrency(ma20)} · invalidation{" "}
                    {formatCurrency(trade.sl)}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#66716a]">
                    Risk/share {formatCurrency(Math.abs(current - trade.sl))} · proposed zone{" "}
                    {formatCurrency(ma20 * 0.98)}–{formatCurrency(ma20 * 1.02)} · reward/risk requires a target
                  </p>
                  <p className="mt-2 text-xs text-[#7b867f]">
                    Consider only after price confirmation, supportive volume, and a defined stop. Respect the
                    original position risk.
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <p className="text-xs font-bold uppercase text-[#7b867f]">CMP</p>
            <p className="mt-3 text-2xl font-bold">{price === null ? "—" : formatCurrency(price)}</p>
            <p className="mt-1 text-xs text-[#7b867f]">{status}</p>
          </section>
          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <p className="text-xs font-bold uppercase text-[#7b867f]">Momentum</p>
            <p className="mt-3 flex items-center gap-2 text-xl font-bold">
              {signal.tone === "negative" ? <TrendingDown className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
              {signal.label}
            </p>
            <p className="mt-1 text-xs text-[#7b867f]">
              {change === null ? "No comparison data" : `${change.toFixed(2)}% since last refresh`}
            </p>
          </section>
          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <p className="text-xs font-bold uppercase text-[#7b867f]">Sector health</p>
            <p className="mt-3 text-xl font-bold">Unavailable</p>
            <p className="mt-1 text-xs text-[#7b867f]">Existing API does not provide sector breadth.</p>
          </section>
          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <p className="text-xs font-bold uppercase text-[#7b867f]">Risk context</p>
            <p className="mt-3 text-xl font-bold">{selectedTrade?.sl ? "SL recorded" : "Needs SL"}</p>
            <p className="mt-1 text-xs text-[#7b867f]">
              {selectedTrade?.sl
                ? `${safePercent(
                    Math.abs((selectedTrade.entry - selectedTrade.sl) * selectedTrade.initialQty),
                    selectedTrade.entry * selectedTrade.initialQty,
                  )?.toFixed(2)}% entry risk`
                : "No default risk invented"}
            </p>
          </section>
        </div>

        {/* Pattern radar — full width, mini charts windowed to the last CHART_WINDOW sessions */}
        <section className="mt-4 rounded-2xl border border-[#e2e9e3] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b867f]">Pattern radar</p>
              <h2 className="mt-1 text-xl font-bold">Bases forming</h2>
            </div>
            <p className="text-xs text-[#7b867f]">{marketStatus}</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {marketSeries.length ? (
              marketSeries.map((market) => {
                const item = patterns.find((candidate) => candidate.symbol === market.symbol);

                // Zoom the chart to the last CHART_WINDOW sessions so recent price
                // action (what actually matters for spotting a base/breakout)
                // isn't squeezed into a sliver at the edge of a full 1-year chart.
                const windowTicks = market.ticks.slice(-CHART_WINDOW);
                const typedTicks = windowTicks as [string, string, string, string, string, string][];

                const windowHighs = windowTicks.map((tick) => Number(tick[2])).filter(Number.isFinite);
                const windowLows = windowTicks.map((tick) => Number(tick[3])).filter(Number.isFinite);

                if (item) {
                  // Prefer the real box/pivot levels from full-history detection,
                  // but widen to the visible window if a level sits outside it.
                  const ceiling = Math.max(item.breakoutLevel ?? -Infinity, ...windowHighs);
                  const floor =
                    item.pattern === "Darvas Box" && item.stopLevel != null
                      ? Math.min(item.stopLevel, ...windowLows)
                      : Math.min(...windowLows);
                  const breakout = item.breakoutLevel ?? ceiling;

                  return (
                    <div key={market.symbol} className="rounded-xl bg-[#f7f9f7] p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold">
                            {item.symbol} · {item.pattern}
                          </p>
                          <p className="mt-1 text-xs text-[#7b867f]">
                            Last {CHART_WINDOW} sessions · trigger{" "}
                            {item.breakoutLevel ? formatCurrency(item.breakoutLevel) : "—"}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-[#11885c]">{item.confidence} confidence</span>
                      </div>
                      <div className="mt-3 h-64">
                        <PatternMiniChart ticks={typedTicks} ceiling={ceiling} floor={floor} breakout={breakout} />
                      </div>
                      <p className="mt-2 text-sm text-[#66716a]">{item.evidence.join(" · ")}</p>
                    </div>
                  );
                }

                return (
                  <div key={market.symbol} className="rounded-xl bg-[#f7f9f7] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">{market.symbol} · Pattern scan</p>
                        <p className="mt-1 text-xs text-[#7b867f]">
                          No confirmed VCP or Darvas setup yet · last {CHART_WINDOW} of {market.ticks.length} sessions
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-bold text-[#7b867f]">Watching</span>
                    </div>
                    <div className="mt-3 h-48">
                      <PatternMiniChart
                        ticks={typedTicks}
                        ceiling={Math.max(...windowHighs)}
                        floor={Math.min(...windowLows)}
                        breakout={Math.max(...windowHighs)}
                      />
                    </div>
                  </div>
                );
              })
            ) : patterns.length > 0 ? (
              patterns.map((item) => (
                <div key={`${item.symbol}-${item.pattern}`} className="rounded-xl bg-[#f7f9f7] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">
                        {item.symbol} · {item.pattern}
                      </p>
                      <p className="mt-1 text-xs text-[#7b867f]">
                        Base formation · 20 sessions · trigger{" "}
                        {item.breakoutLevel ? formatCurrency(item.breakoutLevel) : "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-[#11885c]">{item.confidence} confidence</span>
                  </div>
                  <p className="mt-2 text-sm text-[#66716a]">{item.evidence.join(" · ")}</p>
                  {item.breakoutLevel && (
                    <p className="mt-2 text-xs font-semibold">Potential trigger: {formatCurrency(item.breakoutLevel)}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-[#66716a]">No VCP or Darvas candidates detected in the available history.</p>
            )}
          </div>
          <p className="mt-4 text-xs text-[#7b867f]">
            Candidates are heuristic signals, not confirmed patterns or trade recommendations.
          </p>
        </section>

        {/* Theme pulse — moved below Pattern radar, now a horizontal card grid instead of a cramped sidebar */}
        <section className="mt-4 rounded-2xl border border-[#e2e9e3] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b867f]">Theme pulse</p>
          <h2 className="mt-1 text-xl font-bold">Your themes vs leaders</h2>
          <p className="mt-2 text-sm text-[#66716a]">Traded themes: {myThemes.join(", ") || "None classified"}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themes.slice(0, 6).map((theme) => (
              <div key={theme.theme} className="flex items-center justify-between rounded-xl bg-[#f7f9f7] p-4">
                <div>
                  <p className="font-semibold">{theme.theme}</p>
                  <p className="text-xs text-[#7b867f]">
                    Breadth {theme.breadth.toFixed(0)}% · {theme.momentum}
                  </p>
                </div>
                <p
                  className={`font-bold ${
                    theme.return20d !== null && theme.return20d >= 0 ? "text-[#11885c]" : "text-[#c34f5e]"
                  }`}
                >
                  {theme.return20d === null ? "—" : `${theme.return20d >= 0 ? "+" : ""}${theme.return20d.toFixed(2)}%`}
                </p>
              </div>
            ))}
            {!themes.length && <p className="text-sm text-[#66716a]">No theme history available yet.</p>}
          </div>
          <p className="mt-4 text-xs text-[#7b867f]">
            20-session returns use the existing daily price API and a conservative symbol-to-theme map.
          </p>
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b867f]">Market context</p>
                <h2 className="mt-1 text-xl font-bold">{symbol || "Select a symbol"}</h2>
              </div>
              <Search className="h-5 w-5 text-[#7b867f]" />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[#f7f9f7] p-4">
                <p className="text-xs text-[#7b867f]">Trend</p>
                <p className="mt-2 font-bold">{change === null ? "No data" : change >= 0 ? "Higher" : "Lower"}</p>
              </div>
              <div className="rounded-xl bg-[#f7f9f7] p-4">
                <p className="text-xs text-[#7b867f]">Moving averages</p>
                <p className="mt-2 font-bold">Needs candle history</p>
              </div>
              <div className="rounded-xl bg-[#f7f9f7] p-4">
                <p className="text-xs text-[#7b867f]">Volume</p>
                <p className="mt-2 font-bold">Needs candle history</p>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border border-[#e2e9e3] bg-[#202923] p-5 text-white">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-[#7de2b3]" />
              <p className="font-bold">Research brief</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#c7d1ca]">
              AI uses only the visible market inputs and clearly marks missing context.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => askAI("analysis")}
                disabled={!symbol || aiLoading}
                className="rounded-xl bg-[#7de2b3] px-3 py-2 text-sm font-bold text-[#163b2b]"
              >
                Analyze symbol
              </button>
              <button
                onClick={() => askAI("ideas")}
                disabled={!symbol || aiLoading}
                className="rounded-xl border border-[#718079] px-3 py-2 text-sm font-bold"
              >
                Opportunity view
              </button>
            </div>
            {aiLoading && <p className="mt-4 text-sm text-[#c7d1ca]">Preparing cautious research…</p>}
            {aiText && (
              <div className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[#29362f] p-4 font-sans text-sm leading-6 text-[#edf6ef]">
                {aiText
                  .replace(/^```(?:json|markdown)?\s*|\s*```$/g, "")
                  .replace(/[{}\[\]"]/g, "")
                  .replace(/,\s*(?=[A-Za-z ]+:)/g, "\n")}
              </div>
            )}
          </section>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
