import { calculateTrade, type Trade, type TradeMetric } from "./trades";

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

/** Chronological index so months can be compared and walked across year boundaries. */
const periodIndex = (year: number, month: number) => year * 12 + month;

const finiteNonNegative = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

function closedMonth(trade: Trade) {
  if (calculateTrade(trade).positionStatus !== "Closed") return null;

  // Attribute a closed trade once, to its latest exit date. Trades closed only
  // with avgExitPrice fall back to their journal date.
  const date = trade.e3Date || trade.e2Date || trade.e1Date || trade.date;
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date);
  if (!match) return null;
  const month = Number(match[2]) - 1;
  return month >= 0 && month <= 11 ? { year: Number(match[1]), month } : null;
}

type LedgerEntry = { added: number; withdrawn: number; trades: TradeMetric[] };

/** Every month that carries capital flows or closed trades, keyed chronologically. */
function buildLedger(trades: Trade[], flows: CapitalFlows) {
  const ledger = new Map<number, LedgerEntry>();
  const entryAt = (index: number) => {
    const existing = ledger.get(index);
    if (existing) return existing;
    const created: LedgerEntry = { added: 0, withdrawn: 0, trades: [] };
    ledger.set(index, created);
    return created;
  };

  for (const [key, flow] of Object.entries(flows)) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);
    if (!match) continue;
    const entry = entryAt(periodIndex(Number(match[1]), Number(match[2]) - 1));
    entry.added += finiteNonNegative(flow?.added);
    entry.withdrawn += finiteNonNegative(flow?.withdrawn);
  }

  for (const trade of trades) {
    const period = closedMonth(trade);
    if (period) entryAt(periodIndex(period.year, period.month)).trades.push(calculateTrade(trade));
  }

  return ledger;
}

const netPLOf = (entry: LedgerEntry | undefined) =>
  entry ? entry.trades.reduce((sum, trade) => sum + trade.grossPL, 0) : 0;

/** Runs the capital chain forward through `throughIndex`, inclusive. */
function capitalThrough(ledger: Map<number, LedgerEntry>, throughIndex: number, baseline: number) {
  return [...ledger.entries()]
    .filter(([index]) => index <= throughIndex)
    .sort(([a], [b]) => a - b)
    .reduce(
      (capital, [, entry]) => capital + entry.added - entry.withdrawn + netPLOf(entry),
      baseline,
    );
}

/**
 * Capital available right now: deposits and withdrawals recorded up to the current
 * month plus P/L already booked by closed trades. Open positions are excluded
 * because their P/L is not realised capital yet.
 */
export function calculateCurrentCapital(
  trades: Trade[],
  flows: CapitalFlows,
  now = new Date(),
  baseline = 0,
) {
  return capitalThrough(
    buildLedger(trades, flows),
    periodIndex(now.getFullYear(), now.getMonth()),
    baseline,
  );
}

export function calculateFundYear(
  trades: Trade[],
  flows: CapitalFlows,
  year: number,
  baseline = 0,
): FundMonth[] {
  const ledger = buildLedger(trades, flows);

  // January opens on the closing capital of every earlier year.
  let previousFinal = capitalThrough(ledger, periodIndex(year, 0) - 1, baseline);

  return Array.from({ length: 12 }, (_, month) => {
    const entry = ledger.get(periodIndex(year, month));
    const monthlyTrades = entry?.trades ?? [];
    const added = entry?.added ?? 0;
    const withdrawn = entry?.withdrawn ?? 0;
    const startingCapital = previousFinal + added - withdrawn;
    const netPL = netPLOf(entry);
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
