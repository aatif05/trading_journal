export type TradeSide = "Buy" | "Sell";
export type PositionStatus = "Open" | "Closed" | "Partial";
export type Trade = {
  id: string;
  tradeNo: number;
  date: string;
  name: string;
  setup: string;
  side: TradeSide;
  entry: number;
  avgEntry: number;
  initialQty: number;
  sl: number;
  cmp: number;
  entryType: string;
  /** Scale-in / addition legs */
  p1Price: number;
  p1Qty: number;
  p1Date: string;
  p1Sl: number;
  p2Price: number;
  p2Qty: number;
  p2Date: string;
  p2Sl: number;
  /** Partial exit legs */
  e1Price: number;
  e1Qty: number;
  e1Date: string;
  e2Price: number;
  e2Qty: number;
  e2Date: string;
  e3Price: number;
  e3Qty: number;
  e3Date: string;
  tsl: number;
  tslGroups: string;
  peakAllocation: number;
  avgExitPrice: number;
  positionStatus: PositionStatus;
  planFollowed: string;
  exitTrigger: string;
  growthAreas: string;
  baseDuration: string;
  quickNote: string;
  brokerage: number;
};

export type TradeMetric = Trade & {
  exitedQty: number;
  openQty: number;
  remainingQty: number;
  invested: number;
  capitalAtRisk: number;
  profitProtected: number;
  unrealized: number;
  realized: number;
  grossPL: number;
  stockMove: number;
  rewardRisk: number;
  holdingDays: number;
  portfolioImpact: number;
  positionSize: number;
  currentAllocation: number;
  slPercent: number;
  computedAvgExit: number;
  cummPF: number;
};

export type PortfolioMetrics = {
  totalTrades: number;
  openPositions: number;
  winRate: number;
  realizedPL: number;
  unrealizedPL: number;
  unrealizedPercent: number;
  capitalAtRisk: number;
  capitalAtRiskPercent: number;
  profitProtected: number;
  profitProtectedPercent: number;
  invested: number;
  investedPercent: number;
  grossImpact: number;
  currentDrawdown: number;
  /** Live portfolio capital the percentages above are measured against. */
  capital: number;
};

export const STORAGE_KEY = "ledgerly.trades.v2";
export const LEGACY_STORAGE_KEY = "ledgerly.trades.v1";

const baseTrade: Omit<Trade, "id" | "tradeNo" | "date" | "name"> = {
  setup: "",
  side: "Buy",
  entry: 0,
  avgEntry: 0,
  initialQty: 0,
  sl: 0,
  cmp: 0,
  entryType: "",
  p1Price: 0,
  p1Qty: 0,
  p1Date: "",
  p1Sl: 0,
  p2Price: 0,
  p2Qty: 0,
  p2Date: "",
  p2Sl: 0,
  e1Price: 0,
  e1Qty: 0,
  e1Date: "",
  e2Price: 0,
  e2Qty: 0,
  e2Date: "",
  e3Price: 0,
  e3Qty: 0,
  e3Date: "",
  tsl: 0,
  tslGroups: "",
  peakAllocation: 0,
  avgExitPrice: 0,
  positionStatus: "Open",
  planFollowed: "",
  exitTrigger: "",
  growthAreas: "",
  baseDuration: "",
  quickNote: "",
  brokerage: 0,
};

export const setupOptions = ["", "Breakout", "Continuation", "Pullback", "Reversal", "EP", "FLAG"];
export const entryTypeOptions = ["", "Anticipation", "Confirmation", "Retest", "PDH","SVRO"];
export const planFollowedOptions = ["", "Yes", "No", "Partial"];
export const exitTriggerOptions = [
  "",
  "Target",
  "SL",
  "TSL",
  "Partial book",
  "Manual",
  "Time stop",
  "Random",
  "Panic Sell",
  "Market Pressure",
  "Failed BO"
];
export const durationOptions = ["", "Intraday", "Swing", "Positional", "Long term"];

