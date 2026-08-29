"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { createTrade, LEGACY_STORAGE_KEY, parseStoredTrades, STORAGE_KEY, Trade } from "@/lib/trades";

const fetcher = (url: string) => fetch(url).then((response) => { if (!response.ok) throw new Error("Unable to load journal"); return response.json(); });

export function useTrades() {
  const { data, error, mutate } = useSWR<{ trades: Trade[] }>("/api/journal", fetcher, { revalidateOnFocus: false, onSuccess: (remote) => {
    if (remote.trades.length === 0 && typeof window !== "undefined") {
      const local = parseStoredTrades(window.localStorage.getItem(STORAGE_KEY)) ?? parseStoredTrades(window.localStorage.getItem(LEGACY_STORAGE_KEY));
      if (local?.length) void fetch("/api/journal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trades: local }) }).then(() => mutate({ trades: local }, false));
    }
  } });
  const trades = useMemo(() => data?.trades ?? [], [data?.trades]);
  const persist = useCallback(async (nextTrades: Trade[]) => {
    await mutate({ trades: nextTrades }, false);
    await fetch("/api/journal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trades: nextTrades }) });
  }, [mutate]);
  const addTrade = useCallback(() => { const next = createTrade(trades); void mutate({ trades: [...trades, next] }, false); return next; }, [mutate, trades]);
  const updateTrade = useCallback((id: string, patch: Partial<Trade>) => {
    const nextTrades = trades.map((trade) => trade.id === id ? { ...trade, ...patch } : trade);
    void mutate({ trades: nextTrades }, false);
    const updated = nextTrades.find((trade) => trade.id === id);
    if (updated?.name.trim() && updated.entry > 0 && updated.initialQty > 0) void persist(nextTrades);
  }, [mutate, persist, trades]);
  const updateCmps = useCallback((updates: Array<{ id: string; cmp: number }>) => { const byId = new Map(updates.map((update) => [update.id, update.cmp])); void mutate((current) => { const nextTrades = (current?.trades ?? trades).map((trade) => byId.has(trade.id) ? { ...trade, cmp: byId.get(trade.id)! } : trade); void fetch("/api/journal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trades: nextTrades }) }); return { trades: nextTrades }; }, false); }, [mutate, trades]);
  return { trades, setTrades: persist, hydrated: Boolean(data) || Boolean(error), addTrade, updateTrade, updateCmps };
}
