"use client";

import { CloudOff, LockKeyhole, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { JournalToolbar } from "@/components/journal/journal-toolbar";
import { KpiGrid } from "@/components/journal/kpi-grid";
import { RiskWarning } from "@/components/journal/risk-warning";
import { TradeReview } from "@/components/journal/trade-review";
import { TradeTable } from "@/components/journal/trade-table";
import { useCapitalFlows } from "@/hooks/use-capital-flows";
import { usePriceRefresh } from "@/hooks/use-price-refresh";
import { useTrades } from "@/hooks/use-trades";
import { calculateCurrentCapital } from "@/lib/fund-management";
import {
  calculatePortfolio,
  calculateTrade,
  calculateTradeMetrics,
  ColumnKey,
  formatCurrency,
  Trade,
  tradeColumns,
} from "@/lib/trades";

export default function Home() {
  const {
    trades,
    setTrades,
    hydrated: tradesHydrated,
    addTrade,
    updateTrade,
    updateCmps,
  } = useTrades();
  const { flows, hydrated: flowsHydrated } = useCapitalFlows();
  const hydrated = tradesHydrated && flowsHydrated;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | "Active" | "Open" | "Partial" | "Closed">("Active");
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(
    () => new Set(tradeColumns.map((column) => column.key)),
  );

  const {
    refreshTrade,
    refreshOpenTrades,
    refreshingIds,
    refreshingAll,
    lastError,
    lastFetchedAt,
    clearError,
  } = usePriceRefresh(trades, updateCmps);

  const capital = useMemo(() => calculateCurrentCapital(trades, flows), [flows, trades]);
  const metrics = useMemo(() => calculatePortfolio(trades, capital), [capital, trades]);
  const tradeMetrics = useMemo(() => calculateTradeMetrics(trades, new Date(), capital), [capital, trades]);

  const filteredTrades = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...trades].sort((a, b) => Number(a.tradeNo) - Number(b.tradeNo)).filter((trade) => {
      const positionStatus = calculateTrade(trade).positionStatus;
      const matchesStatus =
        status === "All" ||
        (status === "Active" && positionStatus !== "Closed") ||
        positionStatus === status;
      const searchableText = [
        trade.name,
        trade.setup,
        trade.entryType,
        trade.quickNote,
        trade.tslGroups,
        trade.tradeNo,
      ]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .join(" ");
      const matchesQuery =
        !normalizedQuery || searchableText.includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [query, status, trades]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleAddTrade = () => {
    addTrade();
  };

  const handleUpdateTrade = (id: string, patch: Partial<Trade>) => {
    updateTrade(id, patch);
    const existingTrade = trades.find((trade) => trade.id === id);
    const candidate = existingTrade ? { ...existingTrade, ...patch } : null;
    const setupFieldChanged = patch.name !== undefined || patch.entry !== undefined || patch.initialQty !== undefined;
    if (candidate?.name.trim() && candidate.entry > 0 && candidate.initialQty > 0 && setupFieldChanged) {
      void refreshTrade(candidate);
    }
  };

  const fetchedLabel = lastFetchedAt
    ? new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(lastFetchedAt))
    : null;

  return (
    <main className="min-h-screen bg-[#f7f8fa] pb-20">
      <header className="border-b border-[#e7ebe8] bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#18251e] text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Ledgerly</h1>
              <p className="text-[9px] uppercase tracking-[0.14em] text-[#929a95]">
                Trading journal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#e5e9e6] bg-[#fafbfa] px-3 py-1.5 text-[10px] font-medium text-[#69716c]">
            {hydrated ? (
              <LockKeyhole className="h-3 w-3 text-[#1b9762]" />
            ) : (
              <CloudOff className="h-3 w-3" />
            )}
            {hydrated ? "Private · synced to Neon" : "Loading journal…"}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
        <RiskWarning metrics={tradeMetrics} />
  <JournalToolbar
          query={query}
          onQueryChange={setQuery}
          status={status}
          onStatusChange={setStatus}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          trades={trades}
          onImport={(imported) => setTrades(imported)}
          onAdd={handleAddTrade}
          onRefreshPrices={refreshOpenTrades}
          refreshingPrices={refreshingAll}
        />

        {(lastError || fetchedLabel) && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px] ${
              lastError
                ? "border-[#f0d5da] bg-[#fff7f8] text-[#b44357]"
                : "border-[#d7eee3] bg-[#f3fbf7] text-[#1a7d55]"
            }`}
          >
            <span>
              {lastError
                ? lastError
                : `Live CMPs updated at ${fetchedLabel} via Strike Money`}
            </span>
            {lastError && (
              <button
                type="button"
                onClick={clearError}
                className="rounded-md px-2 py-1 font-semibold hover:bg-white/70"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        <KpiGrid metrics={metrics} rows={tradeMetrics} />
        {tradeMetrics.filter((metric) => metric.positionStatus === "Closed").slice(0, 1).map((metric) => { const trade = trades.find((item) => item.id === metric.id); return trade ? <TradeReview key={trade.id} trade={trade} metric={metric} /> : null; })}

        <section className="overflow-hidden rounded-2xl border border-[#e5e9e6] bg-white shadow-[0_2px_8px_rgba(24,40,30,0.035)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9ecea] bg-[#fbfcfb] px-4 py-2.5 text-[10px] text-[#777f7a]">
            <span>
              Showing <strong className="text-[#303a34]">{filteredTrades.length}</strong> of{" "}
              <strong className="text-[#303a34]">{trades.length}</strong> trades
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25a66b]" />
              Portfolio capital: <strong>{formatCurrency(capital, 0)}</strong>
            </span>
          </div>
          <TradeTable
            trades={filteredTrades}
            capital={capital}
            visibleColumns={visibleColumns}
            onUpdate={handleUpdateTrade}
            onAdd={handleAddTrade}
            onRefreshCmp={refreshTrade}
            refreshingIds={refreshingIds}
          />
        </section>
      </div>

      <BottomNav />
    </main>
  );
}
