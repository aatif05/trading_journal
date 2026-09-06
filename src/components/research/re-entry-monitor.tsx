import { type ReEntryClassification } from "@/lib/patterns";
import { formatCurrency } from "@/lib/trades";
import { StateBadge } from "./state-badge";
import { Tooltip } from "./tooltip";

type ReEntryCandidate = {
  trade: any;
  symbol: string;
  setup: ReEntryClassification;
};

type ReEntryMonitorProps = {
  candidates: ReEntryCandidate[];
};

export function ReEntryMonitor({ candidates }: ReEntryMonitorProps) {
  return (
    <section className="mt-4 rounded-2xl border border-[#ddd5f1] bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6049a4]">
            Open Trade / Re-entry Monitor
          </p>
          <h2 className="mt-1 text-xl font-bold">Separate re-entry engine</h2>
          <p className="mt-1 text-xs text-[#7b867f]">
            Only active positions are evaluated. Historical Pocket Pivots cannot create a current re-entry.
          </p>
        </div>
        <p className="text-xs text-[#7b867f]">{candidates.length} candidates</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {candidates.length ? (
          candidates.map(({ trade, symbol, setup }) => (
            <ReEntryCard key={`${trade.id}-${symbol}`} symbol={symbol} setup={setup} />
          ))
        ) : (
          <div className="rounded-xl bg-[#f7f9f7] p-4">
            <p className="text-sm font-semibold">No active re-entry setup.</p>
            <p className="mt-1 text-xs leading-5 text-[#7b867f]">
              The engine will wait for price to move above the original entry and then look for a healthy pullback, preserved structure and constructive confirmation.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ReEntryCard({ symbol, setup }: { symbol: string; setup: ReEntryClassification }) {
  return (
    <div className="rounded-2xl border border-[#ddd5f1] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{symbol}</p>
          <p className="mt-1 text-xs text-[#7b867f]">Current {formatCurrency(setup.current)}</p>
        </div>

        {/* DYNAMIC "WHY THIS SETUP" TOOLTIP */}
        <div className="flex items-center gap-2">
          <StateBadge state={setup.state} />
          <Tooltip title={`Why this is ${setup.state}`}>
            <div className="space-y-2 text-left">
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

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">Original entry</p>
          <p className="mt-1 font-bold">{formatCurrency(setup.originalEntry)}</p>
        </div>
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">Re-entry</p>
          <p className="mt-1 font-bold">{formatCurrency(setup.reEntry)}</p>
        </div>
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">Stop</p>
          <p className="mt-1 font-bold">{formatCurrency(setup.stop)}</p>
        </div>
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">Target</p>
          <p className="mt-1 font-bold">{formatCurrency(setup.target)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">Risk</p>
          <p className="mt-1 font-bold">{setup.riskPct.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">R:R</p>
          <p className="mt-1 font-bold">{setup.rr.toFixed(1)}:1</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#f7f9f7] p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#7b867f]">Re-entry checklist</p>
        <div className="mt-3 space-y-2 text-xs">
          <p>{setup.trend.healthy ? "✓" : "×"} Healthy trend</p>
          <p>{setup.pullback.healthy ? "✓" : "×"} Healthy pullback</p>
          <p>{setup.pullback.higherLow ? "✓" : "×"} Higher-low preserved</p>
          <p>{setup.pullback.contraction ? "✓" : "×"} Volume / volatility contraction</p>
          <p>{setup.pocketPivot ? "✓" : "×"} Fresh Pocket Pivot</p>
        </div>
      </div>
    </div>
  );
}