export const tradeColumns = [
  { key: "tradeNo", label: "Trade no." },
  { key: "date", label: "Date" },
  { key: "name", label: "Name" },
  { key: "setup", label: "Setup" },
  { key: "side", label: "Buy/Sell" },
  { key: "entry", label: "Entry" },
  { key: "avgEntry", label: "Avg entry" },
  { key: "sl", label: "SL" },
  { key: "cmp", label: "CMP" },
  { key: "entryType", label: "Entry type" },
  { key: "initialQty", label: "Initial qty/lot" },
  { key: "p1Price", label: "Add 1 price" },
  { key: "p1Qty", label: "Add 1 qty/lot" },
  { key: "p1Date", label: "Add 1 date" },
  { key: "p1Sl", label: "Add 1 SL" },
  { key: "p2Price", label: "Add 2 price" },
  { key: "p2Qty", label: "Add 2 qty/lot" },
  { key: "p2Date", label: "Add 2 date" },
  { key: "p2Sl", label: "Add 2 SL" },
  { key: "tsl", label: "TSL" },
  { key: "tslGroups", label: "TSL groups" },
  { key: "positionSize", label: "Position size" },
  { key: "currentAllocation", label: "Current allocation (%)" },
  { key: "peakAllocation", label: "Peak allocation (%)" },
  { key: "slPercent", label: "SL %" },
  { key: "e1Price", label: "Exit 1 price" },
  { key: "e1Qty", label: "Exit 1 qty/lot" },
  { key: "e1Date", label: "Exit 1 date" },
  { key: "e2Price", label: "Exit 2 price" },
  { key: "e2Qty", label: "Exit 2 qty/lot" },
  { key: "e2Date", label: "Exit 2 date" },
  { key: "e3Price", label: "Exit 3 price" },
  { key: "e3Qty", label: "Exit 3 qty/lot" },
  { key: "e3Date", label: "Exit 3 date" },
  { key: "openQty", label: "Open qty/lot" },
  { key: "exitedQty", label: "Exited qty/lot" },
  { key: "avgExitPrice", label: "Avg exit price" },
  { key: "stockMove", label: "Stock move" },
  { key: "rewardRisk", label: "Reward:risk" },
  { key: "holdingDays", label: "Holding days" },
  { key: "positionStatus", label: "Position status" },
  { key: "realized", label: "Realised amount" },
  { key: "grossPL", label: "Gross P/L ₹" },
  { key: "portfolioImpact", label: "PF impact" },
  { key: "cummPF", label: "Cumm PF" },
  { key: "planFollowed", label: "Plan followed" },
  { key: "exitTrigger", label: "Exit trigger" },
  { key: "growthAreas", label: "Growth areas" },
  { key: "capitalAtRisk", label: "Open heat" },
  { key: "baseDuration", label: "Base duration" },
  { key: "quickNote", label: "Notes" },
  { key: "unrealized", label: "Unrealized P/L" },
  { key: "brokerage", label: "Brokerage" },
  { key: "actions", label: "Actions" },
] as const;

export type ColumnKey = (typeof tradeColumns)[number]["key"];

export function createTrade(trades: Trade[]): Trade {
  const nextNo = Math.max(0, ...trades.map((trade) => trade.tradeNo)) + 1;
  return {
    ...baseTrade,
    id: crypto.randomUUID(),
    tradeNo: nextNo,
    date: new Date().toISOString().slice(0, 10),
    name: "NEW TRADE",
  };
}

const finite = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

