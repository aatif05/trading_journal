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

/* ============================================================
 * CORE HELPERS
 * ========================================================== */

const closes = (ticks: PriceTick[]) =>
  ticks
    .map((tick) => Number(tick[4]))
    .filter(Number.isFinite);

const volumes = (ticks: PriceTick[]) =>
  ticks
    .map((tick) => Number(tick[5]))
    .filter(Number.isFinite);

const highs = (ticks: PriceTick[]) =>
  ticks
    .map((tick) => Number(tick[2]))
    .filter(Number.isFinite);

const lows = (ticks: PriceTick[]) =>
  ticks
    .map((tick) => Number(tick[3]))
    .filter(Number.isFinite);

const avg = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

const pct = (a: number, b: number) =>
  b !== 0 ? ((a - b) / b) * 100 : 0;

const sma = (values: number[], period: number) => {
  if (values.length < period) return null;
  return avg(values.slice(-period));
};

function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);

  let result = avg(values.slice(0, period));

  for (let i = period; i < values.length; i++) {
    result =
      (values[i] - result) * multiplier + result;
  }

  return result;
}

function emaSeries(values: number[], period: number): number[] {
  if (values.length < period) return [];

  const multiplier = 2 / (period + 1);
  const result: number[] = [];

  let current = avg(values.slice(0, period));

  result.push(current);

  for (let i = period; i < values.length; i++) {
    current =
      (values[i] - current) * multiplier + current;

    result.push(current);
  }

  return result;
}

function standardDeviation(values: number[]) {
  if (!values.length) return 0;

  const mean = avg(values);

  const variance =
    values.reduce(
      (sum, value) =>
        sum + Math.pow(value - mean, 2),
      0,
    ) / values.length;

  return Math.sqrt(variance);
}

/* ============================================================
 * TREND / PULLBACK ENGINE
 * ========================================================== */

export type SetupState =
  | "ENTRY"
  | "STRONG WATCH"
  | "HEALTHY PULLBACK"
  | "EXTENDED — DON'T CHASE"
  | "RE-ENTRY WATCH"
  | "BREAKDOWN";

export type TrendHealth = {
  healthy: boolean;
  strong: boolean;

  ema10: number | null;
  ema21: number | null;
  ema10Slope: number;
  ema21Slope: number;

  priceAbove10: boolean;
  priceAbove21: boolean;
  emaStructure: boolean;

  higherLow: boolean;
  recentHigh: number | null;
  recentLow: number | null;

  distanceFromEma10Pct: number;
  distanceFromEma21Pct: number;
};

export type PullbackAnalysis = {
  present: boolean;
  healthy: boolean;
  depthPct: number;
  duration: number;

  volumeRatio: number;
  volatilityRatio: number;

  higherLow: boolean;
  holdsEma21: boolean;
  holdsPriorPivot: boolean;

  contraction: boolean;
  evidence: string[];
};

export type PocketPivot = {
  volumeRatio: number;
  evidence: string[];
  date: string;
};

export type EntryClassification = {
  state: SetupState;

  entry: number;
  stop: number;
  target: number;

  riskPct: number;
  rewardPct: number;
  rr: number;

  pocketPivot: PocketPivot | null;

  trend: TrendHealth;
  pullback: PullbackAnalysis;

  score: number;
  evidence: string[];
};

function recentHigh(
  values: number[],
  period = 20,
) {
  if (!values.length) return null;

  return Math.max(
    ...values.slice(-period),
  );
}

function recentLow(
  values: number[],
  period = 20,
) {
  if (!values.length) return null;

  return Math.min(
    ...values.slice(-period),
  );
}

/**
 * Healthy trend:
 *
 * Price > EMA10 > EMA21
 *
 * EMA10 rising
 * EMA21 rising
 * Recent structure making/holding higher lows
 */
