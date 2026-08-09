"use client";

import { useCallback, useState } from "react";
import { fetchLatestPrices, normalizeSymbol } from "@/lib/prices";
import { Trade } from "@/lib/trades";

export function usePriceRefresh(
  trades: Trade[],
  onApply: (updates: Array<{ id: string; cmp: number }>) => void,
) {
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);

  const applyPrices = useCallback(
    (targets: Trade[], prices: Record<string, number>) => {
      const updates = targets.flatMap((trade) => {
        const cmp = prices[normalizeSymbol(trade.name)];
        return cmp === undefined ? [] : [{ id: trade.id, cmp }];
      });
      if (updates.length) onApply(updates);
      return updates.length;
    },
    [onApply],
  );

  const refreshTrade = useCallback(
    async (trade: Trade) => {
      const symbol = normalizeSymbol(trade.name);
      if (!symbol) {
        setLastError("Add a stock name before refreshing CMP.");
        return;
      }

      setLastError(null);
      setRefreshingIds((current) => new Set(current).add(trade.id));
      try {
        const prices = await fetchLatestPrices([symbol]);
        const updated = applyPrices([trade], prices);
        if (!updated) {
          setLastError(`No live price found for ${symbol}.`);
        } else {
          setLastFetchedAt(new Date().toISOString());
        }
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "CMP refresh failed");
      } finally {
        setRefreshingIds((current) => {
          const next = new Set(current);
          next.delete(trade.id);
          return next;
        });
      }
    },
    [applyPrices],
  );

  const refreshOpenTrades = useCallback(async () => {
    const openTrades = trades.filter(
      (trade) => trade.positionStatus === "Open" && normalizeSymbol(trade.name),
    );
    if (!openTrades.length) {
      setLastError("No open trades with stock names to refresh.");
      return;
    }

    setLastError(null);
    setRefreshingAll(true);
    try {
      const prices = await fetchLatestPrices(openTrades.map((trade) => trade.name));
      const updated = applyPrices(openTrades, prices);
      if (!updated) {
        setLastError("No live prices returned for open trades.");
      } else {
        setLastFetchedAt(new Date().toISOString());
        const missing = openTrades.filter(
          (trade) => prices[normalizeSymbol(trade.name)] === undefined,
        );
        if (missing.length) {
          setLastError(
            `Updated ${updated}. Missing: ${missing.map((trade) => trade.name).join(", ")}`,
          );
        }
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : "CMP refresh failed");
    } finally {
      setRefreshingAll(false);
    }
  }, [applyPrices, trades]);

  // AUTO-REFRESH: Runs every 5 minutes automatically
  useEffect(() => {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;

    const intervalId = setInterval(() => {
      // Only trigger auto-refresh if a refresh isn't already running
      if (!refreshingAll) {
        refreshOpenTrades();
      }
    }, FIVE_MINUTES_MS);

    return () => clearInterval(intervalId);
  }, [refreshOpenTrades, refreshingAll]);
  
  return {
    refreshTrade,
    refreshOpenTrades,
    refreshingIds,
    refreshingAll,
    lastError,
    lastFetchedAt,
    clearError: () => setLastError(null),
  };
}
