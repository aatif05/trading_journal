"use client";

import { useEffect, useMemo, useState } from "react";
import { PatternMiniChart } from "@/components/research/pattern-mini-chart";
import type { PatternCandidate, ThemeSummary } from "@/lib/patterns";
import { AlertTriangle, BrainCircuit, RefreshCw, Search, TrendingDown, TrendingUp } from "lucide-react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useTrades } from "@/hooks/use-trades";
import { fetchLatestPrices } from "@/lib/prices";
import { findMissingStopLossTrades, momentumSignal, safePercent } from "@/lib/risk";
import { calculateTradeMetrics, formatCurrency } from "@/lib/trades";

const CHART_WINDOW = 30;

export default function ResearchPage() {
  const { trades } = useTrades();
  const symbols = useMemo(
    () => [...new Set(trades.map((t) => t.name.trim().toUpperCase()).filter(Boolean))],
    [trades],
  );

  const [symbol, setSymbol] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [previous, setPrevious] = useState<number | null>(null);
  const [status, setStatus] = useState("Select a symbol to begin research.");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [patterns, setPatterns] = useState<PatternCandidate[]>([]);
  const [marketSeries, setMarketSeries] = useState<{ symbol: string; ticks: string[][] }[]>([]);
  const [themes, setThemes] = useState<ThemeSummary[]>([]);
  const [marketStatus, setMarketStatus] = useState("Loading candle history…");

  useEffect(() => {
    if (!symbols.length) return;
    fetch(`/api/research/market?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then((response) => response.json())
      .then((data) => {
        setPatterns(data.patterns ?? []);
        setMarketSeries(data.series ?? []);
        setThemes(data.themes ?? []);
        setMarketStatus(
          data.series?.length
            ? `Daily history loaded · ${new Date(data.fetchedAt).toLocaleTimeString()}`
            : "No daily history available",
        );
      })
      .catch(() => setMarketStatus("Market history unavailable"));
  }, [symbols]);

  const myThemes = useMemo(
    () =>
      [...new Set(trades.map((trade) => trade.name.trim().toUpperCase()).filter(Boolean))]
        .map((item) => themes.find((theme) => theme.symbols.includes(item))?.theme ?? "Unclassified")
        .filter((item, index, all) => all.indexOf(item) === index),
    [themes, trades],
  );

  const selectedTrade = trades.find((t) => t.name.trim().toUpperCase() === symbol);
  const change =
    price !== null && previous !== null && previous !== 0 ? ((price - previous) / previous) * 100 : null;
  const signal = momentumSignal(change);
  const metrics = calculateTradeMetrics(trades);
  const missingSL = findMissingStopLossTrades(metrics);

  const reentryCandidates = metrics
    .filter((trade) => trade.positionStatus !== "Closed" && trade.sl > 0)
    .map((trade) => {
      const market = marketSeries.find((item) => item.symbol === trade.name.trim().toUpperCase());
      const closes = market?.ticks.map((tick) => Number(tick[4])).filter(Number.isFinite) ?? [];
      const current = closes.at(-1) ?? trade.cmp;
      const ma20 =
        closes.slice(-20).reduce((sum, value) => sum + value, 0) / Math.max(1, Math.min(20, closes.length));
      const distance =