export function detectHealthyTrend(
  ticks: PriceTick[],
): TrendHealth {
  const c = closes(ticks);

  if (c.length < 40) {
    return {
      healthy: false,
      strong: false,
      ema10: null,
      ema21: null,
      ema10Slope: 0,
      ema21Slope: 0,
      priceAbove10: false,
      priceAbove21: false,
      emaStructure: false,
      higherLow: false,
      recentHigh: null,
      recentLow: null,
      distanceFromEma10Pct: 999,
      distanceFromEma21Pct: 999,
    };
  }

  const current = c.at(-1)!;

  const e10 = ema(c, 10);
  const e21 = ema(c, 21);

  const prior10 = ema(
    c.slice(0, -5),
    10,
  );

  const prior21 = ema(
    c.slice(0, -5),
    21,
  );

  const priceAbove10 =
    e10 !== null && current > e10;

  const priceAbove21 =
    e21 !== null && current > e21;

  const emaStructure =
    e10 !== null &&
    e21 !== null &&
    e10 > e21;

  const ema10Slope =
    e10 !== null && prior10 !== null
      ? pct(e10, prior10)
      : 0;

  const ema21Slope =
    e21 !== null && prior21 !== null
      ? pct(e21, prior21)
      : 0;

  /*
   * Higher-low structure.
   *
   * Compare the recent pullback low against
   * the preceding swing/pullback low.
   */
  const recent = c.slice(-30);

  const firstHalf = recent.slice(0, 15);
  const secondHalf = recent.slice(15);

  const firstLow =
    firstHalf.length
      ? Math.min(...firstHalf)
      : null;

  const secondLow =
    secondHalf.length
      ? Math.min(...secondHalf)
      : null;

  const higherLow =
    firstLow !== null &&
    secondLow !== null &&
    secondLow >= firstLow * 0.985;

  const healthy =
    priceAbove21 &&
    emaStructure &&
    ema10Slope > -0.15 &&
    ema21Slope > -0.10 &&
    higherLow;

  const strong =
    healthy &&
    priceAbove10 &&
    ema10Slope > 0 &&
    ema21Slope > 0;

  return {
    healthy,
    strong,
    ema10: e10,
    ema21: e21,
    ema10Slope,
    ema21Slope,
    priceAbove10,
    priceAbove21,
    emaStructure,
    higherLow,
    recentHigh: recentHigh(c),
    recentLow: recentLow(c),
    distanceFromEma10Pct:
      e10 !== null
        ? Math.abs(pct(current, e10))
        : 999,
    distanceFromEma21Pct:
      e21 !== null
        ? Math.abs(pct(current, e21))
        : 999,
  };
}

/**
 * Pullback analysis.
 *
 * Healthy pullback characteristics:
 *
 * - price remains above / around EMA21
 * - pullback is not deep
 * - volume contracts
 * - volatility contracts
 * - prior higher-low structure survives
 */
