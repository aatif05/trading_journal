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

  const persistTrades = useCallback((nextTrades: Trade[]) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeTrades(nextTrades));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage may be unavailable or quota-limited; keep the in-memory journal usable.
    }
  }, []);

  const replaceTrades = useCallback((nextTrades: Trade[]) => {
    tradesRef.current = nextTrades;
    setTrades(nextTrades);
    persistTrades(nextTrades);
  }, [persistTrades]);

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
    const nextTrades = tradesRef.current.map((trade) =>
      trade.id === id ? { ...trade, ...patch } : trade,
    );
    replaceTrades(nextTrades);
  }, [replaceTrades]);

  const updateCmps = useCallback((updates: Array<{ id: string; cmp: number }>) => {
    if (!updates.length) return;
    const byId = new Map(updates.map((update) => [update.id, update.cmp]));
    const nextTrades = tradesRef.current.map((trade) =>
      byId.has(trade.id) ? { ...trade, cmp: byId.get(trade.id)! } : trade,
    );
    replaceTrades(nextTrades);
  }, [replaceTrades]);

  const deleteTrade = useCallback((id: string) => {
    replaceTrades(tradesRef.current.filter((trade) => trade.id !== id));
  }, [replaceTrades]);

  return {
    trades,
    setTrades: replaceTrades,
    hydrated,
    addTrade,
    updateTrade,
    updateCmps,
    deleteTrade,
  };
}
