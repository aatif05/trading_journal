"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  PatternMiniChart,
} from "@/components/research/pattern-mini-chart";

import {
  classifyEntrySetup,
  classifyReEntry,
  detectHealthyTrend,
  detectHealthyPullback,
} from "@/lib/patterns";

import type {
  EntryClassification,
  PatternCandidate,
  ReEntryClassification,
  ThemeSummary,
} from "@/lib/patterns";

import {
  AlertTriangle,
  BrainCircuit,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  BottomNav,
} from "@/components/layout/bottom-nav";

import {
  useTrades,
} from "@/hooks/use-trades";

import {
  fetchLatestPrices,
} from "@/lib/prices";

import type {
  PriceTick,
} from "@/lib/prices";

import {
  findMissingStopLossTrades,
  momentumSignal,
  safePercent,
} from "@/lib/risk";

import {
  calculateTradeMetrics,
  formatCurrency,
} from "@/lib/trades";

const CHART_WINDOW = 45;

const STATE_CLASS: Record<
  string,
  string
> = {
  ENTRY:
    "bg-[#e5f7ed] text-[#087443]",
  "STRONG WATCH":
    "bg-[#edf6ff] text-[#1c5d91]",
  "HEALTHY PULLBACK":
    "bg-[#fff6df] text-[#8b6414]",
  "EXTENDED — DON'T CHASE":
    "bg-[#fff0e8] text-[#a64a20]",
  "RE-ENTRY WATCH":
    "bg-[#eeeaff] text-[#5c45a5]",
  BREAKDOWN:
    "bg-[#ffe9ed] text-[#ad3044]",
};