export function detectHealthyPullback(
  ticks: PriceTick[],
): PullbackAnalysis {
  const c = closes(ticks);
  const v = volumes(ticks);
  const h = highs(ticks);
  const l = lows(ticks);

  if (c.length < 35) {
    return {
      present: false,
      healthy: false,
      depthPct: 0,
      duration: 0,
      volumeRatio: 1,
      volatilityRatio: 1,
      higherLow: false,
      holdsEma21: false,
      holdsPriorPivot: false,
      contraction: false,
      evidence: ["Insufficient candle history"],
    };
  }

  const current = c.at(-1)!;

  const e21 = ema(c, 21);

  const lookback = Math.min(
    30,
    c.length,
  );

  const window = c.slice(-lookback);

  const peakIndex =
    window.length > 0
      ? window.indexOf(
          Math.max(...window),
        )
      : -1;

  const peak =
    peakIndex >= 0
      ? window[peakIndex]
      : current;

  const depthPct =
    peak > 0
      ? ((peak - current) / peak) * 100
      : 0;

  /*
   * Count consecutive declining/sideways closes
   * from the latest candle.
   */
  let duration = 0;

  for (
    let i = c.length - 1;
    i > 0 && duration < 12;
    i--
  ) {
    if (c[i] <= c[i - 1] * 1.01) {
      duration++;
    } else {
      break;
    }
  }

  const recentVolume =
    avg(v.slice(-5));

  const priorVolume =
    avg(v.slice(-20, -5));

  const volumeRatio =
    priorVolume > 0
      ? recentVolume / priorVolume
      : 1;

  const recentRanges: number[] = [];

  for (
    let i = Math.max(1, h.length - 5);
    i < h.length;
    i++
  ) {
    if (
      Number.isFinite(h[i]) &&
      Number.isFinite(l[i]) &&
      Number.isFinite(c[i]) &&
      c[i] > 0
    ) {
      recentRanges.push(
        (h[i] - l[i]) / c[i],
      );
    }
  }

  const priorRanges: number[] = [];

  for (
    let i = Math.max(1, h.length - 20);
    i < Math.max(1, h.length - 5);
    i++
  ) {
    if (
      Number.isFinite(h[i]) &&
      Number.isFinite(l[i]) &&
      Number.isFinite(c[i]) &&
      c[i] > 0
    ) {
      priorRanges.push(
        (h[i] - l[i]) / c[i],
      );
    }
  }

  const recentVolatility =
    avg(recentRanges);

  const priorVolatility =
    avg(priorRanges);

  const volatilityRatio =
    priorVolatility > 0
      ? recentVolatility /
        priorVolatility
      : 1;

  const contraction =
    volumeRatio <= 0.85 &&
    volatilityRatio <= 0.90;

  const holdsEma21 =
    e21 !== null &&
    current >= e21 * 0.985;

  /*
   * Higher-low preservation.
   */
  const priorSection =
    c.slice(-25, -10);

  const recentSection =
    c.slice(-10);

  const priorLow =
    priorSection.length
      ? Math.min(...priorSection)
      : current;

  const recentLow =
    recentSection.length
      ? Math.min(...recentSection)
      : current;

  const higherLow =
    recentLow >=
    priorLow * 0.985;

  /*
   * Prior pivot protection.
   *
   * Use the lowest close before the latest
   * impulse as a conservative structural level.
   */
  const pivotReference =
    c.length >= 30
      ? Math.min(
          ...c.slice(-30, -10),
        )
      : current;

  const holdsPriorPivot =
    current >=
    pivotReference * 0.985;

  const present =
    peak > current * 1.01;

  const healthy =
    present &&
    depthPct <= 12 &&
    duration <= 12 &&
    holdsEma21 &&
    higherLow &&
    holdsPriorPivot;

  const evidence: string[] = [];

  evidence.push(
    `Pullback depth ${depthPct.toFixed(1)}%`,
  );

  evidence.push(
    `Volume ${(
      volumeRatio * 100
    ).toFixed(0)}% of prior`,
  );

  evidence.push(
    `Volatility ${(
      volatilityRatio * 100
    ).toFixed(0)}% of prior`,
  );

  evidence.push(
    higherLow
      ? "Higher-low structure preserved"
      : "Higher-low structure weakened",
  );

  evidence.push(
    holdsEma21
      ? "Price holding EMA21"
      : "Price below EMA21",
  );

  evidence.push(
    contraction
      ? "Volume and volatility contracting"
      : "Contraction not yet confirmed",
  );

  return {
    present,
    healthy,
    depthPct,
    duration,
    volumeRatio,
    volatilityRatio,
    higherLow,
    holdsEma21,
    holdsPriorPivot,
    contraction,
    evidence,
  };
}

/* ============================================================
 * POCKET PIVOT
 * ========================================================== */

/**
 * Proper Pocket Pivot.
 *
 * IMPORTANT:
 * Only the LAST candle can ever return a Pocket Pivot.
 *
 * Therefore:
 *
 * detectPocketPivot(ticks)
 *
 * can NEVER return a historical Pocket Pivot.
 *
 * This is deliberately independent from VCP/Darvas.
 */
