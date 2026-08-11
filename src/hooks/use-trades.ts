"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createTrade,
  LEGACY_STORAGE_KEY,
  parseStoredTrades,
  serializeTrades,
  STORAGE_KEY,
  Trade,
} from "@/lib/trades";

export function useTrades() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const tradesRef = useRef<Trade[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored =
      parseStoredTrades(window.localStorage.getItem(STORAGE_KEY)) ??
      parseStoredTrades(window.localStorage.getItem(LEGACY_STORAGE_KEY));
    const hydrate = window.setTimeout(() => {
      if (stored) {
        tradesRef.current = stored;
        setTrades(stored);
      }
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
    const nextTrade = createTrade(tradesRef.current);
    const nextTrades = [...tradesRef.current, nextTrade];
    tradesRef.current = nextTrades;
    setTrades(nextTrades);
    return nextTrade;
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

  return {
    trades,
    setTrades,
    hydrated,
    addTrade,
    updateTrade,
    updateCmps,
    deleteTrade,
  };
}
