import {
  calculatePortfolio,
  calculateTradeMetrics,
  type PortfolioMetrics,
  type Trade,
  type TradeMetric,
} from "./trades";

import { type CapitalFlows } from "./fund-management";

export interface AnalyticsMetrics extends PortfolioMetrics {
  winnerCount: number;
  loserCount: number;

  /** Average percentage return of winning closed trades. */
  avgGain: number;

  /** Average absolute percentage loss of losing closed trades. */
  avgLoss: number;

  /** Average rupee profit of winning closed trades. */
  avgGainAmount: number;

  /** Average absolute rupee loss of losing closed trades. */
  avgLossAmount: number;

  /** Total net P/L of closed trades, including brokerage. */
  closedNetPL: number;

  /** Total gross profit from winning closed trades. */
  grossProfit: number;

  /** Total gross loss from losing closed trades, represented as a positive number. */
  grossLoss: number;

  /** Standard profit factor = gross profit / gross loss. */
  profitFactor: number;

  /** Average net P/L per closed trade. */
  expectancy: number;

  /** Average holding period for closed trades. */
  avgHoldingDays: number;

  /** Maximum peak-to-trough drawdown of the realized equity curve. */
  maxDrawdown: number;

  /** Maximum peak-to-trough drawdown as a percentage of peak equity. */
  maxDrawdownPercent: number;
}

export interface PerformanceSeries {
  date: string;

  /** P/L generated on this date. */
  pnl: number;

  /** Daily P/L as a percentage of capital before that day's P/L. */
  pnlPercent: number;

  /** Cumulative closed-trade P/L. */
  cumulativePnL: number;

  /** Cumulative P/L as percentage of contributed capital. */
  cumulativePnLPercent: number;

  /** Capital contributed after deposits/withdrawals through this date. */
  contributedCapital: number;

  /** Realized equity = contributed capital + cumulative closed-trade P/L. */
  equity: number;