export function detectPocketPivot(
  ticks: PriceTick[],
): PocketPivot | null {
  if (ticks.length < 12) {
    return null;
  }

  const lastIndex =
    ticks.length - 1;

  const latest =
    ticks[lastIndex];

  const previous =
    ticks[lastIndex - 1];

  const close =
    Number(latest[4]);

  const previousClose =
    Number(previous[4]);

  const volume =
    Number(latest[5]);

  if (
    !Number.isFinite(close) ||
    !Number.isFinite(previousClose) ||
    !Number.isFinite(volume)
  ) {
    return null;
  }

  /*
   * Pocket Pivot requires an up-close.
   */
  if (close <= previousClose) {
    return null;
  }

  let maxDownVolume = 0;

  /*
   * Previous 10 sessions.
   * Current candle excluded.
   */
  const start =
    Math.max(
      1,
      lastIndex - 10,
    );

  for (
    let i = start;
    i < lastIndex;
    i++
  ) {
    const dayClose =
      Number(ticks[i][4]);

    const priorClose =
      Number(ticks[i - 1][4]);

    const dayVolume =
      Number(ticks[i][5]);

    if (
      !Number.isFinite(dayClose) ||
      !Number.isFinite(priorClose) ||
      !Number.isFinite(dayVolume)
    ) {
      continue;
    }

    if (
      dayClose < priorClose
    ) {
      maxDownVolume =
        Math.max(
          maxDownVolume,
          dayVolume,
        );
    }
  }

  if (
    maxDownVolume <= 0 ||
    volume <= maxDownVolume
  ) {
    return null;
  }

  const volumeRatio =
    volume / maxDownVolume;

  return {
    volumeRatio,
    date: String(latest[0]),
    evidence: [
      `Latest session volume ${volumeRatio.toFixed(
        2,
      )}x largest prior down-day volume`,
      "Latest candle closed higher than previous session",
      "Pocket Pivot occurred on the latest available candle",
    ],
  };
}

/* ============================================================
 * ENTRY ENGINE
 * ========================================================== */

/**
 * Complete setup classification.
 *
 * This function is the central decision engine for:
 *
 * Fresh setups
 * Re-entry setups
 * Pullbacks
 * Pocket Pivots
 * Risk/reward
 *
 * It intentionally does NOT return BUY/SELL.
 */
export function classifyEntrySetup(
  ticks: PriceTick[],
): EntryClassification | null {
  const c = closes(ticks);

  if (c.length < 45) {
    return null;
  }

  const current =
    c.at(-1)!;

  const trend =
    detectHealthyTrend(ticks);

  const pullback =
    detectHealthyPullback(ticks);

  const pocketPivot =
    detectPocketPivot(ticks);

  const e10 =
    trend.ema10;

  const e21 =
    trend.ema21;

  if (
    e10 === null ||
    e21 === null
  ) {
    return null;
  }

  const high20 =
    recentHigh(c, 20) ??
    current;

  const low20 =
    recentLow(c, 20) ??
    current;

  /*
   * Structural stop.
   *
   * Prefer pullback low, then EMA21.
   */
  const structuralStop =
    Math.min(
      low20,
      e21,
    );

  const stop =
    structuralStop > 0 &&
    structuralStop < current
      ? structuralStop
      : e21;

  const target =
    high20 > current
      ? high20
      : current *
        1.10;

  const risk =
    current - stop;

  const reward =
    target - current;

  const riskPct =
    current > 0
      ? (risk / current) * 100
      : 999;

  const rewardPct =
    current > 0
      ? (reward / current) * 100
      : 0;

  const rr =
    risk > 0
      ? reward / risk
      : 0;

  /*
   * Extended means the stock is healthy but
   * too far above the 10/21 EMA structure.
   */
  const extended =
    trend.distanceFromEma10Pct > 8 ||
    trend.distanceFromEma21Pct > 12 ||
    current > high20 * 0.99 &&
    !pullback.present;

  /*
   * Breakdown takes priority.
   */
  const breakdown =
    !trend.priceAbove21 &&
    !pullback.holdsEma21;

  /*
   * Score the setup.
   */
  let score = 0;

  const evidence: string[] = [];

  if (trend.emaStructure) {
    score += 20;
    evidence.push(
      "10 EMA above 21 EMA",
    );
  }

  if (trend.priceAbove10) {
    score += 10;
    evidence.push(
      "Price above 10 EMA",
    );
  }

  if (trend.priceAbove21) {
    score += 10;
    evidence.push(
      "Price above 21 EMA",
    );
  }

  if (trend.ema10Slope > 0) {
    score += 10;
    evidence.push(
      "10 EMA rising",
    );
  }

  if (trend.ema21Slope > 0) {
    score += 10;
    evidence.push(
      "21 EMA rising",
    );
  }

  if (trend.higherLow) {
    score += 10;
    evidence.push(
      "Higher-low structure intact",
    );
  }

  if (pullback.healthy) {
    score += 15;
    evidence.push(
      "Healthy pullback",
    );
  }

  if (pullback.contraction) {
    score += 10;
    evidence.push(
      "Volume/volatility contraction",
    );
  }

  if (pocketPivot) {
    score += 15;
    evidence.push(
      "Fresh Pocket Pivot on latest candle",
    );
  }

  if (rr >= 3) {
    score += 15;
    evidence.push(
      `R:R ${rr.toFixed(1)}:1`,
    );
  } else if (rr >= 2) {
    score += 10;
    evidence.push(
      `R:R ${rr.toFixed(1)}:1`,
    );
  } else if (rr < 1.5) {
    score -= 20;
    evidence.push(
      `Poor R:R ${rr.toFixed(1)}:1`,
    );
  }

  let state: SetupState;

  if (breakdown) {
    state =
      "BREAKDOWN";
  } else if (extended) {
    state =
      "EXTENDED — DON'T CHASE";
  } else if (
    pocketPivot &&
    trend.healthy &&
    pullback.healthy &&
    rr >= 2
  ) {
    state = "ENTRY";
  } else if (
    trend.strong &&
    pullback.healthy &&
    pullback.contraction &&
    rr >= 2
  ) {
    state =
      "STRONG WATCH";
  } else if (
    pullback.healthy
  ) {
    state =
      "HEALTHY PULLBACK";
  } else if (
    trend.healthy &&
    (
      pullback.present ||
      trend.distanceFromEma21Pct <= 6
    )
  ) {
    state =
      "STRONG WATCH";
  } else {
    state =
      "HEALTHY PULLBACK";
  }

  return {
    state,
    entry: current,
    stop,
    target,
    riskPct,
    rewardPct,
    rr,
    pocketPivot,
    trend,
    pullback,
    score,
    evidence,
  };
}