function normalizeTrade(trade: Record<string, unknown>): Trade {
  // Legacy v1/v2 stored exits on p1/p2/p3. New model: p* = additions, e* = exits.
  const hasExitFields =
    "e1Price" in trade || "e1Qty" in trade || "e2Price" in trade || "e3Price" in trade;
  const legacyExits = !hasExitFields;

  return {
    ...baseTrade,
    id: String(trade.id || crypto.randomUUID()),
    tradeNo: finite(trade.tradeNo),
    date: String(trade.date || ""),
    name: String(trade.name || ""),
    setup: String(trade.setup || ""),
    side: trade.side === "Sell" ? "Sell" : "Buy",
    entry: finite(trade.entry),
    avgEntry: finite(trade.avgEntry),
    initialQty: finite(trade.initialQty),
    sl: finite(trade.sl),
    cmp: finite(trade.cmp),
    entryType: String(trade.entryType || ""),
    p1Price: legacyExits ? 0 : finite(trade.p1Price),
    p1Qty: legacyExits ? 0 : finite(trade.p1Qty),
    p1Date: legacyExits ? "" : String(trade.p1Date || ""),
    p1Sl: legacyExits ? 0 : finite(trade.p1Sl),
    p2Price: legacyExits ? 0 : finite(trade.p2Price),
    p2Qty: legacyExits ? 0 : finite(trade.p2Qty),
    p2Date: legacyExits ? "" : String(trade.p2Date || ""),
    p2Sl: legacyExits ? 0 : finite(trade.p2Sl),
    e1Price: finite(hasExitFields ? trade.e1Price : trade.p1Price),
    e1Qty: finite(hasExitFields ? trade.e1Qty : trade.p1Qty),
    e1Date: String((hasExitFields ? trade.e1Date : trade.p1Date) || ""),
    e2Price: finite(hasExitFields ? trade.e2Price : trade.p2Price),
    e2Qty: finite(hasExitFields ? trade.e2Qty : trade.p2Qty),
    e2Date: String((hasExitFields ? trade.e2Date : trade.p2Date) || ""),
    e3Price: finite(hasExitFields ? trade.e3Price : trade.p3Price),
    e3Qty: finite(hasExitFields ? trade.e3Qty : trade.p3Qty),
    e3Date: String((hasExitFields ? trade.e3Date : trade.p3Date) || ""),
    tsl: finite(trade.tsl),
    tslGroups: String(trade.tslGroups || ""),
    peakAllocation: finite(trade.peakAllocation),
    avgExitPrice: finite(trade.avgExitPrice),
    positionStatus:
      trade.positionStatus === "Closed"
        ? "Closed"
        : trade.positionStatus === "Partial"
          ? "Partial"
          : "Open",
    planFollowed: String(trade.planFollowed || ""),
    exitTrigger: String(trade.exitTrigger || ""),
    growthAreas: String(trade.growthAreas || ""),
    baseDuration: String(trade.baseDuration || ""),
    quickNote: String(trade.quickNote || ""),
    brokerage: finite(trade.brokerage),
  };
}

/**
 * Percentages are measured against live portfolio capital (deposits, withdrawals
 * and booked P/L). Capital is 0 until fund flows are recorded, so guard the ratio.
 */
const shareOfCapital = (value: number, capital: number) =>
  capital > 0 ? (value * 100) / capital : 0;

