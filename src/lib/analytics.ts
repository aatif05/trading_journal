import {
  calculatePortfolio,
  calculateTradeMetrics,
  formatPercent,
  type PortfolioMetrics,
  type Trade,
  type TradeMetric,
} from "./trades";
import { calculateCurrentCapital, type CapitalFlows } from "./fund-management";

export interface AnalyticsMetrics extends PortfolioMetrics {
  avgGain: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  avgHoldingDays: number;
}

export interface PerformanceSeries {
  date: string;
  pnl: number;
  pnlPercent: number;
  cumulativePnL: number;
  cumulativePnLPercent: number;
}

export interface TopPerformer {
  name: string;
  symbol: string;
  gain: number;
  gainPercent: number;
  impact: number;
  date: string;
  side: "Buy" | "Sell";
}

export function calculateAnalytics(
  trades: Trade[],
  flows: CapitalFlows,
  capital: number,
): AnalyticsMetrics {
  const portfolio = calculatePortfolio(trades, capital);
  const metrics = calculateTradeMetrics(trades, new Date(), capital);
  const closed = metrics.filter((t) => t.positionStatus === "Closed");

  if (closed.length === 0) {
    return {
      ...portfolio,
      avgGain: 0,
      avgLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      avgHoldingDays: 0,
    };
  }

  const winners = closed.filter((t) => t.grossPL > 0);
  const losers = closed.filter((t) => t.grossPL < 0);

  const avgGain = winners.length ? winners.reduce((sum, t) => sum + t.grossPL, 0) / winners.length : 0;
  const avgLoss = losers.length ? Math.abs(losers.reduce((sum, t) => sum + t.grossPL, 0) / losers.length) : 0;
  const profitFactor = avgLoss > 0 ? avgGain / avgLoss : avgGain > 0 ? Infinity : 0;
  const expectancy = closed.length > 0 ? (portfolio.realizedPL + portfolio.unrealizedPL) / closed.length : 0;
  const avgHoldingDays = closed.length > 0 ? closed.reduce((sum, t) => sum + t.holdingDays, 0) / closed.length : 0;

  return {
    ...portfolio,
    avgGain,
    avgLoss,
    profitFactor,
    expectancy,
    avgHoldingDays,
  };
}

export function calculatePerformanceSeries(
  trades: Trade[],
  flows: CapitalFlows,
  baselineCapital: number,
): PerformanceSeries[] {
  const metrics = calculateTradeMetrics(trades, new Date(), baselineCapital);
  const closed = metrics.filter((t) => t.positionStatus === "Closed");

  if (closed.length === 0) return [];

  const byDate = new Map<string, TradeMetric[]>();
  for (const trade of closed) {
    const date = trade.e3Date || trade.e2Date || trade.e1Date || trade.date;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(trade);
  }

  const sorted = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const series: PerformanceSeries[] = [];
  let cumulativePnL = 0;

  for (const [date, dateTrades] of sorted) {
    const dayPnL = dateTrades.reduce((sum, t) => sum + t.grossPL, 0);
    cumulativePnL += dayPnL;

    const currentCapital = calculateCurrentCapital(trades, flows, new Date(date), baselineCapital);
    const prevCapital = currentCapital - dayPnL;
    const cumulativePnLPercent = currentCapital > 0 ? (cumulativePnL * 100) / currentCapital : 0;

    series.push({
      date,
      pnl: dayPnL,
      pnlPercent: prevCapital > 0 ? (dayPnL * 100) / prevCapital : 0,
      cumulativePnL,
      cumulativePnLPercent,
    });
  }

  return series;
}

export function calculateTopPerformers(trades: Trade[], limit = 5): TopPerformer[] {
  const metrics = calculateTradeMetrics(trades, new Date(), 0);
  const sorted = [...metrics]
    .filter((t) => t.positionStatus === "Closed")
    .sort((a, b) => b.grossPL - a.grossPL)
    .slice(0, limit * 2);

  return sorted
    .slice(0, limit)
    .map((t) => ({
      name: t.name,
      symbol: t.name.split(/[-–\s]/)[0] || t.name,
      gain: t.grossPL,
      gainPercent: t.positionSize > 0 ? (t.grossPL * 100) / t.positionSize : 0,
      impact: t.portfolioImpact,
      date: t.e3Date || t.e2Date || t.e1Date || t.date,
      side: t.side,
    }))
    .sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain));
}

export function formatMetricLabel(value: number, label: string): string {
  if (label.includes("%")) return formatPercent(value);
  if (label.includes("days")) return Math.round(value).toString();
  if (label.includes("rate") || label.includes("%")) return formatPercent(value);
  return value.toFixed(2);
}