/**
 * Separate re-entry engine.
 *
 * A re-entry is NOT generated merely because:
 *
 * - price is near MA20
 * - range is tight
 * - a historical Pocket Pivot exists
 *
 * A re-entry requires:
 *
 * 1. Existing trade
 * 2. Original entry is respected
 * 3. Original SL is respected
 * 4. Healthy trend
 * 5. Healthy pullback
 * 6. Higher-low structure
 * 7. Fresh confirmation OR very strong setup
 */
export type ReEntryClassification = {
  state:
    | "RE-ENTRY WATCH"
    | "ENTRY"
    | "BREAKDOWN"
    | "EXTENDED — DON'T CHASE";

  current: number;
  entry: number;
  stop: number;
  target: number;

  riskPct: number;
  rewardPct: number;
  rr: number;

  pocketPivot: PocketPivot | null;

  trend: TrendHealth;
  pullback: PullbackAnalysis;

  evidence: string[];
};

export function classifyReEntry(
  ticks: PriceTick[],
  originalEntry: number,
  originalStop: number,
): ReEntryClassification | null {
  const setup =
    classifyEntrySetup(ticks);

  if (!setup) {
    return null;
  }

  const current =
    setup.entry;

  /*
   * Never average down.
   */
  if (
    current <= originalEntry ||
    current <= originalStop
  ) {
    return {
      ...setup,
      state: "BREAKDOWN",
      entry: current,
      stop: originalStop,
      target: setup.target,
    };
  }

  if (
    setup.state ===
    "BREAKDOWN"
  ) {
    return {
      ...setup,
      state: "BREAKDOWN",
      entry: current,
      stop: originalStop,
      target: setup.target,
    };
  }

  if (
    setup.state ===
    "EXTENDED — DON'T CHASE"
  ) {
    return {
      ...setup,
      state:
        "EXTENDED — DON'T CHASE",
      entry: current,
      stop: originalStop,
      target: setup.target,
    };
  }

  const risk =
    current - originalStop;

  const reward =
    setup.target - current;

  const rr =
    risk > 0
      ? reward / risk
      : 0;

  /*
   * Re-entry confirmation.
   *
   * Pocket Pivot must be fresh because
   * detectPocketPivot only evaluates the
   * latest candle.
   */
  const confirmed =
    setup.pocketPivot !== null &&
    setup.trend.healthy &&
    setup.pullback.healthy &&
    setup.pullback.higherLow &&
    rr >= 2;

  const strongWatch =
    setup.trend.strong &&
    setup.pullback.healthy &&
    setup.pullback.contraction &&
    rr >= 2;

  let state:
    | "RE-ENTRY WATCH"
    | "ENTRY"
    | "BREAKDOWN"
    | "EXTENDED — DON'T CHASE";

  if (confirmed) {
    state = "ENTRY";
  } else if (strongWatch) {
    state = "RE-ENTRY WATCH";
  } else {
    state = "RE-ENTRY WATCH";
  }

  const evidence = [
    ...setup.evidence,
    "Original entry respected",
    "Original stop respected",
    `Re-entry R:R ${rr.toFixed(1)}:1`,
  ];

  return {
    state,
    current,
    entry: current,
    stop: originalStop,
    target: setup.target,
    riskPct:
      current > 0
        ? (risk / current) * 100
        : 999,
    rewardPct:
      current > 0
        ? (reward / current) * 100
        : 0,
    rr,
    pocketPivot:
      setup.pocketPivot,
    trend:
      setup.trend,
    pullback:
      setup.pullback,
    evidence,
  };
}