  /** Equity return relative to contributed capital. */
  equityReturnPercent: number;
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

const finite = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const average = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

/**
 * Percentage return for a closed trade.
 *
 * The denominator is the complete position notional, including
 * scale-in/addition legs.
 */
function tradeReturnPercent(trade: TradeMetric) {
  return trade.positionSize > 0
    ? (trade.grossPL * 100) / trade.positionSize
    : 0;
}

/**
 * Capital flows are stored monthly. Therefore a date inside a month
 * receives that month's net flow.
 */
function netFlowThroughDate(flows: CapitalFlows, date: string) {
  const monthKey = date.slice(0, 7);

  return Object.entries(flows).reduce((sum, [key, flow]) => {
    if (key <= monthKey) {
      return (
        sum +
        Math.max(0, finite(flow?.added)) -
        Math.max(0, finite(flow?.withdrawn))
      );
    }

    return sum;
  }, 0);
}

function totalNetFlows(flows: CapitalFlows) {
  return Object.values(flows).reduce(
    (sum, flow) =>
      sum +
      Math.max(0, finite(flow?.added)) -
      Math.max(0, finite(flow?.withdrawn)),
    0,
  );
}

/**
 * Calculates the starting capital implied by the current capital,
 * recorded capital flows and realized closed-trade P/L.
 *
 * currentCapital =
 *   startingCapital
 *   + net capital flows
 *   + closed-trade P/L
 */
function inferStartingCapital(
  currentCapital: number,
  closedNetPL: number,
  flows: CapitalFlows,
) {
  return Math.max(0, currentCapital - closedNetPL - totalNetFlows(flows));
}

function calculateDrawdown(series: PerformanceSeries[]) {
  if (!series.length) {
    return {
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
    };
  }

  let peak = series[0].equity;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;

  for (const point of series) {
    if (point.equity > peak) {
      peak = point.equity;
    }

    const drawdown = Math.max(0, peak - point.equity);

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    const drawdownPercent =
      peak > 0 ? (drawdown * 100) / peak : 0;

    if (drawdownPercent > maxDrawdownPercent) {
      maxDrawdownPercent = drawdownPercent;
    }
  }

  return {
    maxDrawdown,
    maxDrawdownPercent,
  };
}

export function calculateAnalytics(
  trades: Trade[],
  flows: CapitalFlows,
  capital: number,
): AnalyticsMetrics {
  const portfolio = calculatePortfolio(trades, capital);

  const metrics = calculateTradeMetrics(
    trades,
    new Date(),
    capital,
  );

  const closed = metrics.filter(
    (trade) => trade.positionStatus === "Closed",
  );

  const winners = closed.filter((trade) => trade.grossPL > 0);
  const losers = closed.filter((trade) => trade.grossPL < 0);

  const winnerReturns = winners.map(tradeReturnPercent);
  const loserReturns = losers.map((trade) =>
    Math.abs(tradeReturnPercent(trade)),
  );

  const avgGain = average(winnerReturns);
  const avgLoss = average(loserReturns);

  const avgGainAmount = average(
    winners.map((trade) => trade.grossPL),
  );

  const avgLossAmount = average(
    losers.map((trade) => Math.abs(trade.grossPL)),
  );

  const grossProfit = winners.reduce(
    (sum, trade) => sum + trade.grossPL,
    0,
  );

  const grossLoss = Math.abs(
    losers.reduce((sum, trade) => sum + trade.grossPL, 0),
  );

  const closedNetPL = closed.reduce(
    (sum, trade) => sum + trade.grossPL,
    0,
  );

  /**
   * Standard profit factor:
   *
   * Total winning P/L
   * -----------------
   * Total losing P/L
   */
  const profitFactor =
    grossLoss > 0
      ? grossProfit / grossLoss
      : grossProfit > 0
        ? Infinity
        : 0;

  /**
   * Expectancy is based only on closed trades.
   * Open/unrealized P/L must not enter this calculation.
   */
  const expectancy =
    closed.length > 0
      ? closedNetPL / closed.length
      : 0;

  const avgHoldingDays =
    closed.length > 0
      ? closed.reduce(
          (sum, trade) => sum + trade.holdingDays,
          0,
        ) / closed.length
      : 0;

  const startingCapital = inferStartingCapital(
    capital,
    closedNetPL,
    flows,
  );

  const performanceSeries = calculatePerformanceSeries(
    trades,
    flows,
    startingCapital,
  );

  const drawdown = calculateDrawdown(performanceSeries);

  /**
   * Keep grossImpact consistent with TradeMetric.grossPL,
   * which includes brokerage.
   */
  const allGrossPL = metrics.reduce(
    (sum, trade) => sum + trade.grossPL,
    0,
  );

  const correctedGrossImpact =
    capital > 0
      ? (allGrossPL * 100) / capital
      : 0;

  const correctedCurrentDrawdown = Math.min(
    0,
    correctedGrossImpact,
  );

  return {
    ...portfolio,

    grossImpact: correctedGrossImpact,
    currentDrawdown: correctedCurrentDrawdown,

    winnerCount: winners.length,
    loserCount: losers.length,

    avgGain,
    avgLoss,

    avgGainAmount,
    avgLossAmount,

    closedNetPL,
    grossProfit,
    grossLoss,

    profitFactor,
    expectancy,
    avgHoldingDays,

    maxDrawdown: drawdown.maxDrawdown,
    maxDrawdownPercent: drawdown.maxDrawdownPercent,

    capital: capital || 0,
  };
}

export function calculatePerformanceSeries(
  trades: Trade[],
  flows: CapitalFlows,
  baselineCapital: number,
): PerformanceSeries[] {
  const metrics = calculateTradeMetrics(
    trades,
    new Date(),
    baselineCapital,
  );

  const closed = metrics.filter(
    (trade) => trade.positionStatus === "Closed",
  );

  if (closed.length === 0) {
    return [];
  }

  const byDate = new Map<string, TradeMetric[]>();

  for (const trade of closed) {
    const date =
      trade.e3Date ||
      trade.e2Date ||
      trade.e1Date ||
      trade.date;

    if (!date) {
      continue;
    }

    const existing = byDate.get(date);

    if (existing) {
      existing.push(trade);
    } else {
      byDate.set(date, [trade]);
    }
  }

  const sorted = Array.from(byDate.entries()).sort(
    ([dateA], [dateB]) => dateA.localeCompare(dateB),
  );

  const series: PerformanceSeries[] = [];

  let cumulativePnL = 0;
  let previousEquity = 0;

  for (const [date, dateTrades] of sorted) {
    const dayPnL = dateTrades.reduce(
      (sum, trade) => sum + trade.grossPL,
      0,
    );

    cumulativePnL += dayPnL;

    const netFlowsThroughDate = netFlowThroughDate(
      flows,
      date,
    );

    const contributedCapital =
      baselineCapital + netFlowsThroughDate;

    const equity =
      contributedCapital + cumulativePnL;

    const pnlPercent =
      previousEquity > 0
        ? (dayPnL * 100) / previousEquity
        : contributedCapital > 0
          ? (dayPnL * 100) / contributedCapital
          : 0;

    const cumulativePnLPercent =
      contributedCapital > 0
        ? (cumulativePnL * 100) / contributedCapital
        : 0;

    const equityReturnPercent =
      contributedCapital > 0
        ? ((equity - contributedCapital) * 100) /
          contributedCapital
        : 0;

    series.push({
      date,
      pnl: dayPnL,
      pnlPercent,
      cumulativePnL,
      cumulativePnLPercent,
      contributedCapital,
      equity,
      equityReturnPercent,
    });

    previousEquity = equity;
  }

  return series;
}

export function calculateTopPerformers(
  trades: Trade[],
  capital = 0,
  limit = 5,
): TopPerformer[] {
  const metrics = calculateTradeMetrics(
    trades,
    new Date(),
    capital,
  );

  /**
   * "Top performers" should mean best winning trades,
   * not the biggest absolute winners OR losers.
   */
  return metrics
    .filter(
      (trade) =>
        trade.positionStatus === "Closed" &&
        trade.grossPL > 0,
    )
    .sort((a, b) => b.grossPL - a.grossPL)
    .slice(0, limit)
    .map((trade) => ({
      name: trade.name,
      symbol:
        trade.name.split(/[-–\s]/)[0] ||
        trade.name,
      gain: trade.grossPL,
      gainPercent:
        trade.positionSize > 0
          ? (trade.grossPL * 100) /
            trade.positionSize
          : 0,
      impact: trade.portfolioImpact,
      date:
        trade.e3Date ||
        trade.e2Date ||
        trade.e1Date ||
        trade.date,
      side: trade.side,
    }));
}

export function formatMetricLabel(
  value: number,
  label: string,
): string {
  if (label.includes("%")) {
    return `${value.toFixed(2)}%`;
  }

  if (label.includes("days")) {
    return Math.round(value).toString();
  }

  return value.toFixed(2);
}
