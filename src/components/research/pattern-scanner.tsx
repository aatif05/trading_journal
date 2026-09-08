"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { PatternCandidate, detectPatterns } from "@/lib/patterns";
import { PriceTick } from "@/lib/prices";
import { PatternMiniChart } from "./pattern-mini-chart";

const CHART_WINDOW = 45;

export function PatternScanner() {
  const [input, setInput] = useState("");
  const [symbols, setSymbols] = useState<string[]>([]);
  const [results, setResults] = useState<Array<{ symbol: string; ticks: PriceTick[]; pattern?: PatternCandidate }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function scanPatterns() {
    if (!input.trim()) return;

    const symbolList = input
      .split(/[\n,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (symbolList.length === 0) return;

    setLoading(true);
    setError("");
    setResults([]);

    try {
      const response = await fetch(`/api/research/market?symbols=${encodeURIComponent(symbolList.join(","))}`);
      if (!response.ok) throw new Error("Failed to fetch market data");

      const data = await response.json();
      const series: Array<{ symbol: string; ticks: PriceTick[] }> = data.series ?? [];
      const patterns: PatternCandidate[] = data.patterns ?? [];

      const enriched = series.map((item) => {
        const pattern = patterns.find((p) => p.symbol === item.symbol);
        return { ...item, pattern };
      });

      setResults(enriched);
      setSymbols(symbolList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setInput("");
    setSymbols([]);
    setResults([]);
    setError("");
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#e2e9e3] bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b867f]">
            Temporary Pattern Scanner
          </p>
          <h2 className="mt-1 text-xl font-bold">Test Symbols for VCP/Darvas Patterns</h2>
        </div>
        {results.length > 0 && (
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-2 rounded-xl border border-[#dfe6e1] bg-white px-3 py-2 text-sm font-semibold text-[#202923] hover:bg-[#f7f9f7]"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      <div className="mt-4 flex gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter symbols (comma or newline separated)&#10;Example: NVDA, AAPL&#10;MSFT, TSLA"
          rows={3}
          className="flex-1 resize-none rounded-xl border border-[#dfe6e1] bg-white p-3 text-sm focus:border-[#11885c] focus:outline-none"
          disabled={loading}
        />
        <button
          onClick={scanPatterns}
          disabled={loading || !input.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#202923] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          <Search className="h-4 w-4" />
          {loading ? "Scanning..." : "Scan"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {results.map((item) => {
            const windowTicks = item.ticks.slice(-CHART_WINDOW);
            const windowHighs = windowTicks.map((tick) => Number(tick[2])).filter(Number.isFinite);
            const windowLows = windowTicks.map((tick) => Number(tick[3])).filter(Number.isFinite);

            if (item.pattern) {
              const ceiling = Math.max(
                item.pattern.breakoutLevel ?? -Infinity,
                ...windowHighs
              );
              const floor =
                item.pattern.pattern === "Darvas Box" && item.pattern.stopLevel != null
                  ? Math.min(item.pattern.stopLevel, ...windowLows)
                  : Math.min(...windowLows);
              const breakout = item.pattern.breakoutLevel ?? ceiling;

              return (
                <div key={item.symbol} className="rounded-xl bg-[#f7f9f7] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{item.symbol} · {item.pattern.pattern}</p>
                      <p className="mt-1 text-xs text-[#7b867f]">
                        Last {CHART_WINDOW} sessions · trigger{" "}
                        {item.pattern.breakoutLevel ? item.pattern.breakoutLevel.toFixed(2) : "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-bold text-[#11885c]">
                      {item.pattern.confidence} confidence
                    </span>
                  </div>
                  <div className="mt-3 h-64">
                    <PatternMiniChart
                      ticks={windowTicks}
                      ceiling={ceiling}
                      floor={floor}
                      breakout={breakout}
                      boxStart={item.pattern.pattern === "Darvas Box" ? item.pattern.boxStart : undefined}
                      boxEnd={item.pattern.pattern === "Darvas Box" ? item.pattern.boxEnd : undefined}
                    />
                  </div>
                  <p className="mt-2 text-sm text-[#66716a]">{item.pattern.evidence.join(" · ")}</p>
                </div>
              );
            }

            return (
              <div key={item.symbol} className="rounded-xl bg-[#f7f9f7] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{item.symbol} · Pattern scan</p>
                    <p className="mt-1 text-xs text-[#7b867f]">
                      No confirmed VCP or Darvas setup yet
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-[#7b867f]">Watching</span>
                </div>
                {windowTicks.length > 0 && (
                  <div className="mt-3 h-64">
                    <PatternMiniChart
                      ticks={windowTicks}
                      ceiling={Math.max(...windowHighs)}
                      floor={Math.min(...windowLows)}
                      breakout={Math.max(...windowHighs)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {results.length === 0 && !loading && !error && (
        <div className="mt-6 rounded-xl border border-dashed border-[#dfe6e1] bg-[#f7f9f7] p-8 text-center text-sm text-[#7b867f]">
          Enter symbols above and click Scan to check for VCP, Darvas Box, or other base patterns.
          <br />
          <span className="text-xs">(This is a temporary testing tool - will be removed later)</span>
        </div>
      )}
    </section>
  );
}
