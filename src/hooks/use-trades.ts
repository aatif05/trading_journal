"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculatePortfolio,
  createTrade,
  demoTrades,
  LEGACY_STORAGE_KEY,
  parseStoredTrades,
  serializeTrades,
  STORAGE_KEY,
  Trade,
} from "@/lib/trades";

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>(demoTrades);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored =
      parseStoredTrades(window.localStorage.getItem(STORAGE_KEY)) ??
      parseStoredTrades(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    const hydrate = window.setTimeout(() => {
      if (stored) setTrades(stored);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(hydrate);
  }, []);

  useEffect(() => {
    if (hydrated) {
      window.localStorage.setItem(STORAGE_KEY, serializeTrades(trades));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  }, [hydrated, trades]);

  const addTrade = useCallback(() => {
    setTrades((current) => [...current, createTrade(current)]);
  }, []);

  const updateTrade = useCallback((id: string, patch: Partial<Trade>) => {
    setTrades((current) =>
      current.map((trade) => (trade.id === id ? { ...trade, ...patch } : trade)),
    );
  }, []);

  const updateCmps = useCallback((updates: Array<{ id: string; cmp: number }>) => {
    if (!updates.length) return;
    const byId = new Map(updates.map((update) => [update.id, update.cmp]));
    setTrades((current) =>
      current.map((trade) =>
        byId.has(trade.id) ? { ...trade, cmp: byId.get(trade.id)! } : trade,
      ),
    );
  }, []);

  const deleteTrade = useCallback((id: string) => {
    setTrades((current) => current.filter((trade) => trade.id !== id));
  }, []);

  const reset = useCallback(() => setTrades(demoTrades), []);
  const metrics = useMemo(() => calculatePortfolio(trades), [trades]);

  return {
    trades,
    setTrades,
    metrics,
    hydrated,
    addTrade,
    updateTrade,
    updateCmps,
    deleteTrade,
    reset,
  };
}