export function calculateTrade(
  trade: Trade,
  now = new Date(),
  cummPF = 0,
  capital = 0,
): TradeMetric {
  // Numeric conversions to avoid string math bugs
  const tslPrice = trade.tsl ? Number(trade.tsl) : 0;
  const slPrice = trade.sl ? Number(trade.sl) : 0;
  const cmp = Number(trade.cmp || 0);
  const entryLegs = [
    { price: Number(trade.entry || 0), qty: Number(trade.initialQty || 0), stop: 0 },
    { price: Number(trade.p1Price || 0), qty: Number(trade.p1Qty || 0), stop: 0 },
    { price: Number(trade.p2Price || 0), qty: Number(trade.p2Qty || 0), stop: 0 },
  ];
  const entryNotional = entryLegs.reduce(
    (total, leg) => (leg.price > 0 && leg.qty > 0 ? total + leg.price * leg.qty : total),
    0,
  );
  const entryLegQty = entryLegs.reduce(
    (total, leg) => (leg.price > 0 && leg.qty > 0 ? total + leg.qty : total),
    0,
  );
  const entryPrice = entryLegQty > 0 ? entryNotional / entryLegQty : Number(trade.avgEntry || trade.entry || 0);

  const totalQty = entryLegs.reduce((total, leg) => total + leg.qty, 0);
  const totalExitedQty = Number(trade.e1Qty || 0) + Number(trade.e2Qty || 0) + Number(trade.e3Qty || 0);
  
  const exitedQty = Math.min(totalQty, totalExitedQty);

  // --- Dynamic Position Status Logic ---
  let positionStatus = trade.positionStatus || "Open";
  if (totalQty > 0) {
    if (
      exitedQty >= totalQty ||
      (exitedQty === 0 && trade.positionStatus === "Closed" && Number(trade.avgExitPrice) > 0)
    ) {
      positionStatus = "Closed";
    } else if (exitedQty > 0) {
      positionStatus = "Partial";
    } else {
      positionStatus = "Open";
    }
  }

  const remainingQty = positionStatus === "Closed" ? 0 : Math.max(0, totalQty - exitedQty);

  const exitNotional =
    Number(trade.e1Price || 0) * Number(trade.e1Qty || 0) +
    Number(trade.e2Price || 0) * Number(trade.e2Qty || 0) +
    Number(trade.e3Price || 0) * Number(trade.e3Qty || 0);

  const computedAvgExit = exitedQty
    ? exitNotional / exitedQty
    : Number(trade.avgExitPrice || 0);

  const realized =
    (Number(trade.e1Price || 0) - entryPrice) * Number(trade.e1Qty || 0) +
    (Number(trade.e2Price || 0) - entryPrice) * Number(trade.e2Qty || 0) +
    (Number(trade.e3Price || 0) - entryPrice) * Number(trade.e3Qty || 0) +
    (positionStatus === "Closed" && trade.avgExitPrice
      ? (Number(trade.avgExitPrice) - entryPrice) * Math.max(0, totalQty - exitedQty)
      : 0);

  const unrealized = (cmp - entryPrice) * remainingQty;
  const invested = entryPrice * remainingQty;
  const effectiveStop = (baseStop: number) =>
    tslPrice > 0 ? Math.max(baseStop, tslPrice) : baseStop;
  entryLegs[0].stop = effectiveStop(slPrice);
  entryLegs[1].stop = effectiveStop(Number(trade.p1Sl || 0) || slPrice);
  entryLegs[2].stop = effectiveStop(Number(trade.p2Sl || 0) || slPrice);
  const originalPositionRisk = entryLegs.reduce(
    (risk, leg) =>
      risk + (leg.price > 0 && slPrice > 0 ? Math.abs(leg.price - slPrice) * leg.qty : 0),
    0,
  );
  // Open risk is measured on the remaining position at weighted average entry.
  // A global TSL at or above average entry means no capital remains at risk.
  const riskStop = tslPrice > 0 ? tslPrice : slPrice;
  const initialRisk =
    remainingQty > 0 && entryPrice > 0 && riskStop > 0
      ? Math.max(0, entryPrice - riskStop) * remainingQty
      : 0;
  const rewardRiskDenominator =
    totalQty > 0 ? (originalPositionRisk * remainingQty) / totalQty : 0;

  // Profit Protected (Long Only): TSL must be above entry price
  const protectedPerShare = tslPrice > entryPrice ? tslPrice - entryPrice : 0;
  const profitProtected = protectedPerShare * remainingQty;

  const start = new Date(`${trade.date}T00:00:00`);
  const endDate =
    positionStatus === "Closed"
      ? trade.e3Date || trade.e2Date || trade.e1Date || trade.date
      : now.toISOString().slice(0, 10);
  const end = new Date(`${endDate}T00:00:00`);
  const holdingDays = Number.isNaN(start.valueOf())
    ? 0
    : Math.max(0, Math.round((end.valueOf() - start.valueOf()) / 86_400_000));

  const grossPL = realized + unrealized - Number(trade.brokerage || 0);
  const portfolioImpact = shareOfCapital(grossPL, capital);
  const positionSize = entryPrice * totalQty;

  return {
    ...trade,
    avgEntry: entryPrice,
    positionStatus, // Now dynamic: "Closed" | "Partial" | "Open"
    exitedQty,
    openQty: remainingQty,
    remainingQty,
    invested,
    capitalAtRisk: initialRisk,
    profitProtected,
    unrealized,
    realized,
    grossPL,
    stockMove: entryPrice ? ((cmp - entryPrice) * 100) / entryPrice : 0,
    rewardRisk: rewardRiskDenominator ? unrealized / rewardRiskDenominator : 0,
    holdingDays,
    portfolioImpact,
    positionSize,
    currentAllocation: shareOfCapital(invested, capital),
    slPercent: entryPrice && slPrice ? (Math.abs(entryPrice - slPrice) * 100) / entryPrice : 0,
    computedAvgExit,
    cummPF: cummPF + portfolioImpact,
  };
}

export function calculateTradeMetrics(
  trades: Trade[],
  now = new Date(),
  capital = 0,
): TradeMetric[] {
  let running = 0;
  return trades.map((trade) => {
    const metric = calculateTrade(trade, now, running, capital);
    running = metric.cummPF;
    return metric;
  });
}

