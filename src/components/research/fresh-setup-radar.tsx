import { type EntryClassification } from "@/lib/patterns";
import { formatCurrency } from "@/lib/trades";
import { StateBadge } from "./state-badge";

type FreshSetup = {
  symbol: string;
  setup: EntryClassification;
};

type FreshSetupRadarProps = {
  setups: FreshSetup[];
};

function priorityTier(score: number) {
  if (score >= 90)
    return { label: "Priority A", cls: "bg-[#e5f7ed] text-[#087443]" };
  if (score >= 65)
    return { label: "Priority B", cls: "bg-[#edf6ff] text-[#1c5d91]" };
  return { label: "Watch", cls: "bg-[#f0f2f0] text-[#66716a]" };
}

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
  const tier = priorityTier(setup.score);

  return (
    <div className="rounded-2xl border border-[#e1e8e3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{symbol}</p>
          <p className="mt-1 text-xs text-[#7b867f]">
            Score {setup.score} · CMP {formatCurrency(setup.entry)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StateBadge state={setup.state} />
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide ${tier.cls}`}>
            {tier.label}
          </span>
        </div>
      </div>

      {/* PRIORITY DRIVERS */}
      <div className="mt-4 rounded-xl bg-[#f7f9f7] p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#7b867f]">
          Priority drivers
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <DriverChip ok={setup.shakeout.present} label="Shakeout & reclaim" />
          <DriverChip ok={setup.symmetry.present} label="Right-side symmetry" />
          <DriverChip ok={setup.buyZone.present} label="Buy zone / handle" />
          <DriverChip ok={setup.pocketPivot !== null} label="Pocket pivot" />
          <DriverChip ok={setup.pullback.contraction} label="Contraction" />
          <DriverChip ok={setup.trend.strong} label="Strong trend" />
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

      <p className="mt-3 text-xs leading-5 text-[#66716a]">{setup.evidence.join(" · ")}</p>
    </div>
  );
}

function DriverChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
        ok ? "bg-[#e5f7ed] text-[#087443]" : "bg-[#f0f2f0] text-[#9aa39d]"
      }`}
    >
      {ok ? "✓" : "×"} {label}
    </span>
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
      <p className="mt-3 text-xs leading-5 text-[#66716a]">{pullback.evidence.join(" · ")}</p>
    </div>
  );
}
