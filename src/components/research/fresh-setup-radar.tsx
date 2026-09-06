import { type EntryClassification } from "@/lib/patterns";
import { formatCurrency } from "@/lib/trades";
import { StateBadge } from "./state-badge";
import { Tooltip } from "./tooltip";
import { Info } from "lucide-react";

type FreshSetup = {
  symbol: string;
  setup: EntryClassification;
};

type FreshSetupRadarProps = {
  setups: FreshSetup[];
};

export function FreshSetupRadar({ setups }: FreshSetupRadarProps) {
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
        <p className="text-xs text-[#7b867f]">{setups.length} setups</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {setups.length ? (
          setups.map(({ symbol, setup }) => (
            <FreshSetupCard key={symbol} symbol={symbol} setup={setup} />
          ))
        ) : (
          <p className="text-sm text-[#66716a]">
            No complete fresh setup is currently available.
          </p>
        )}
      </div>
    </section>
  );
}

function FreshSetupCard({ symbol, setup }: { symbol: string; setup: EntryClassification }) {
  return (
    <div className="rounded-2xl border border-[#e1e8e3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{symbol}</p>
          <p className="mt-1 text-xs text-[#7b867f]">
            Score {setup.score}/100 · CMP {formatCurrency(setup.entry)}
          </p>
        </div>
        
        {/* DYNAMIC "WHY THIS SETUP" TOOLTIP */}
        <div className="flex items-center gap-2">
          <StateBadge state={setup.state} />
          <Tooltip title={`Why this is ${setup.state}`}>
            <div className="space-y-2 text-left">
              <p className="font-semibold text-[#202923]">Score: {setup.score}/100</p>
              <p className="font-semibold text-[#202923]">Key Drivers:</p>
              <ul className="list-disc pl-4 space-y-1 text-[#66716a]">
                {setup.evidence.slice(0, 5).map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
            </div>
          </Tooltip>
        </div>
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
    </div>
  );
}

function SetupMetrics({ setup }: { setup: EntryClassification }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">10 EMA</p>
        <p className="mt-1 font-bold">{setup.trend.ema10 ? formatCurrency(setup.trend.ema10) : "—"}</p>
      </div>
      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">21 EMA</p>
        <p className="mt-1 font-bold">{setup.trend.ema21 ? formatCurrency(setup.trend.ema21) : "—"}</p>
      </div>
      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">Risk</p>
        <p className="mt-1 font-bold">{setup.riskPct.toFixed(1)}%</p>
      </div>
      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">R:R</p>
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
    </div>
  );
}