export function calculatePortfolio(trades: Trade[], capital = 0): PortfolioMetrics {
  const rows = calculateTradeMetrics(trades, new Date(), capital);
  const closed = rows.filter((trade) => trade.positionStatus === "Closed");
  const sum = (pick: (trade: TradeMetric) => number) =>
    rows.reduce((total, trade) => total + pick(trade), 0);
  const realizedPL = sum((trade) => trade.realized);
  const unrealizedPL = sum((trade) => trade.unrealized);
  const invested = sum((trade) => trade.invested);
  const capitalAtRisk = sum((trade) => trade.capitalAtRisk);
  const profitProtected = sum((trade) => trade.profitProtected);
  const grossPL = realizedPL + unrealizedPL;

  return {
    totalTrades: rows.length,
    openPositions: rows.filter((trade) => trade.positionStatus !== "Closed").length,
    winRate: closed.length
      ? (closed.filter((trade) => trade.grossPL > 0).length * 100) / closed.length
      : 0,
    realizedPL,
    unrealizedPL,
    unrealizedPercent: shareOfCapital(unrealizedPL, capital),
    capitalAtRisk,
    capitalAtRiskPercent: shareOfCapital(capitalAtRisk, capital),
    profitProtected,
    profitProtectedPercent: shareOfCapital(profitProtected, capital),
    invested,
    investedPercent: shareOfCapital(invested, capital),
    grossImpact: shareOfCapital(grossPL, capital),
    currentDrawdown: Math.min(0, shareOfCapital(grossPL, capital)),
    capital,
  };
}

export function formatCurrency(value: number, digits = 2) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number, digits = 2) {
  return `${value.toFixed(digits)}%`;
}

export function serializeTrades(trades: Trade[]) {
  return JSON.stringify({ version: 3, trades });
}

export function parseStoredTrades(raw: string | null): Trade[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: number; trades?: unknown };
    if (
      (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) ||
      !Array.isArray(parsed.trades)
    ) {
      return null;
    }
    return parsed.trades
      .filter((trade): trade is Record<string, unknown> =>
        Boolean(trade && typeof trade === "object"),
      )
      .map(normalizeTrade);
  } catch {
    return null;
  }
}

const csvFields: (keyof Trade)[] = [
  "tradeNo",
  "date",
  "name",
  "setup",
  "side",
  "entry",
  "avgEntry",
  "sl",
  "cmp",
  "entryType",
  "initialQty",
  "p1Price",
  "p1Qty",
  "p1Date",
  "p1Sl",
  "p2Price",
  "p2Qty",
  "p2Date",
  "p2Sl",
  "tsl",
  "tslGroups",
  "peakAllocation",
  "e1Price",
  "e1Qty",
  "e1Date",
  "e2Price",
  "e2Qty",
  "e2Date",
  "e3Price",
  "e3Qty",
  "e3Date",
  "avgExitPrice",
  "positionStatus",
  "planFollowed",
  "exitTrigger",
  "growthAreas",
  "baseDuration",
  "quickNote",
  "brokerage",
];

const numericCsvFields = new Set<keyof Trade>([
  "tradeNo",
  "entry",
  "avgEntry",
  "initialQty",
  "sl",
  "cmp",
  "p1Price",
  "p1Qty",
  "p1Sl",
  "p2Price",
  "p2Qty",
  "p2Sl",
  "e1Price",
  "e1Qty",
  "e2Price",
  "e2Qty",
  "e3Price",
  "e3Qty",
  "tsl",
  "peakAllocation",
  "avgExitPrice",
  "brokerage",
]);

const csvEscape = (value: unknown) => {
  const string = String(value ?? "");
  return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
};

export function tradesToCsv(trades: Trade[]) {
  return [
    csvFields.join(","),
    ...trades.map((trade) => csvFields.map((field) => csvEscape(trade[field])).join(",")),
  ].join("\n");
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

export function tradesFromCsv(csv: string): Trade[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]) as (keyof Trade)[];
  return lines.slice(1).map((line, rowIndex) => {
    const cells = splitCsvLine(line);
    const record = Object.fromEntries(
      headers.map((header, index) => [header, cells[index] ?? ""]),
    ) as Record<string, string>;
    const trade = normalizeTrade({
      ...record,
      tradeNo: finite(record.tradeNo) || rowIndex + 1,
      name: record.name || "Imported trade",
    });
    for (const field of csvFields) {
      if (field in record) {
        (trade as unknown as Record<string, unknown>)[field] = numericCsvFields.has(field)
          ? finite(record[field])
          : record[field];
      }
    }
    trade.side = trade.side === "Sell" ? "Sell" : "Buy";
    trade.positionStatus =
      trade.positionStatus === "Closed"
        ? "Closed"
        : trade.positionStatus === "Partial"
          ? "Partial"
          : "Open";
    return trade;
  });
}
