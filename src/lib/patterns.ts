import type { PriceTick } from "./prices";

export type PatternCandidate = {
  symbol: string;
  pattern: "VCP" | "Darvas Box";
  confidence: "Low" | "Medium" | "High";
  evidence: string[];
  breakoutLevel: number | null;
  stopLevel?: number | null;
  boxStart?: string | null;
  boxEnd?: string | null;
  series: number[];
};

const closes = (ticks: PriceTick[]) => ticks.map((tick) => Number(tick[4])).filter(Number.isFinite);
const volumes = (ticks: PriceTick[]) => ticks.map((tick) => Number(tick[5])).filter(Number.isFinite);
const highs = (ticks: PriceTick[]) => ticks.map((tick) => Number(tick[2])).filter(Number.isFinite);
const lows = (ticks: PriceTick[]) => ticks.map((tick) => Number(tick[3])).filter(Number.isFinite);

const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const range = (values: number[]) => (values.length ? Math.max(...values) - Math.min(...values) : 0);

function findDarvasBox(
  h: number[],
  l: number[],
  ticks: PriceTick[],
  CONFIRM_DAYS = 3,
  LOOKBACK = 40,
): { top: number; bottom: number; topDate: string; bottomDate: string } | null {
  const start = Math.max(0, h.length - LOOKBACK);
  const hi = h.slice(start);
  const lo = l.slice(start);

  let topIndex = -1;
  let top = -Infinity;
  for (let i = 0; i < hi.length - CONFIRM_DAYS; i++) {
    if (hi[i] <= top) continue;
    const holds = hi.slice(i + 1, i + 1 + CONFIRM_DAYS).every((v) => v <= hi[i]);
    if (holds) {
      top = hi[i];
      topIndex = i;
    }
  }
  if (topIndex === -1) return null;

  let bottomIndex = -1;
  let bottom = Infinity;
  for (let i = topIndex + 1; i < lo.length - CONFIRM_DAYS; i++) {
    if (lo[i] >= bottom) continue;
    const holds = lo.slice(i + 1, i + 1 + CONFIRM_DAYS).every((v) => v >= lo[i]);
    if (holds) {
      bottom = lo[i];
      bottomIndex = i;
    }
  }
  if (bottomIndex === -1) return null;

  return {
    top,
    bottom,
    topDate: ticks[start + topIndex][0],
    bottomDate: ticks[start + bottomIndex][0],
  };
}

export function detectPatterns(symbol: string, ticks: PriceTick[]): PatternCandidate[] {
  const c = closes(ticks);
  const v = volumes(ticks);
  if (c.length < 30) return [];

  const recent = c.slice(-20);
  const earlier = c.slice(-40, -20);

  const recentRange = range(recent);
  const earlierRange = range(earlier.length ? earlier : recent);

  const volumeContracting = avg(v.slice(-10)) < avg(v.slice(-20, -10)) * 0.9;

  const high = Math.max(...recent);
  const last = c.at(-1) ?? 0;
  const nearBreakout = last >= high * 0.97;

  const result: PatternCandidate[] = [];

  if (recentRange < earlierRange * 0.75 && volumeContracting) {
    result.push({
      symbol,
      pattern: "VCP",
      confidence: nearBreakout ? "High" : "Medium",
      evidence: [
        "20-session range contracted",
        "Recent volume is declining",
        nearBreakout ? "Price is near the range high" : "Price remains inside the contraction",
      ],
      breakoutLevel: high,
      series: recent,
    });
  }

  const h = highs(ticks);
  const l = lows(ticks);
  const box = findDarvasBox(h, l, ticks);

  if (box) {
    const avgVolRecent = avg(v.slice(-10));
    const avgVolPrior = avg(v.slice(-30, -10));
    const volumeRatio = avgVolPrior > 0 ? avgVolRecent / avgVolPrior : 0;

    const brokeOut = last > box.top;
    const nearBox = last >= box.top * 0.97 && last <= box.top;

    if (brokeOut || nearBox) {
      result.push({
        symbol,
        pattern: "Darvas Box",
        confidence: brokeOut && volumeRatio >= 1.5 ? "High" : brokeOut ? "Medium" : "Low",
        evidence: [
          `Box: ₹${box.bottom.toFixed(2)} – ₹${box.top.toFixed(2)}`,
          brokeOut
            ? "Price has broken above the box top"
            : "Price is approaching the box top, not yet confirmed",
          volumeRatio >= 1.5 ? "Volume confirms the move" : "Volume has not yet confirmed",
        ],
        breakoutLevel: box.top,
        stopLevel: box.bottom,
        boxStart: box.topDate,
        boxEnd: box.bottomDate,
        series: recent,
      });
    }
  }

  return result;
}

export type ThemeSummary = {
  theme: string;
  symbols: string[];
  return20d: number | null;
  breadth: number;
  momentum: "Leading" | "Mixed" | "Lagging";
};

export const INDIAN_MARKET_UNIVERSE = [
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "LT", "SUNPHARMA",
  "BHARTIARTL", "ITC", "AXISBANK", "KOTAKBANK", "MARUTI", "M&M", "TATAMOTORS",
  "TATASTEEL", "HINDALCO", "ADANIENT", "ADANIPORTS", "NTPC", "POWERGRID", "ONGC",
  "COALINDIA", "BEL", "HAL", "TRENT", "JIOFIN", "ZOMATO", "DLF", "ETERNAL",
];

const THEME_MAP: Record<string, string> = {
  RELIANCE: "Energy & Conglomerates",
  TCS: "IT Services",
  INFY: "IT Services",
  HDFCBANK: "Private Banks",
  ICICIBANK: "Private Banks",
  SBIN: "Public Banks",
  LT: "Capital Goods",
  SUNPHARMA: "Pharma",
  BHARTIARTL: "Telecom",
};

export function themeForSymbol(symbol: string) {
  return THEME_MAP[symbol.replace(/^EQ:/, "").toUpperCase()] ?? "Unclassified";
}

export function summarizeThemes(series: Array<{ symbol: string; ticks: PriceTick[] }>): ThemeSummary[] {
  const grouped = new Map<string, Array<{ symbol: string; return20d: number | null }>>();

  for (const item of series) {
    const c = closes(item.ticks);
    const theme = themeForSymbol(item.symbol);
    const entry = c.length >= 21 ? (c.at(-1)! / c.at(-21)! - 1) * 100 : null;
    const list = grouped.get(theme) ?? [];
    list.push({ symbol: item.symbol, return20d: entry });
    grouped.set(theme, list);
  }

  const valid = [...grouped.values()]
    .flatMap((items) => items.map((item) => item.return20d))
    .filter((value): value is number => value !== null);
  const median = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;

  return [...grouped]
    .map(([theme, items]) => {
      const values = items.map((item) => item.return20d).filter((value): value is number => value !== null);
      const return20d = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      const breadth = values.length ? (values.filter((value) => value > 0).length / values.length) * 100 : 0;
      const momentum: ThemeSummary["momentum"] =
        return20d === null ? "Mixed" : return20d > median + 1 ? "Leading" : return20d < median - 1 ? "Lagging" : "Mixed";
      return { theme, symbols: items.map((item) => item.symbol), return20d, breadth, momentum };
    })
    .sort((a, b) => (b.return20d ?? -Infinity) - (a.return20d ?? -Infinity));
}
