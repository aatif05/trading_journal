"use client";

import { CloudOff, LockKeyhole, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { JournalToolbar } from "@/components/journal/journal-toolbar";
import { KpiGrid } from "@/components/journal/kpi-grid";
import { RiskWarning } from "@/components/journal/risk-warning";
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
    const wasClosed = existingTrade ? calculateTrade(existingTrade).positionStatus === "Closed" : false;
    const isClosed = candidate ? calculateTrade(candidate).positionStatus === "Closed" : false;
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
    <main className="min-h-screen bg-[#f4f6f3] pb-20">
      <header className="border-b border-[#273a31] bg-[#14211b] text-white shadow-[0_8px_24px_rgba(13,28,20,0.12)]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#c7f36a] text-[#14211b] shadow-[0_4px_14px_rgba(199,243,106,0.2)]">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-sm font-extrabold tracking-tight">Ledgerly</h1>
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#98aaa0]">
                Trading journal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#40564a] bg-[#1c2c24] px-3 py-1.5 text-[10px] font-semibold text-[#b9c8bf]">
            {hydrated ? (
              <LockKeyhole className="h-3 w-3 text-[#c7f36a]" />
            ) : (
              <CloudOff className="h-3 w-3" />
            )}
            {hydrated ? "Private · synced to Neon" : "Loading journal…"}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-3 py-5 sm:px-6 sm:py-7">
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
        <section className="overflow-hidden rounded-2xl border border-[#dbe4dd] bg-white shadow-[0_12px_30px_rgba(19,39,28,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e5ebe7] bg-[#f8faf8] px-4 py-3 text-[10px] font-medium text-[#718078]">
            <span>
              Showing <strong className="text-[#303a34]">{filteredTrades.length}</strong> of{" "}
              <strong className="text-[#303a34]">{trades.length}</strong> trades
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#79c78f] shadow-[0_0_0_3px_rgba(121,199,143,0.14)]" />
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