function StateBadge({
  state,
}: {
  state: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wide ${
        STATE_CLASS[state] ??
        "bg-[#f0f2f0] text-[#66716a]"
      }`}
    >
      {state}
    </span>
  );
}

function SetupMetrics({
  setup,
}: {
  setup: EntryClassification;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">
          10 EMA
        </p>
        <p className="mt-1 font-bold">
          {setup.trend.ema10
            ? formatCurrency(
                setup.trend.ema10,
              )
            : "—"}
        </p>
      </div>

      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">
          21 EMA
        </p>
        <p className="mt-1 font-bold">
          {setup.trend.ema21
            ? formatCurrency(
                setup.trend.ema21,
              )
            : "—"}
        </p>
      </div>

      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">
          Risk
        </p>
        <p className="mt-1 font-bold">
          {setup.riskPct.toFixed(1)}%
        </p>
      </div>

      <div className="rounded-xl bg-[#f7f9f7] p-3">
        <p className="text-[10px] uppercase tracking-wide text-[#7b867f]">
          R:R
        </p>
        <p className="mt-1 font-bold">
          {setup.rr.toFixed(1)}:1
        </p>
      </div>
    </div>
  );
}

function PullbackDetails({
  setup,
}: {
  setup: EntryClassification;
}) {
  const pullback =
    setup.pullback;

  return (
    <div className="mt-4 rounded-xl border border-[#e4ebe6] bg-white p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#7b867f]">
        Pullback quality
      </p>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <p className="text-[10px] text-[#7b867f]">
            Depth
          </p>
          <p className="mt-1 font-bold">
            {pullback.depthPct.toFixed(1)}%
          </p>
        </div>

        <div>
          <p className="text-[10px] text-[#7b867f]">
            Volume
          </p>
          <p className="mt-1 font-bold">
            {(pullback.volumeRatio * 100).toFixed(
              0,
            )}%
          </p>
        </div>

        <div>
          <p className="text-[10px] text-[#7b867f]">
            Volatility
          </p>
          <p className="mt-1 font-bold">
            {(pullback.volatilityRatio * 100).toFixed(
              0,
            )}%
          </p>
        </div>

        <div>
          <p className="text-[10px] text-[#7b867f]">
            Higher low
          </p>
          <p className="mt-1 font-bold">
            {pullback.higherLow
              ? "Preserved"
              : "Weak"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-[#66716a]">
        {pullback.evidence.join(
          " · ",
        )}
      </p>
    </div>
  );
}

function FreshSetupCard({
  symbol,
  setup,
}: {
  symbol: string;
  setup: EntryClassification;
}) {
  return (
    <div className="rounded-2xl border border-[#e1e8e3] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {symbol}
          </p>

          <p className="mt-1 text-xs text-[#7b867f]">
            Score {setup.score}/100 · CMP{" "}
            {formatCurrency(
              setup.entry,
            )}
          </p>
        </div>

        <StateBadge
          state={setup.state}
        />
      </div>

      <SetupMetrics setup={setup} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">
            Structural stop
          </p>
          <p className="mt-1 font-bold">
            {formatCurrency(
              setup.stop,
            )}
          </p>
        </div>

        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">
            Projected target
          </p>
          <p className="mt-1 font-bold">
            {formatCurrency(
              setup.target,
            )}
          </p>
        </div>
      </div>

      <PullbackDetails setup={setup} />

      {setup.pocketPivot && (
        <div className="mt-3 rounded-xl border border-[#bfe5cf] bg-[#f1fbf5] p-3">
          <p className="text-xs font-extrabold text-[#087443]">
            FRESH POCKET PIVOT
          </p>

          <p className="mt-1 text-xs text-[#47715b]">
            {setup.pocketPivot.evidence.join(
              " · ",
            )}
          </p>
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-[#66716a]">
        {setup.evidence.join(
          " · ",
        )}
      </p>
    </div>
  );
}

function ReEntryCard({
  symbol,
  setup,
}: {
  symbol: string;
  setup: ReEntryClassification;
}) {
  return (
    <div className="rounded-2xl border border-[#ddd5f1] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">
            {symbol}
          </p>

          <p className="mt-1 text-xs text-[#7b867f]">
            Current{" "}
            {formatCurrency(
              setup.current,
            )}
          </p>
        </div>

        <StateBadge
          state={setup.state}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">
            Original entry
          </p>
          <p className="mt-1 font-bold">
            {formatCurrency(
              setup.entry,
            )}
          </p>
        </div>

        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">
            Stop
          </p>
          <p className="mt-1 font-bold">
            {formatCurrency(
              setup.stop,
            )}
          </p>
        </div>

        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">
            Target
          </p>
          <p className="mt-1 font-bold">
            {formatCurrency(
              setup.target,
            )}
          </p>
        </div>

        <div className="rounded-xl bg-[#f7f9f7] p-3">
          <p className="text-[10px] uppercase text-[#7b867f]">
            R:R
          </p>
          <p className="mt-1 font-bold">
            {setup.rr.toFixed(1)}:1
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-[#f7f9f7] p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[#7b867f]">
          Re-entry checklist
        </p>

        <div className="mt-3 space-y-2 text-xs">
          <p>
            {setup.trend.healthy
              ? "✓"
              : "×"}{" "}
            Healthy trend
          </p>

          <p>
            {setup.pullback.healthy
              ? "✓"
              : "×"}{" "}
            Healthy pullback
          </p>

          <p>
            {setup.pullback.higherLow
              ? "✓"
              : "×"}{" "}
            Higher-low preserved
          </p>

          <p>
            {setup.pullback.contraction
              ? "✓"
              : "×"}{" "}
            Volume / volatility contraction
          </p>

          <p>
            {setup.pocketPivot
              ? "✓"
              : "×"}{" "}
            Fresh Pocket Pivot
          </p>

          <p>
            {setup.rr >= 2
              ? "✓"
              : "×"}{" "}
            R:R ≥ 2:1
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-[#66716a]">
        {setup.evidence.join(
          " · ",
        )}
      </p>
    </div>
  );
}

export default function ResearchPage() {
  const {
    trades,
  } = useTrades();

  const symbols =
    useMemo(
      () =>
        [
          ...new Set(
            trades
              .map((t) =>
                t.name
                  .trim()
                  .toUpperCase(),
              )
              .filter(Boolean),
          ),
        ],
      [trades],
    );

  const [
    symbol,
    setSymbol,
  ] = useState("");

  const [
    price,
    setPrice,
  ] = useState<
    number | null
  >(null);

  const [
    previous,
    setPrevious,
  ] = useState<
    number | null
  >(null);

  const [
    status,
    setStatus,
  ] = useState(
    "Select a symbol to begin research.",
  );

  const [
    aiText,
    setAiText,
  ] = useState("");

  const [
    aiLoading,
    setAiLoading,
  ] = useState(false);

  const [
    patterns,
    setPatterns,
  ] = useState<
    PatternCandidate[]
  >([]);

  const [
    marketSeries,
    setMarketSeries,
  ] = useState<
    {
      symbol: string;
      ticks: PriceTick[];
    }[]
  >([]);

  const [
    themes,
    setThemes,
  ] = useState<
    ThemeSummary[]
  >([]);

  const [
    marketStatus,
    setMarketStatus,
  ] = useState(
    "Loading candle history…",
  );

  /*
   * Load market history for all symbols
   * represented in the journal.
   */
  useEffect(() => {
    if (!symbols.length) {
      setMarketSeries([]);
      setPatterns([]);
      return;
    }

    fetch(
      `/api/research/market?symbols=${encodeURIComponent(
        symbols.join(","),
      )}`,
    )
      .then((response) =>
        response.json(),
      )
      .then((data) => {
        setPatterns(
          data.patterns ?? [],
        );

        setMarketSeries(
          data.series ?? [],
        );

        setThemes(
          data.themes ?? [],
        );

        setMarketStatus(
          data.series?.length
            ? `Daily history loaded · ${new Date(
                data.fetchedAt,
              ).toLocaleTimeString()}`
            : "No daily history available",
        );
      })
      .catch(() =>
        setMarketStatus(
          "Market history unavailable",
        ),
      );
  }, [symbols]);

  /*
   * Theme context.
   */
  const myThemes =
    useMemo(
      () =>
        [
          ...new Set(
            trades
              .map((trade) =>
                trade.name
                  .trim()
                  .toUpperCase(),
              )
              .filter(Boolean),
          ),
        ]
          .map(
            (item) =>
              themes.find(
                (theme) =>
                  theme.symbols.includes(
                    item,
                  ),
              )?.theme ??
              "Unclassified",
          )
          .filter(
            (
              item,
              index,
              all,
            ) =>
              all.indexOf(item) ===
              index,
          ),
      [themes, trades],
    );

  const selectedTrade =
    trades.find(
      (t) =>
        t.name
          .trim()
          .toUpperCase() ===
        symbol,
    );

  const change =
    price !== null &&
    previous !== null &&
    previous !== 0
      ? ((price -
          previous) /
          previous) *
        100
      : null;

  const signal =
    momentumSignal(
      change,
    );

  const metrics =
    calculateTradeMetrics(
      trades,
    );

  const missingSL =
    findMissingStopLossTrades(
      metrics,
    );

  /*
   * ============================================================
   * FRESH SETUP RADAR
   * ============================================================
   *
   * This is completely independent of open trades.
   *
   * Every symbol gets evaluated through:
   *
   * Trend
   * EMA10/EMA21
   * Pullback
   * Contraction
   * Structure
   * Pocket Pivot
   * R:R
   */
  const freshSetupRadar =
    useMemo(
      () =>
        marketSeries
          .map((market) => {
            const setup =
              classifyEntrySetup(
                market.ticks,
              );

            return {
              symbol:
                market.symbol,
              setup,
            };
          })
          .filter(
            (
              item,
            ): item is {
              symbol: string;
              setup: EntryClassification;
            } =>
              item.setup !== null,
          )
          .sort(
            (a, b) =>
              b.setup.score -
              a.setup.score,
          ),
      [marketSeries],
    );

  /*
   * ============================================================
   * OPEN TRADE / RE-ENTRY MONITOR
   * ============================================================
   *
   * Only existing/open trades enter this engine.
   *
   * No standalone historical Pocket Pivot.
   * No MA20-only re-entry.
   * No tight-range-only re-entry.
   */
  const reentryCandidates =
    useMemo(
      () =>
        metrics
          .filter(
            (trade) =>
              trade.positionStatus !==
                "Closed" &&
              trade.sl > 0,
          )
          .map((trade) => {
            const tradeSymbol =
              trade.name
                .trim()
                .toUpperCase();

            const market =
              marketSeries.find(
                (item) =>
                  item.symbol ===
                  tradeSymbol,
              );

            if (!market) {
              return null;
            }

            const setup =
              classifyReEntry(
                market.ticks,
                trade.entry,
                trade.sl,
              );

            if (!setup) {
              return null;
            }

            /*
             * Only display a genuine re-entry
             * watch / entry.
             *
             * Do not fill the section with
             * ordinary healthy stocks.
             */
            if (
              setup.state !==
                "RE-ENTRY WATCH" &&
              setup.state !==
                "ENTRY"
            ) {
              return null;
            }

            return {
              trade,
              symbol:
                tradeSymbol,
              setup,
            };
          })
          .filter(
            (
              item,
            ): item is {
              trade: (typeof metrics)[number];
              symbol: string;
              setup: ReEntryClassification;
            } =>
              item !== null,
          )
          .sort(
            (a, b) =>
              b.setup.rr -
              a.setup.rr,
          ),
      [metrics, marketSeries],
    );

  /*
   * ============================================================
   * REFRESH LIVE QUOTE
   * ============================================================
   */
  async function refresh() {
    if (!symbol) return;

    setStatus(
      "Refreshing market data…",
    );

    try {
      const result =
        await fetchLatestPrices([
          symbol,
        ]);

      setPrevious(price);

      setPrice(
        result[symbol] ??
          null,
      );

      setStatus(
        result[symbol]
          ? "Live quote loaded from the existing price API."
          : "No recent quote available; showing no-data state.",
      );
    } catch {
      setStatus(
        "Market data unavailable. Try again later.",
      );
    }
  }

  /*
   * ============================================================
   * AI RESEARCH
   * ============================================================
   */
  async function askAI(
    mode:
      | "analysis"
      | "ideas",
  ) {
    if (!symbol) return;

    setAiLoading(true);
    setAiText("");

    try {
      const response =
        await fetch(
          "/api/research",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              symbol,
              mode,
              inputs: {
                price,
                changePercent:
                  change,
                sector:
                  "Unavailable from existing price API",
                stopLoss:
                  selectedTrade?.sl ??
                  null,
              },
            }),
          },
        );

      const result =
        await response.json();

      setAiText(
        result.text ??
          result.error ??
          "Research unavailable.",
      );
    } catch {
      setAiText(
        "Research unavailable. Check the connection and try again.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  /*
   * Selected-symbol setup.
   */
  const selectedSetup =
    useMemo(() => {
      if (!symbol) {
        return null;
      }

      const market =
        marketSeries.find(
          (item) =>
            item.symbol ===
            symbol,
        );

      return market
        ? classifyEntrySetup(
            market.ticks,
          )
        : null;
    }, [
      symbol,
      marketSeries,
    ]);

  return (
    <main className="min-h-screen bg-[#f7f9f7] pb-28 text-[#202923]">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#11885c]">
              Research desk
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Context before conviction
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#66716a]">
              Trend → pullback → confirmation.
              Fresh setups and open-trade
              re-entries are evaluated by
              separate engines.
            </p>
          </div>

          <div className="flex gap-2">
            <select
              value={symbol}
              onChange={(e) =>
                setSymbol(
                  e.target.value,
                )
              }
              className="rounded-xl border border-[#dfe6e1] bg-white px-3 py-2 text-sm"
            >
              <option value="">
                Choose symbol
              </option>

              {symbols.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ),
              )}
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

        {missingSL.length >
          0 && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-[#f0c7a9] bg-[#fff8f1] p-4 text-[#8c4e18]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-bold">
                {
                  missingSL.length
                }{" "}
                active trade
                {missingSL.length ===
                1
                  ? ""
                  : "s"}{" "}
                missing a stop loss
              </p>

              <p className="mt-1 text-sm">
                Risk percentages
                exclude these
                positions until an
                SL is recorded:{" "}
                {missingSL
                  .map(
                    (t) =>
                      `#${t.tradeNo} ${t.name}`,
                  )
                  .join(
                    ", ",
                  )}
                .
              </p>
            </div>
          </div>
        )}

        {/* =====================================================
            FRESH SETUP RADAR
        ====================================================== */}

        <section className="mt-6 rounded-2xl border border-[#cfe0d5] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#11885c]">
                Fresh Setup Radar
              </p>

              <h2 className="mt-1 text-xl font-bold">
                New entry lifecycle
              </h2>

              <p className="mt-1 text-xs text-[#7b867f]">
                No existing position required.
                Every setup is evaluated from
                trend through risk/reward.
              </p>
            </div>

            <p className="text-xs text-[#7b867f]">
              {
                freshSetupRadar.length
              }{" "}
              setups
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {freshSetupRadar.length ? (
              freshSetupRadar.map(
                ({
                  symbol,
                  setup,
                }) => (
                  <FreshSetupCard
                    key={symbol}
                    symbol={symbol}
                    setup={setup}
                  />
                ),
              )
            ) : (
              <p className="text-sm text-[#66716a]">
                No complete fresh setup
                is currently available.
              </p>
            )}
          </div>

          <p className="mt-4 text-xs text-[#7b867f]">
            ENTRY requires a healthy trend,
            healthy pullback, fresh
            confirmation and acceptable
            R:R. These are heuristic
            decision-support states, not
            trade recommendations.
          </p>
        </section>

        {/* =====================================================
            OPEN TRADE / RE-ENTRY MONITOR
        ====================================================== */}

        <section className="mt-4 rounded-2xl border border-[#ddd5f1] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6049a4]">
                Open Trade / Re-entry Monitor
              </p>

              <h2 className="mt-1 text-xl font-bold">
                Separate re-entry engine
              </h2>

              <p className="mt-1 text-xs text-[#7b867f]">
                Only active positions are
                evaluated. Historical Pocket
                Pivots cannot create a current
                re-entry.
              </p>
            </div>

            <p className="text-xs text-[#7b867f]">
              {
                reentryCandidates.length
              }{" "}
              candidates
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {reentryCandidates.length ? (
              reentryCandidates.map(
                ({
                  trade,
                  symbol,
                  setup,
                }) => (
                  <ReEntryCard
                    key={`${trade.id}-${symbol}`}
                    symbol={symbol}
                    setup={setup}
                  />
                ),
              )
            ) : (
              <div className="rounded-xl bg-[#f7f9f7] p-4">
                <p className="text-sm font-semibold">
                  No active re-entry setup.
                </p>

                <p className="mt-1 text-xs leading-5 text-[#7b867f]">
                  The engine will wait for a
                  proper pullback, preserved
                  structure, confirmation and
                  acceptable R:R.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* =====================================================
            SELECTED SYMBOL SUMMARY
        ====================================================== */}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <p className="text-xs font-bold uppercase text-[#7b867f]">
              CMP
            </p>

            <p className="mt-3 text-2xl font-bold">
              {price === null
                ? "—"
                : formatCurrency(
                    price,
                  )}
            </p>

            <p className="mt-1 text-xs text-[#7b867f]">
              {status}
            </p>
          </section>

          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <p className="text-xs font-bold uppercase text-[#7b867f]">
              Momentum
            </p>

            <p className="mt-3 flex items-center gap-2 text-xl font-bold">
              {signal.tone ===
              "negative" ? (
                <TrendingDown className="h-5 w-5" />
              ) : (
                <TrendingUp className="h-5 w-5" />
              )}

              {signal.label}
            </p>

            <p className="mt-1 text-xs text-[#7b867f]">
              {change === null
                ? "No comparison data"
                : `${change.toFixed(
                    2,
                  )}% since last refresh`}
            </p>
          </section>

          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <p className="text-xs font-bold uppercase text-[#7b867f]">
              Setup state
            </p>

            <div className="mt-3">
              {selectedSetup ? (
                <StateBadge
                  state={
                    selectedSetup.state
                  }
                />
              ) : (
                <p className="text-xl font-bold">
                  —
                </p>
              )}
            </div>

            <p className="mt-2 text-xs text-[#7b867f]">
              {selectedSetup
                ? `Score ${selectedSetup.score} · R:R ${selectedSetup.rr.toFixed(
                    1,
                  )}:1`
                : "Select a symbol with available history"}
            </p>
          </section>

          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <p className="text-xs font-bold uppercase text-[#7b867f]">
              Risk context
            </p>

            <p className="mt-3 text-xl font-bold">
              {selectedTrade?.sl
                ? "SL recorded"
                : "Needs SL"}
            </p>

            <p className="mt-1 text-xs text-[#7b867f]">
              {selectedTrade?.sl
                ? `${safePercent(
                    Math.abs(
                      (selectedTrade.entry -
                        selectedTrade.sl) *
                        selectedTrade.initialQty,
                    ),
                    selectedTrade.entry *
                      selectedTrade.initialQty,
                  )?.toFixed(
                    2,
                  )}% entry risk`
                : "No default risk invented"}
            </p>
          </section>
        </div>

        {/* =====================================================
            SELECTED SYMBOL DETAIL
        ====================================================== */}

        {selectedSetup && (
          <section className="mt-4 rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b867f]">
                  Selected setup
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {symbol}
                </h2>
              </div>

              <StateBadge
                state={
                  selectedSetup.state
                }
              />
            </div>

            <SetupMetrics
              setup={selectedSetup}
            />

            <PullbackDetails
              setup={selectedSetup}
            />
          </section>
        )}

        {/* =====================================================
            PATTERN RADAR
        ====================================================== */}

        <section className="mt-4 rounded-2xl border border-[#e2e9e3] bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b867f]">
                Pattern Radar
              </p>

              <h2 className="mt-1 text-xl font-bold">
                Bases forming
              </h2>
            </div>

            <p className="text-xs text-[#7b867f]">
              {marketStatus}
            </p>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {marketSeries.length ? (
              marketSeries.map(
                (market) => {
                  const item =
                    patterns.find(
                      (candidate) =>
                        candidate.symbol ===
                        market.symbol,
                    );

                  const windowTicks =
                    market.ticks.slice(
                      -CHART_WINDOW,
                    );

                  const typedTicks:
                    PriceTick[] =
                    windowTicks;

                  const windowHighs =
                    windowTicks
                      .map(
                        (tick) =>
                          Number(
                            tick[2],
                          ),
                      )
                      .filter(
                        Number.isFinite,
                      );

                  const windowLows =
                    windowTicks
                      .map(
                        (tick) =>
                          Number(
                            tick[3],
                          ),
                      )
                      .filter(
                        Number.isFinite,
                      );

                  if (item) {
                    const ceiling =
                      Math.max(
                        item.breakoutLevel ??
                          -Infinity,
                        ...windowHighs,
                      );

                    const floor =
                      item.pattern ===
                        "Darvas Box" &&
                      item.stopLevel !=
                        null
                        ? Math.min(
                            item.stopLevel,
                            ...windowLows,
                          )
                        : Math.min(
                            ...windowLows,
                          );

                    const breakout =
                      item.breakoutLevel ??
                      ceiling;

                    return (
                      <div
                        key={
                          market.symbol
                        }
                        className="rounded-xl bg-[#f7f9f7] p-4"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold">
                              {
                                item.symbol
                              }{" "}
                              ·{" "}
                              {
                                item.pattern
                              }
                            </p>

                            <p className="mt-1 text-xs text-[#7b867f]">
                              Last{" "}
                              {
                                CHART_WINDOW
                              }{" "}
                              sessions ·
                              trigger{" "}
                              {item.breakoutLevel
                                ? formatCurrency(
                                    item.breakoutLevel,
                                  )
                                : "—"}
                            </p>
                          </div>

                          <span className="shrink-0 text-xs font-bold text-[#11885c]">
                            {
                              item.confidence
                            }{" "}
                            confidence
                          </span>
                        </div>

                        <div className="mt-3 h-64">
                          <PatternMiniChart
                            ticks={
                              typedTicks
                            }
                            ceiling={
                              ceiling
                            }
                            floor={
                              floor
                            }
                            breakout={
                              breakout
                            }
                            boxStart={
                              item.pattern ===
                              "Darvas Box"
                                ? item.boxStart
                                : undefined
                            }
                            boxEnd={
                              item.pattern ===
                              "Darvas Box"
                                ? item.boxEnd
                                : undefined
                            }
                          />
                        </div>

                        <p className="mt-2 text-sm text-[#66716a]">
                          {item.evidence.join(
                            " · ",
                          )}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={
                        market.symbol
                      }
                      className="rounded-xl bg-[#f7f9f7] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold">
                            {
                              market.symbol
                            }{" "}
                            · Pattern scan
                          </p>

                          <p className="mt-1 text-xs text-[#7b867f]">
                            No confirmed VCP
                            or Darvas setup
                            yet · last{" "}
                            {
                              CHART_WINDOW
                            }{" "}
                            of{" "}
                            {
                              market.ticks
                                .length
                            }{" "}
                            sessions
                          </p>
                        </div>

                        <span className="shrink-0 text-xs font-bold text-[#7b867f]">
                          Watching
                        </span>
                      </div>

                      {typedTicks.length >
                        0 && (
                        <div className="mt-3 h-64">
                          <PatternMiniChart
                            ticks={
                              typedTicks
                            }
                            ceiling={Math.max(
                              ...windowHighs,
                            )}
                            floor={Math.min(
                              ...windowLows,
                            )}
                            breakout={Math.max(
                              ...windowHighs,
                            )}
                          />
                        </div>
                      )}
                    </div>
                  );
                },
              )
            ) : patterns.length > 0 ? (
              patterns.map(
                (item) => (
                  <div
                    key={`${item.symbol}-${item.pattern}`}
                    className="rounded-xl bg-[#f7f9f7] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold">
                          {
                            item.symbol
                          }{" "}
                          ·{" "}
                          {
                            item.pattern
                          }
                        </p>

                        <p className="mt-1 text-xs text-[#7b867f]">
                          Base formation ·
                          trigger{" "}
                          {item.breakoutLevel
                            ? formatCurrency(
                                item.breakoutLevel,
                              )
                            : "—"}
                        </p>
                      </div>

                      <span className="shrink-0 text-xs font-bold text-[#11885c]">
                        {
                          item.confidence
                        }{" "}
                        confidence
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-[#66716a]">
                      {item.evidence.join(
                        " · ",
                      )}
                    </p>
                  </div>
                ),
              )
            ) : (
              <p className="text-sm text-[#66716a]">
                No VCP or Darvas
                candidates detected
                in the available
                history.
              </p>
            )}
          </div>

          <p className="mt-4 text-xs text-[#7b867f]">
            VCP and Darvas remain independent
            pattern detectors. Pocket Pivot does
            not modify them.
          </p>
        </section>

        {/* =====================================================
            THEME PULSE
        ====================================================== */}

        <section className="mt-4 rounded-2xl border border-[#e2e9e3] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b867f]">
            Theme pulse
          </p>

          <h2 className="mt-1 text-xl font-bold">
            Your themes vs leaders
          </h2>

          <p className="mt-2 text-sm text-[#66716a]">
            Traded themes:{" "}
            {myThemes.join(
              ", ",
            ) ||
              "None classified"}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {themes
              .slice(0, 6)
              .map(
                (theme) => (
                  <div
                    key={
                      theme.theme
                    }
                    className="flex items-center justify-between rounded-xl bg-[#f7f9f7] p-4"
                  >
                    <div>
                      <p className="font-semibold">
                        {
                          theme.theme
                        }
                      </p>

                      <p className="text-xs text-[#7b867f]">
                        Breadth{" "}
                        {theme.breadth.toFixed(
                          0,
                        )}
                        % ·{" "}
                        {
                          theme.momentum
                        }
                      </p>
                    </div>

                    <p
                      className={`font-bold ${
                        theme.return20d !==
                          null &&
                        theme.return20d >=
                          0
                          ? "text-[#11885c]"
                          : "text-[#c34f5e]"
                      }`}
                    >
                      {theme.return20d ===
                      null
                        ? "—"
                        : `${
                            theme.return20d >=
                            0
                              ? "+"
                              : ""
                          }${theme.return20d.toFixed(
                            2,
                          )}%`}
                    </p>
                  </div>
                ),
              )}

            {!themes.length && (
              <p className="text-sm text-[#66716a]">
                No theme history
                available yet.
              </p>
            )}
          </div>

          <p className="mt-4 text-xs text-[#7b867f]">
            20-session returns use the existing
            daily price API and conservative
            symbol-to-theme mapping.
          </p>
        </section>

        {/* =====================================================
            MARKET CONTEXT + AI
        ====================================================== */}

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-[#e2e9e3] bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7b867f]">
                  Market context
                </p>

                <h2 className="mt-1 text-xl font-bold">
                  {symbol ||
                    "Select a symbol"}
                </h2>
              </div>

              <Search className="h-5 w-5 text-[#7b867f]" />
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[#f7f9f7] p-4">
                <p className="text-xs text-[#7b867f]">
                  Trend
                </p>

                <p className="mt-2 font-bold">
                  {selectedSetup
                    ? selectedSetup.trend
                        .healthy
                      ? "Healthy"
                      : "Weak"
                    : change === null
                      ? "No data"
                      : change >=
                          0
                        ? "Higher"
                        : "Lower"}
                </p>
              </div>

              <div className="rounded-xl bg-[#f7f9f7] p-4">
                <p className="text-xs text-[#7b867f]">
                  Moving averages
                </p>

                <p className="mt-2 font-bold">
                  {selectedSetup
                    ? `10 ${formatCurrency(
                        selectedSetup.trend
                          .ema10 ??
                          0,
                      )} · 21 ${formatCurrency(
                        selectedSetup.trend
                          .ema21 ??
                          0,
                      )}`
                    : "Needs candle history"}
                </p>
              </div>

              <div className="rounded-xl bg-[#f7f9f7] p-4">
                <p className="text-xs text-[#7b867f]">
                  Pullback
                </p>

                <p className="mt-2 font-bold">
                  {selectedSetup
                    ? selectedSetup
                        .pullback
                        .healthy
                      ? "Healthy"
                      : "Not confirmed"
                    : "Needs candle history"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e2e9e3] bg-[#202923] p-5 text-white">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-[#7de2b3]" />

              <p className="font-bold">
                Research brief
              </p>
            </div>

            <p className="mt-3 text-sm leading-6 text-[#c7d1ca]">
              AI uses the visible market
              inputs. Technical setup states
              remain deterministic and are not
              replaced by AI.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  askAI(
                    "analysis",
                  )
                }
                disabled={
                  !symbol ||
                  aiLoading
                }
                className="rounded-xl bg-[#7de2b3] px-3 py-2 text-sm font-bold text-[#163b2b] disabled:opacity-40"
              >
                Analyze symbol
              </button>

              <button
                onClick={() =>
                  askAI("ideas")
                }
                disabled={
                  !symbol ||
                  aiLoading
                }
                className="rounded-xl border border-[#718079] px-3 py-2 text-sm font-bold disabled:opacity-40"
              >
                Opportunity view
              </button>
            </div>

            {aiLoading && (
              <p className="mt-4 text-sm text-[#c7d1ca]">
                Preparing cautious
                research…
              </p>
            )}

            {aiText && (
              <div className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[#29362f] p-4 font-sans text-sm leading-6 text-[#edf6ef]">
                {aiText
                  .replace(
                    /^```(?:json|markdown)?\s*|\s*```$/g,
                    "",
                  )
                  .replace(
                    /[{}\[\]"]/g,
                    "",
                  )
                  .replace(
                    /,\s*(?=[A-Za-z ]+:)/g,
                    "\n",
                  )}
              </div>
            )}
          </section>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
