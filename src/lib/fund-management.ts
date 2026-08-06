import { calculateTrade, PORTFOLIO_CAPITAL, type Trade } from "./trades";

export const FUND_FLOWS_STORAGE_KEY = "ledgerly.fund-flows.v1";

export type CapitalFlow = {
  added: number;
  withdrawn: number;
};

export type CapitalFlows = Record<string, CapitalFlow>;

export type FundMonth = CapitalFlow & {
  month: number;
  startingCapital: number;
  netPL: number;
  percentPL: number;
  finalCapital: number;
  trades: number;
  winRate: number;
  avgGain: number;
  avgLoss: number;
  hasTrades: boolean;
};

const flowKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, "0")}`;

const finiteNonNegative = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

function closedMonth(trade: Trade) {
  if (trade.positionStatus !== "Closed") return null;

  // Attribute a closed trade once, to its latest exit date. Trades closed only
  // with avgExitPrice fall back to their journal date.
  const date = trade.e3Date || trade.e2Date || trade.e1Date || trade.date;
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!match) return null;
  const month = Number(match[2]) - 1;
  return month >= 0 && month <= 11 ? { year: Number(match[1]), month } : null;
}

export function calculateFundYear(
  trades: Trade[],
  flows: CapitalFlows,
  year: number,
  baseline = PORTFOLIO_CAPITAL,
): FundMonth[] {
  const attributed = Array.from({ length: 12 }, () => [] as ReturnType<typeof calculateTrade>[]);

  for (const trade of trades) {
    const period = closedMonth(trade);
    if (period?.year === year) attributed[period.month].push(calculateTrade(trade));
  }

  let previousFinal = baseline;
  return attributed.map((monthlyTrades, month) => {
    const flow = flows[flowKey(year, month)] ?? { added: 0, withdrawn: 0 };
    const added = finiteNonNegative(flow.added);
    const withdrawn = finiteNonNegative(flow.withdrawn);
    const startingCapital = previousFinal + added - withdrawn;
    const netPL = monthlyTrades.reduce((sum, trade) => sum + trade.grossPL, 0);
    const finalCapital = startingCapital + netPL;
    const winners = monthlyTrades.filter((trade) => trade.grossPL > 0);
    const losers = monthlyTrades.filter((trade) => trade.grossPL < 0);
    const returnPercent = (trade: (typeof monthlyTrades)[number]) => {
      const cost = (trade.avgEntry || trade.entry) * (trade.initialQty + trade.p1Qty + trade.p2Qty);
      return cost ? (trade.grossPL * 100) / cost : 0;
    };

    const result: FundMonth = {
      month,
      added,
      withdrawn,
      startingCapital,
      netPL,
      percentPL: startingCapital ? (netPL * 100) / startingCapital : 0,
      finalCapital,
      trades: monthlyTrades.length,
      winRate: monthlyTrades.length ? (winners.length * 100) / monthlyTrades.length : 0,
      avgGain: winners.length
        ? winners.reduce((sum, trade) => sum + returnPercent(trade), 0) / winners.length
        : 0,
      avgLoss: losers.length
        ? Math.abs(losers.reduce((sum, trade) => sum + returnPercent(trade), 0) / losers.length)
        : 0,
      hasTrades: monthlyTrades.length > 0,
    };

    previousFinal = finalCapital;
    return result;
  });
}

export function updateCapitalFlow(
  flows: CapitalFlows,
  year: number,
  month: number,
  field: keyof CapitalFlow,
  value: number,
) {
  const key = flowKey(year, month);
  return {
    ...flows,
    [key]: {
      ...(flows[key] ?? { added: 0, withdrawn: 0 }),
      [field]: finiteNonNegative(value),
    },
  };
}

export function serializeCapitalFlows(flows: CapitalFlows) {
  return JSON.stringify({ version: 1, flows });
}

export function parseCapitalFlows(raw: string | null): CapitalFlows {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { version?: number; flows?: unknown };
    if (parsed.version !== 1 || !parsed.flows || typeof parsed.flows !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed.flows as Record<string, unknown>)
        .filter(([key]) => /^\d{4}-(0[1-9]|1[0-2])$/.test(key))
        .map(([key, flow]) => {
          const candidate =
            flow && typeof flow === "object" ? (flow as Partial<CapitalFlow>) : {};
          return [
            key,
            {
              added: finiteNonNegative(candidate.added),
              withdrawn: finiteNonNegative(candidate.withdrawn),
            },
          ];
        }),
    );
  } catch {
    return {};
  }
}
