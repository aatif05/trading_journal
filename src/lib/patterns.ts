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

const closes = (ticks: PriceTick[]) =>
  ticks.map((tick) => Number(tick[4])).filter(Number.isFinite);

const volumes = (ticks: PriceTick[]) =>
  ticks.map((tick) => Number(tick[5])).filter(Number.isFinite);

const highs = (ticks: PriceTick[]) =>
  ticks.map((tick) => Number(tick[2])).filter(Number.isFinite);

const lows = (ticks: PriceTick[]) =>
  ticks.map((tick) => Number(tick[3])).filter(Number.isFinite);

const avg = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

const range = (values: number[]) =>
  values.length ? Math.max(...values) - Math.min(...values) : 0;

/**
 * Finds the most recent Darvas Box: a confirmed top (a high that isn't
 * exceeded for CONFIRM_DAYS bars afterward), followed by a confirmed bottom
 * (a low that isn't broken for CONFIRM_DAYS bars afterward), found within
 * MAX_BOX_DAYS of the top so the box stays a genuine short consolidation
 * rather than grabbing the deepest low anywhere in the whole lookback window.
 */
function findDarvasBox(
  h: number[],
  l: number[],
  ticks: PriceTick[],
  CONFIRM_DAYS = 3,
  LOOKBACK = 40,
  MAX_BOX_DAYS = 15,
): { top: number; bottom: number; topDate: string; bottomDate: string } | null {
  const start = Math.max(0, h.length - LOOKBACK);
  const hi = h.slice(start);
  const lo = l.slice(start);

  let topIndex = -1;
  let top = -Infinity;

  for (let i = 0; i < hi.length - CONFIRM_DAYS; i++) {
    if (hi[i] <= top) continue;

    const holds = hi
      .slice(i + 1, i + 1 + CONFIRM_DAYS)
      .every((v) => v <= hi[i]);

    if (holds) {
      top = hi[i];
      topIndex = i;
    }
  }

  if (topIndex === -1) return null;

  const bottomSearchEnd = Math.min(
    lo.length - CONFIRM_DAYS,
    topIndex + 1 + MAX_BOX_DAYS,
  );

  let bottomIndex = -1;
  let bottom = Infinity;

  for (let i = topIndex + 1; i < bottomSearchEnd; i++) {
    if (lo[i] >= bottom) continue;

    const holds = lo
      .slice(i + 1, i + 1 + CONFIRM_DAYS)
      .every((v) => v >= lo[i]);

    if (holds) {
      bottom = lo[i];
      bottomIndex = i;
    }
  }

  if (bottomIndex === -1) return null;

  const heightPct = (top - bottom) / top;

  if (heightPct > 0.2) return null;

  return {
    top,
    bottom,
    topDate: ticks[start + topIndex][0],
    bottomDate: ticks[start + bottomIndex][0],
  };
}

type SwingPoint = {
  index: number;
  type: "high" | "low";
  price: number;
};

function findSwingPoints(
  highArr: number[],
  lowArr: number[],
  window = 3,
): SwingPoint[] {
  const points: SwingPoint[] = [];

  for (let i = window; i < highArr.length - window; i++) {
    const highWindow = highArr.slice(i - window, i + window + 1);

    if (highArr[i] === Math.max(...highWindow)) {
      points.push({
        index: i,
        type: "high",
        price: highArr[i],
      });
    }

    const lowWindow = lowArr.slice(i - window, i + window + 1);

    if (lowArr[i] === Math.min(...lowWindow)) {
      points.push({
        index: i,
        type: "low",
        price: lowArr[i],
      });
    }
  }

  points.sort((a, b) => a.index - b.index);

  const alternating: SwingPoint[] = [];

  for (const point of points) {
    const last = alternating.at(-1);

    if (!last) {
      alternating.push(point);
    } else if (last.type === point.type) {
      const keepNew =
        point.type === "high"
          ? point.price > last.price
          : point.price < last.price;

      if (keepNew) {
        alternating[alternating.length - 1] = point;
      }
    } else {
      alternating.push(point);
    }
  }

  return alternating;
}

type Contraction = {
  high: number;
  low: number;
  depthPct: number;
  avgVolume: number;
};

function buildContractions(
  points: SwingPoint[],
  volumeSlice: number[],
): Contraction[] {
  const contractions: Contraction[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];

    if (a.type === "high" && b.type === "low") {
      const segment = volumeSlice.slice(a.index, b.index + 1);

      const avgVolume = segment.length
        ? segment.reduce((sum, val) => sum + val, 0) / segment.length
        : 0;

      contractions.push({
        high: a.price,
        low: b.price,
        depthPct: (a.price - b.price) / a.price,
        avgVolume,
      });
    }
  }

  return contractions;
}