/* ============================================================
 * VCP
 * ========================================================== */

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

  for (
    let i = window;
    i < highArr.length - window;
    i++
  ) {
    const highWindow =
      highArr.slice(
        i - window,
        i + window + 1,
      );

    if (
      highArr[i] ===
      Math.max(...highWindow)
    ) {
      points.push({
        index: i,
        type: "high",
        price: highArr[i],
      });
    }

    const lowWindow =
      lowArr.slice(
        i - window,
        i + window + 1,
      );

    if (
      lowArr[i] ===
      Math.min(...lowWindow)
    ) {
      points.push({
        index: i,
        type: "low",
        price: lowArr[i],
      });
    }
  }

  points.sort(
    (a, b) =>
      a.index - b.index,
  );

  const alternating: SwingPoint[] = [];

  for (const point of points) {
    const last =
      alternating.at(-1);

    if (!last) {
      alternating.push(point);
    } else if (
      last.type === point.type
    ) {
      const keepNew =
        point.type === "high"
          ? point.price >
            last.price
          : point.price <
            last.price;

      if (keepNew) {
        alternating[
          alternating.length - 1
        ] = point;
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

  for (
    let i = 0;
    i < points.length - 1;
    i++
  ) {
    const a = points[i];
    const b = points[i + 1];

    if (
      a.type === "high" &&
      b.type === "low"
    ) {
      const segment =
        volumeSlice.slice(
          a.index,
          b.index + 1,
        );

      const avgVolume =
        segment.length
          ? avg(segment)
          : 0;

      contractions.push({
        high: a.price,
        low: b.price,
        depthPct:
          (a.price - b.price) /
          a.price,
        avgVolume,
      });
    }
  }

  return contractions;
}

function detectVCP(
  ticks: PriceTick[],
): {
  pivot: number;
  confidence:
    | "Low"
    | "Medium"
    | "High";
  evidence: string[];
} | null {
  const h = highs(ticks);
  const l = lows(ticks);
  const v = volumes(ticks);
  const c = closes(ticks);

  if (h.length < 40) {
    return null;
  }

  const LOOKBACK = 90;

  const start =
    Math.max(
      0,
      h.length - LOOKBACK,
    );

  const points =
    findSwingPoints(
      h.slice(start),
      l.slice(start),
      3,
    );

  const contractions =
    buildContractions(
      points,
      v.slice(start),
    );

  const last =
    contractions.slice(-4);

  if (last.length < 2) {
    return null;
  }

  const validSequence =
    last.every(
      (leg, i) =>
        i === 0 ||
        (
          leg.depthPct <=
            last[i - 1]
              .depthPct *
              1.15 &&
          leg.avgVolume <=
            last[i - 1]
              .avgVolume *
              1.15
        ),
    );

  if (!validSequence) {
    return null;
  }

  const finalLeg =
    last.at(-1)!;

  if (
    finalLeg.depthPct > 0.15
  ) {
    return null;
  }

  const pivot =
    finalLeg.high;

  const lastClose =
    c.at(-1) ?? 0;

  const nearPivot =
    lastClose >=
    pivot * 0.97;

  const avgVolRecent =
    avg(v.slice(-10));

  const avgVolPrior =
    avg(v.slice(-30, -10));

  const volumeDry =
    avgVolPrior > 0 &&
    avgVolRecent <
      avgVolPrior * 0.8;

  const confidence =
    last.length >= 3 &&
    nearPivot &&
    volumeDry
      ? "High"
      : nearPivot ||
          volumeDry
        ? "Medium"
        : "Low";

  return {
    pivot,
    confidence,
    evidence: [
      `${last.length} successive contractions detected`,
      `Final pullback ${(
        finalLeg.depthPct * 100
      ).toFixed(1)}% deep`,
      volumeDry
        ? "Volume has dried up into the pivot"
        : "Volume not yet confirming dry-up",
      nearPivot
        ? "Price is near the pivot high"
        : "Price remains below the pivot",
    ],
  };
}

/* ============================================================
 * DARVAS
 * ========================================================== */

function findDarvasBox(
  h: number[],
  l: number[],
  ticks: PriceTick[],
  CONFIRM_DAYS = 3,
  LOOKBACK = 40,
  MAX_BOX_DAYS = 15,
): {
  top: number;
  bottom: number;
  topDate: string;
  bottomDate: string;
} | null {
  const start =
    Math.max(
      0,
      h.length - LOOKBACK,
    );

  const hi =
    h.slice(start);

  const lo =
    l.slice(start);

  let topIndex = -1;
  let top = -Infinity;

  for (
    let i = 0;
    i < hi.length - CONFIRM_DAYS;
    i++
  ) {
    if (hi[i] <= top) {
      continue;
    }

    const holds =
      hi
        .slice(
          i + 1,
          i + 1 + CONFIRM_DAYS,
        )
        .every(
          (v) => v <= hi[i],
        );

    if (holds) {
      top = hi[i];
      topIndex = i;
    }
  }

  if (topIndex === -1) {
    return null;
  }

  const bottomSearchEnd =
    Math.min(
      lo.length - CONFIRM_DAYS,
      topIndex +
        1 +
        MAX_BOX_DAYS,
    );

  let bottomIndex = -1;
  let bottom = Infinity;

  for (
    let i = topIndex + 1;
    i < bottomSearchEnd;
    i++
  ) {
    if (lo[i] >= bottom) {
      continue;
    }

    const holds =
      lo
        .slice(
          i + 1,
          i + 1 + CONFIRM_DAYS,
        )
        .every(
          (v) => v >= lo[i],
        );

    if (holds) {
      bottom = lo[i];
      bottomIndex = i;
    }
  }

  if (bottomIndex === -1) {
    return null;
  }

  const heightPct =
    (top - bottom) /
    top;

  if (heightPct > 0.2) {
    return null;
  }

  return {
    top,
    bottom,
    topDate:
      ticks[
        start + topIndex
      ][0],
    bottomDate:
      ticks[
        start + bottomIndex
      ][0],
  };
}

/* ============================================================
 * PATTERN RADAR
 * ========================================================== */

export function detectPatterns(
  symbol: string,
  ticks: PriceTick[],
): PatternCandidate[] {
  const c = closes(ticks);
  const v = volumes(ticks);

  if (c.length < 30) {
    return [];
  }

  const recent =
    c.slice(-20);

  const result:
    PatternCandidate[] = [];

  const vcp =
    detectVCP(ticks);

  if (vcp) {
    result.push({
      symbol,
      pattern: "VCP",
      confidence:
        vcp.confidence,
      evidence:
        vcp.evidence,
      breakoutLevel:
        vcp.pivot,
      series: recent,
    });
  }

  const h = highs(ticks);
  const l = lows(ticks);

  const box =
    findDarvasBox(
      h,
      l,
      ticks,
    );

  if (box) {
    const last =
      c.at(-1) ?? 0;

    const avgVolRecent =
      avg(v.slice(-10));

    const avgVolPrior =
      avg(v.slice(-30, -10));

    const volumeRatio =
      avgVolPrior > 0
        ? avgVolRecent /
          avgVolPrior
        : 0;

    const brokeOut =
      last > box.top;

    const nearBox =
      last >=
        box.top * 0.97 &&
      last <= box.top;

    if (
      brokeOut ||
      nearBox
    ) {
      result.push({
        symbol,
        pattern:
          "Darvas Box",
        confidence:
          brokeOut &&
          volumeRatio >= 1.5
            ? "High"
            : brokeOut
              ? "Medium"
              : "Low",
        evidence: [
          `Box: ₹${box.bottom.toFixed(
            2,
          )} – ₹${box.top.toFixed(
            2,
          )}`,
          brokeOut
            ? "Price has broken above the box top"
            : "Price is approaching the box top, not yet confirmed",
          volumeRatio >= 1.5
            ? "Volume confirms the move"
            : "Volume has not yet confirmed",
        ],
        breakoutLevel:
          box.top,
        stopLevel:
          box.bottom,
        boxStart:
          box.topDate,
        boxEnd:
          box.bottomDate,
        series: recent,
      });
    }
  }

  return result;
}

/* ============================================================
 * THEME ENGINE
 * ========================================================== */

export type ThemeSummary = {
  theme: string;
  symbols: string[];
  return20d: number | null;
  breadth: number;
  momentum:
    | "Leading"
    | "Mixed"
    | "Lagging";
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
  "ETERNAL",
  "DLF",
];

const THEME_MAP:
  Record<string, string> = {
    RELIANCE:
      "Energy & Conglomerates",
    TCS: "IT Services",
    INFY: "IT Services",
    HDFCBANK:
      "Private Banks",
    ICICIBANK:
      "Private Banks",
    SBIN: "Public Banks",
    LT: "Capital Goods",
    SUNPHARMA: "Pharma",
    BHARTIARTL: "Telecom",
  };

export function themeForSymbol(
  symbol: string,
) {
  return (
    THEME_MAP[
      symbol
        .replace(/^EQ:/, "")
        .toUpperCase()
    ] ??
    "Unclassified"
  );
}

export function summarizeThemes(
  series: Array<{
    symbol: string;
    ticks: PriceTick[];
  }>,
): ThemeSummary[] {
  const grouped =
    new Map<
      string,
      Array<{
        symbol: string;
        return20d:
          | number
          | null;
      }>
    >();

  for (const item of series) {
    const c =
      closes(item.ticks);

    const theme =
      themeForSymbol(
        item.symbol,
      );

    const entry =
      c.length >= 21
        ? (c.at(-1)! /
            c.at(-21)! -
            1) *
          100
        : null;

    const list =
      grouped.get(theme) ??
      [];

    list.push({
      symbol:
        item.symbol,
      return20d:
        entry,
    });

    grouped.set(
      theme,
      list,
    );
  }

  const valid = [
    ...grouped.values(),
  ]
    .flatMap((items) =>
      items.map(
        (item) =>
          item.return20d,
      ),
    )
    .filter(
      (
        value,
      ): value is number =>
        value !== null,
    );

  const median =
    valid.length
      ? avg(valid)
      : 0;

  return [...grouped]
    .map(
      ([theme, items]) => {
        const values =
          items
            .map(
              (item) =>
                item.return20d,
            )
            .filter(
              (
                value,
              ): value is number =>
                value !== null,
            );

        const return20d =
          values.length
            ? avg(values)
            : null;

        const breadth =
          values.length
            ? (
                values.filter(
                  (value) =>
                    value > 0,
                ).length /
                values.length
              ) * 100
            : 0;

        const momentum:
          ThemeSummary["momentum"] =
          return20d === null
            ? "Mixed"
            : return20d >
                median + 1
              ? "Leading"
              : return20d <
                  median - 1
                ? "Lagging"
                : "Mixed";

        return {
          theme,
          symbols:
            items.map(
              (item) =>
                item.symbol,
            ),
          return20d,
          breadth,
          momentum,
        };
      },
    )
    .sort(
      (a, b) =>
        (b.return20d ??
          -Infinity) -
        (a.return20d ??
          -Infinity),
    );
}
