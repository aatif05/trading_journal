import type { Trade, TradeMetric } from "./trades";

export function hasValidStopLoss(trade: Trade) {
  return Number.isFinite(trade.sl) && trade.sl > 0;
}

export function findMissingStopLossTrades(metrics: TradeMetric[]) {
  return metrics.filter((trade) => trade.positionStatus !== "Closed" && !hasValidStopLoss(trade));
}

export function momentumSignal(changePercent: number | null) {
  if (changePercent === null || !Number.isFinite(changePercent)) return { label: "No data", tone: "muted" as const };
  if (changePercent >= 2) return { label: "Strong positive", tone: "positive" as const };
  if (changePercent <= -2) return { label: "Strong negative", tone: "negative" as const };
  return { label: "Mixed", tone: "neutral" as const };
}

export function safePercent(value: number | null, base: number | null) {
  if (value === null || base === null || !Number.isFinite(value) || !Number.isFinite(base) || base === 0) return null;
  return (value / base) * 100;
}