/**
 * Detects a genuine Volatility Contraction Pattern: a sequence of at least
 * two successive pullbacks, each shallower and lower-volume than the last,
 * settling into a tight final pivot.
 */
function detectVCP(
  ticks: PriceTick[],
): {
  pivot: number;
  confidence: "Low" | "Medium" | "High";
  evidence: string[];
} | null {
  const h = highs(ticks);
  const l = lows(ticks);
  const v = volumes(ticks);
  const c = closes(ticks);

  if (h.length < 40) return null;

  const LOOKBACK = 90;
  const start = Math.max(0, h.length - LOOKBACK);

  const points = findSwingPoints(
    h.slice(start),
    l.slice(start),
    3,
  );

  const contractions = buildContractions(
    points,
    v.slice(start),
  );

  const last = contractions.slice(-4);

  if (last.length < 2) return null;

  const validSequence = last.every(
    (leg, i) =>
      i === 0 ||
      (
        leg.depthPct <= last[i - 1].depthPct * 1.15 &&
        leg.avgVolume <= last[i - 1].avgVolume * 1.15
      ),
  );

  if (!validSequence) return null;

  const finalLeg = last.at(-1)!;

  if (finalLeg.depthPct > 0.15) return null;

  const pivot = finalLeg.high;

  const lastClose = c.at(-1) ?? 0;

  const nearPivot = lastClose >= pivot * 0.97;

  const avgVolRecent = avg(v.slice(-10));
  const avgVolPrior = avg(v.slice(-30, -10));

  const volumeDry =
    avgVolPrior > 0 &&
    avgVolRecent < avgVolPrior * 0.8;

  const confidence: "Low" | "Medium" | "High" =
    last.length >= 3 && nearPivot && volumeDry
      ? "High"
      : nearPivot || volumeDry
        ? "Medium"
        : "Low";

  return {
    pivot,
    confidence,
    evidence: [
      `${last.length} successive contractions detected`,
      `Final pullback ${(finalLeg.depthPct * 100).toFixed(1)}% deep`,
      volumeDry
        ? "Volume has dried up into the pivot"
        : "Volume not yet confirming dry-up",
      nearPivot
        ? "Price is near the pivot high"
        : "Price remains below the pivot",
    ],
  };
}

/**
 * Detects a Pocket Pivot on the most recent completed bar.
 *
 * Rules used:
 * - The latest close must be higher than the previous close.
 * - Latest volume must exceed the maximum volume of a down-close
 *   session during the previous 10 sessions.
 *
 * This is an independent signal and does not alter VCP or Darvas detection.
 */
export function detectPocketPivot(
  ticks: PriceTick[],
): {
  volumeRatio: number;
  evidence: string[];
} | null {
  if (ticks.length < 12) return null;

  const lastIndex = ticks.length - 1;

  const todayClose = Number(ticks[lastIndex][4]);
  const previousClose = Number(ticks[lastIndex - 1][4]);
  const todayVolume = Number(ticks[lastIndex][5]);

  if (
    !Number.isFinite(todayClose) ||
    !Number.isFinite(previousClose) ||
    !Number.isFinite(todayVolume)
  ) {
    return null;
  }

  // Pocket Pivot requires an up-close.
  if (todayClose <= previousClose) {
    return null;
  }

  let maxDownDayVolume = 0;

  const startIndex = Math.max(1, lastIndex - 10);

  for (let i = startIndex; i < lastIndex; i++) {
    const close = Number(ticks[i][4]);
    const previous = Number(ticks[i - 1][4]);
    const volume = Number(ticks[i][5]);

    if (
      !Number.isFinite(close) ||
      !Number.isFinite(previous) ||
      !Number.isFinite(volume)
    ) {
      continue;
    }

    // Down-close session.
    if (close < previous) {
      maxDownDayVolume = Math.max(
        maxDownDayVolume,
        volume,
      );
    }
  }

  // No valid down-volume reference.
  if (maxDownDayVolume <= 0) {
    return null;
  }

  // Today's volume must exceed the largest recent down-day volume.
  if (todayVolume <= maxDownDayVolume) {
    return null;
  }

  const volumeRatio =
    todayVolume / maxDownDayVolume;

  return {
    volumeRatio,
    evidence: [
      `Today's volume is ${volumeRatio.toFixed(2)}x the largest down-day volume in the previous 10 sessions`,
      "Price closed higher on the day",
    ],
  };
}

