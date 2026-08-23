export type PriceTick = [
  dateTime: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
  dayVolume: number,
];

export type StrikePriceTicksResponse = {
  data?: {
    count?: number;
    fields?: string[];
    ticks?: Record<string, PriceTick[]>;
  };
  error?: string;
};

export type LatestPrices = Record<string, number>;

const STRIKE_BASE = "https://api-v2.strike.money/v2/api/equity/priceticks";

export function normalizeSymbol(name: string) {
  return name.trim().toUpperCase().replace(/^EQ:/, "").replace(/\s+/g, "");
}

export function uniqueSymbols(names: string[]) {
  return [...new Set(names.map(normalizeSymbol).filter(Boolean))];
}

/** Format an IST (+05:30) ISO timestamp for Strike. */
export function toIstIso(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+05:30`;
}

export function latestCloseFromTicks(ticks: PriceTick[] | undefined) {
  if (!ticks?.length) return null;
  const close = Number(ticks[ticks.length - 1]?.[4]);
  return Number.isFinite(close) ? close : null;
}

export function extractLatestPrices(
  payload: StrikePriceTicksResponse,
  requested: string[],
): LatestPrices {
  const ticks = payload.data?.ticks ?? {};
  const prices: LatestPrices = {};

  for (const symbol of requested) {
    const key =
      Object.keys(ticks).find((candidate) => candidate.toUpperCase() === symbol) ?? symbol;
    const close = latestCloseFromTicks(ticks[key]);
    if (close !== null) prices[symbol] = close;
  }

  return prices;
}

export function buildStrikePriceUrl(symbols: string[], now = new Date(), lookbackMinutes = 15) {
  const to = toIstIso(now);
  const from = toIstIso(new Date(now.getTime() - lookbackMinutes * 60_000));
  // Strike only returns ticks when multiple securities are pipe-separated.
  const securities = symbols.map((symbol) => `EQ:${symbol}`).join("|");
  const params = new URLSearchParams({
    candleInterval: "1m",
    from,
    to,
    securities,
  });
  return `${STRIKE_BASE}?${params.toString()}`;
}

/** Widening windows so refreshes still resolve outside market hours. */
const LOOKBACK_MINUTES = [15, 60 * 8, 60 * 24 * 5];

async function fetchChunk(
  symbols: string[],
  lookbackMinutes: number,
  fetchImpl: typeof fetch,
): Promise<LatestPrices> {
  const response = await fetchImpl(buildStrikePriceUrl(symbols, new Date(), lookbackMinutes), {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Strike API responded ${response.status}`);
  }
  const payload = (await response.json()) as StrikePriceTicksResponse;
  return extractLatestPrices(payload, symbols);
}

export async function fetchStrikeTicks(symbol: string, lookbackMinutes = 60 * 24 * 5, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(buildStrikePriceUrl([normalizeSymbol(symbol)], new Date(), lookbackMinutes), { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`Strike API responded ${response.status}`);
  const payload = (await response.json()) as StrikePriceTicksResponse;
  const key = Object.keys(payload.data?.ticks ?? {})[0];
  return key ? (payload.data?.ticks?.[key] ?? []) : [];
}

export async function fetchStrikeLatestPrices(
  symbols: string[],
  fetchImpl: typeof fetch = fetch,
): Promise<LatestPrices> {
  const cleaned = uniqueSymbols(symbols);
  if (!cleaned.length) return {};

  const prices: LatestPrices = {};
  let pending = cleaned;

  for (const lookback of LOOKBACK_MINUTES) {
    const chunks: string[][] = [];
    for (let index = 0; index < pending.length; index += 10) {
      chunks.push(pending.slice(index, index + 10));
    }

    const settled = await Promise.allSettled(
      chunks.map((chunk) => fetchChunk(chunk, lookback, fetchImpl)),
    );

    for (const result of settled) {
      if (result.status === "fulfilled") Object.assign(prices, result.value);
    }

    pending = pending.filter((symbol) => prices[symbol] === undefined);
    if (!pending.length) break;
  }

  return prices;
}

/** Client helper: call our Next.js proxy. */
export async function fetchLatestPrices(symbols: string[]): Promise<LatestPrices> {
  const cleaned = uniqueSymbols(symbols);
  if (!cleaned.length) return {};

  const params = new URLSearchParams({ symbols: cleaned.join(",") });
  const response = await fetch(`/api/prices?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as {
    prices?: LatestPrices;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || `Price refresh failed (${response.status})`);
  }

  return payload.prices ?? {};
}
