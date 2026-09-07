"use client";

import { useEffect, useState } from "react";
import { type EntryClassification } from "@/lib/patterns";
import { fetchLatestPrices, type LatestPrices } from "@/lib/prices";
import { formatCurrency } from "@/lib/trades";
import { StateBadge } from "./state-badge";
import { Tooltip } from "./tooltip";

type FreshSetup = {
  symbol: string;
  setup: EntryClassification;
};

type FreshSetupRadarProps = {
  setups: FreshSetup[];
};

export function FreshSetupRadar({ setups }: FreshSetupRadarProps) {
  const [livePrices, setLivePrices] = useState<LatestPrices>({});
  const [loading, setLoading] = useState(false);

  // Fetch live prices only for symbols with ENTRY state (healthy pullback + confirmation)
  useEffect(() => {
    const entrySymbols = setups
      .map((s) => s.symbol);

    if (!entrySymbols.length) return;

    async function fetchPrices() {
      setLoading(true);
      try {
        const prices = await fetchLatestPrices(entrySymbols);
        setLivePrices(prices);
      } catch (error) {
        console.error("Failed to fetch live prices for fresh setup radar:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPrices();
  }, [setups]);

  return (
    <section className="mt-6 rounded-2xl border border-[#cfe0d5] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#11885c]">
            Fresh Setup Radar
          </p>
          <h2 className="mt-1 text-xl font-bold">New entry lifecycle</h2>
          <p className="mt-1 text-xs text-[#7b867f]">
            No existing position required. Every setup is evaluated from trend through risk/reward.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <p className="text-xs text-[#7b867f]">Fetching live prices…</p>
          )}
          <p className="text-xs text-[#7b867f]">{setups.length} setups</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {setups.length ? (
          setups.map(({ symbol, setup }) => (
            <FreshSetupCard key={symbol} symbol={symbol} setup={setup} livePrice={livePrices[symbol]} />
          ))
        ) : (
          <p className="text-sm text-[#66716a]">
            No complete fresh setup is currently available.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-[#7b867f]">
        ENTRY requires a healthy trend, healthy pullback, fresh confirmation and acceptable R:R. These are heuristic decision-support states, not trade recommendations.
      </p>
    </section>
  );
}

function FreshSetupCard({ symbol, setup, livePrice }: { symbol: string; setup: EntryClassification; livePrice?: number }) {
  // Use live price if available, otherwise fall back to daily close
  const displayPrice = livePrice ?? setup.entry;
  const isLive = livePrice !== undefined;

  return (
    <div className="rounded-2xl border border-[#e1e8e3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{symbol}</p>
          <p className="mt-1 text-xs text-[#7b867f]">
            CMP {formatCurrency(displayPrice)}
            {isLive && (
              <span className="ml-2 inline-flex items-center rounded-full bg-[#11885c]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#11885c]">
                Live
              </span>
            )}
          </p>
        </div>
        <StateBadge state={setup.state} />
      </div>

      <SetupMetrics setup={setup} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">Structural stop</p>
          <p className="mt-1 font-bold">{formatCurrency(setup.stop)}</p>
        </div>
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">Projected target</p>
          <p className="mt-1 font-bold">{formatCurrency(setup.target)}</p>
        </div>
      </div>

      <PullbackDetails setup={setup} />

      {setup.pocketPivot && (
        <div className="mt-3 rounded-xl border border-[#bfe5cf] bg-[#f1fbf5] p-3">
          <p className="text-xs font-extrabold text-[#087443]">FRESH POCKET PIVOT</p>
          <p className="mt-1 text-xs text-[#47715b]">{setup.pocketPivot.evidence.join(" · ")}</p>
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-[#66716a]">{setup.evidence.join(" · ")}</p>
    </div>
  );
}

function SetupMetrics({ setup }: { setup: EntryClassification }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <div className="flex items-center gap-1">
          <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">10 EMA</p>
          <Tooltip title="10-period Exponential Moving Average">
            <p className="text-[10px] text-[#7b867f]">Short-term trend indicator. Price above = bullish momentum.</p>
          </Tooltip>
        </div>
        <p className="mt-1 font-bold">{setup.trend.ema10 ? formatCurrency(setup.trend.ema10) : "—"}</p>
      </div>

      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <div className="flex items-center gap-1">
          <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">21 EMA</p>
          <Tooltip title="21-period Exponential Moving Average">
            <p className="text-[10px] text-[#7b867f]">Medium-term trend. Ideal structure: Price &gt; 10 EMA &gt; 21 EMA.</p>
          </Tooltip>
        </div>
        <p className="mt-1 font-bold">{setup.trend.ema21 ? formatCurrency(setup.trend.ema21) : "—"}</p>
      </div>

      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <div className="flex items-center gap-1">
          <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">Risk</p>
          <Tooltip title="Risk Percentage">
            <p className="text-[10px] text-[#7b867f]">Distance from entry to stop loss as % of current price. Lower risk % = tighter stop.</p>
          </Tooltip>
        </div>
        <p className="mt-1 font-bold">{setup.riskPct.toFixed(1)}%</p>
      </div>

      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <div className="flex items-center gap-1">
          <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">R:R</p>
          <Tooltip title="Risk:Reward Ratio">
            <p className="text-[10px] text-[#7b867f]">Potential reward divided by risk. Target: ≥2:1. &lt;1.5:1 is considered poor.</p>
          </Tooltip>
        </div>
        <p className="mt-1 font-bold">{setup.rr.toFixed(1)}:1</p>
      </div>
    </div>
  );
}

function PullbackDetails({ setup }: { setup: EntryClassification }) {
  const pullback = setup.pullback;

  return (
    <div className="mt-4 rounded-xl border border-[#e4ebe6] bg-white p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#7b867f]">Pullback quality</p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] text-[#7b867f]">Depth</p>
          <p className="mt-1 font-bold">{pullback.depthPct.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-[#7b867f]">Volume</p>
          <p className="mt-1 font-bold">{(pullback.volumeRatio * 100).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-[#7b867f]">Volatility</p>
          <p className="mt-1 font-bold">{(pullback.volatilityRatio * 100).toFixed(0)}%</p>
        </div>
        <div>
          <p className="text-[10px] text-[#7b867f]">Higher low</p>
          <p className="mt-1 font-bold">{pullback.higherLow ? "Preserved" : "Weak"}</p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-[#66716a]">{pullback.evidence.join(" · ")}</p>
    </div>
  );
}