export function detectPatterns(
  symbol: string,
  ticks: PriceTick[],
): PatternCandidate[] {
  const c = closes(ticks);
  const v = volumes(ticks);

  if (c.length < 30) return [];

  const recent = c.slice(-20);
  const result: PatternCandidate[] = [];

  // VCP detection remains unchanged.
  const vcp = detectVCP(ticks);

  if (vcp) {
    result.push({
      symbol,
      pattern: "VCP",
      confidence: vcp.confidence,
      evidence: vcp.evidence,
      breakoutLevel: vcp.pivot,
      series: recent,
    });
  }

  // Darvas detection remains unchanged.
  const h = highs(ticks);
  const l = lows(ticks);

  const box = findDarvasBox(
    h,
    l,
    ticks,
  );

  if (box) {
    const last = c.at(-1) ?? 0;

    const avgVolRecent = avg(v.slice(-10));
    const avgVolPrior = avg(v.slice(-30, -10));

    const volumeRatio =
      avgVolPrior > 0
        ? avgVolRecent / avgVolPrior
        : 0;

    const brokeOut = last > box.top;

    const nearBox =
      last >= box.top * 0.97 &&
      last <= box.top;

    if (brokeOut || nearBox) {
      result.push({
        symbol,
        pattern: "Darvas Box",
        confidence:
          brokeOut && volumeRatio >= 1.5
            ? "High"
            : brokeOut
              ? "Medium"
              : "Low",
        evidence: [
          `Box: ₹${box.bottom.toFixed(2)} – ₹${box.top.toFixed(2)}`,
          brokeOut
            ? "Price has broken above the box top"
            : "Price is approaching the box top, not yet confirmed",
          volumeRatio >= 1.5
            ? "Volume confirms the move"
            : "Volume has not yet confirmed",
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
  "RELIANCE",
  "TCS",
  "INFY",
  "HDFCBANK",
  "ICICIBANK",
  "SBIN",
  "LT",
  "SUNPHARMA",
  "BHARTIARTL",
  "ITC",
  "AXISBANK",
  "KOTAKBANK",
  "MARUTI",
  "M&M",
  "TATAMOTORS",
  "TATASTEEL",
  "HINDALCO",
  "ADANIENT",
  "ADANIPORTS",
  "NTPC",
  "POWERGRID",
  "ONGC",
  "COALINDIA",
  "BEL",
  "HAL",
  "TRENT",
  "JIOFIN",
  "ZOMATO",
  "DLF",
  "ETERNAL",
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
  return (
    THEME_MAP[
      symbol.replace(/^EQ:/, "").toUpperCase()
    ] ?? "Unclassified"
  );
}

export function summarizeThemes(
  series: Array<{
    symbol: string;
    ticks: PriceTick[];
  }>,
): ThemeSummary[] {
  const grouped = new Map<
    string,
    Array<{
      symbol: string;
      return20d: number | null;
    }>
  >();

  for (const item of series) {
    const c = closes(item.ticks);

    const theme = themeForSymbol(item.symbol);

    const entry =
      c.length >= 21
        ? (c.at(-1)! / c.at(-21)! - 1) * 100
        : null;

    const list = grouped.get(theme) ?? [];

    list.push({
      symbol: item.symbol,
      return20d: entry,
    });

    grouped.set(theme, list);
  }

  const valid = [...grouped.values()]
    .flatMap((items) =>
      items.map((item) => item.return20d),
    )
    .filter(
      (value): value is number =>
        value !== null,
    );

  const median = valid.length
    ? valid.reduce((a, b) => a + b, 0) /
      valid.length
    : 0;

  return [...grouped]
    .map(([theme, items]) => {
      const values = items
        .map((item) => item.return20d)
        .filter(
          (value): value is number =>
            value !== null,
        );

      const return20d = values.length
        ? values.reduce((a, b) => a + b, 0) /
          values.length
        : null;

      const breadth = values.length
        ? (
            values.filter(
              (value) => value > 0,
            ).length /
            values.length
          ) * 100
        : 0;

      const momentum: ThemeSummary["momentum"] =
        return20d === null
          ? "Mixed"
          : return20d > median + 1
            ? "Leading"
            : return20d < median - 1
              ? "Lagging"
              : "Mixed";

      return {
        theme,
        symbols: items.map(
          (item) => item.symbol,
        ),
        return20d,
        breadth,
        momentum,
      };
    })
    .sort(
      (a, b) =>
        (b.return20d ?? -Infinity) -
        (a.return20d ?? -Infinity),
    );
}
