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
    ? values.reduce((sum, value) => sum + value, 0) /
      values.length
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

/**
 * EMA series aligned with the original price array.
 *
 * Unlike emaSeries(), this preserves the original indexes.
 * Before enough candles exist for the EMA, the value is null.
 *
 * This is important when comparing historical candle lows
 * against historical EMA values.
 */
function alignedEmaSeries(
  values: number[],
  period: number,
): Array<number | null> {
  if (!values.length) return [];

  const result: Array<number | null> =
    new Array(values.length).fill(null);

  if (values.length < period) {
    return result;
  }

  const multiplier = 2 / (period + 1);

  let current = avg(
    values.slice(0, period),
  );

  result[period - 1] = current;

  for (
    let i = period;
    i < values.length;
    i++
  ) {
    current =
      (values[i] - current) * multiplier +
      current;

    result[i] = current;
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
  ema50: number | null;

  ema10Slope: number;
  ema21Slope: number;

  priceAbove10: boolean;
  priceAbove21: boolean;
  priceAbove50: boolean;

  emaStructure: boolean;

  higherLow: boolean;
  recentHigh: number | null;
  recentLow: number | null;

  distanceFromEma10Pct: number;
  distanceFromEma21Pct: number;
  distanceFromEma50Pct: number;

  /*
   * Trend quality.
   *
   * 0 = very noisy/non-linear
   * 1 = highly linear trend
   *
   * This is a quality measurement, NOT a hard filter.
   */
  trendLinearity: number;

  /*
   * Controlled shakeout detection.
   *
   * These identify whether price recently tested
   * an important EMA and subsequently recovered.
   */
  shakeoutToEma21: boolean;
  shakeoutToEma50: boolean;
  recoveredFromShakeout: boolean;

  evidence: string[];
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

/* ============================================================
 * TREND LINEARITY / R²
 * ========================================================== */

/**
 * Calculates R² for the price trend.
 *
 * We use log(price) instead of raw price so the calculation
 * behaves more naturally for percentage-based stock movement.
 *
 * Examples:
 *
 * R² ~ 0.80-1.00
 *   Very consistent trend.
 *
 * R² ~ 0.50-0.80
 *   Reasonably orderly trend.
 *
 * R² < 0.50
 *   More volatile / less linear.
 *
 * IMPORTANT:
 *
 * R² is NOT used as a hard rejection.
 *
 * A stock can have a lower R² because of a constructive
 * shakeout and still be healthy if its larger structure,
 * EMA structure and recovery are good.
 */
function calculateTrendLinearity(
  values: number[],
): number {
  if (values.length < 8) {
    return 0;
  }

  const clean =
    values.filter(
      (value) =>
        Number.isFinite(value) &&
        value > 0,
    );

  if (clean.length < 8) {
    return 0;
  }

  const y =
    clean.map((value) =>
      Math.log(value),
    );

  const n = y.length;

  const meanX =
    (n - 1) / 2;

  const meanY =
    avg(y);

  let ssXX = 0;
  let ssXY = 0;
  let ssYY = 0;

  for (
    let i = 0;
    i < n;
    i++
  ) {
    const dx =
      i - meanX;

    const dy =
      y[i] - meanY;

    ssXX +=
      dx * dx;

    ssXY +=
      dx * dy;

    ssYY +=
      dy * dy;
  }

  if (
    ssXX <= 0 ||
    ssYY <= 0
  ) {
    return 0;
  }

  const r =
    ssXY /
    Math.sqrt(
      ssXX * ssYY,
    );

  const r2 =
    r * r;

  return Math.max(
    0,
    Math.min(1, r2),
  );
}

/* ============================================================
 * SHAKEOUT / RECOVERY
 * ========================================================== */

/**
 * Detects controlled shakeouts toward EMA21 / EMA50.
 *
 * We deliberately use LOW prices instead of CLOSE prices.
 *
 * This allows us to detect situations such as:
 *
 *        price
 *          /\
 *         /  \
 *        /    \__
 *              ↓
 *             EMA21
 *              ↑
 *           recovery
 *
 * or a deeper:
 *
 *        price
 *          /\
 *         /  \
 *        /    \
 *             \__
 *                \
 *                EMA50
 *                  ↑
 *               recovery
 *
 * A shakeout is constructive only when price subsequently
 * recovers.
 */
function detectShakeoutRecovery(
  c: number[],
  l: number[],
  ema21Series: Array<number | null>,
  ema50Series: Array<number | null>,
): {
  shakeoutToEma21: boolean;
  shakeoutToEma50: boolean;
  recoveredFromShakeout: boolean;
} {
  if (
    c.length === 0 ||
    l.length === 0
  ) {
    return {
      shakeoutToEma21: false,
      shakeoutToEma50: false,
      recoveredFromShakeout: false,
    };
  }

  const lookback =
    Math.min(
      15,
      c.length,
    );

  const start =
    c.length -
    lookback;

  let shakeoutToEma21 =
    false;

  let shakeoutToEma50 =
    false;

  let shakeout21Index =
    -1;

  let shakeout50Index =
    -1;

  for (
    let i = start;
    i < c.length;
    i++
  ) {
    const low =
      l[i];

    const ema21 =
      ema21Series[i];

    const ema50 =
      ema50Series[i];

    if (
      ema21 !== null &&
      Number.isFinite(ema21) &&
      low <= ema21 * 1.015 &&
      low >= ema21 * 0.94
    ) {
      shakeoutToEma21 =
        true;

      shakeout21Index =
        i;
    }

    if (
      ema50 !== null &&
      Number.isFinite(ema50) &&
      low <= ema50 * 1.05 &&
      low >= ema50 * 0.90
    ) {
      shakeoutToEma50 =
        true;

      shakeout50Index =
        i;
    }
  }

  const current =
    c.at(-1)!;

  const currentEma21 =
    ema21Series.at(-1) ??
    null;

  const currentEma50 =
    ema50Series.at(-1) ??
    null;

  /*
   * Recovery after EMA21 test.
   *
   * We allow a tiny amount below EMA21 because the stock
   * can still be in the final stage of reclaiming it.
   */
  const recovered21 =
    shakeout21Index >= 0 &&
    currentEma21 !== null &&
    current >=
      currentEma21 * 0.995;

  /*
   * Recovery after EMA50 test.
   *
   * For a deep shakeout, reclaiming EMA50 is enough to keep
   * the setup constructive.
   *
   * We intentionally do NOT require immediate EMA21 reclaim.
   */
  const recovered50 =
    shakeout50Index >= 0 &&
    currentEma50 !== null &&
    current >=
      currentEma50;

  return {
    shakeoutToEma21,
    shakeoutToEma50,
    recoveredFromShakeout:
      recovered21 ||
      recovered50,
  };
}

/**
 * Healthy trend:
 *
 * Normal path:
 *
 * Price > EMA10 > EMA21
 * EMA10 rising
 * EMA21 rising
 * Higher-low structure
 *
 * OR:
 *
 * A controlled shakeout toward EMA21 / EMA50 occurred
 * and price recovered while the larger structure remains intact.
 *
 * R² is used as a trend-quality measurement, not a mandatory
 * gate.
 */
export function detectHealthyTrend(
  ticks: PriceTick[],
): TrendHealth {
  const c =
    closes(ticks);

  const l =
    lows(ticks);

  if (c.length < 40) {
    return {
      healthy: false,
      strong: false,

      ema10: null,
      ema21: null,
      ema50: null,

      ema10Slope: 0,
      ema21Slope: 0,

      priceAbove10: false,
      priceAbove21: false,
      priceAbove50: false,

      emaStructure: false,

      higherLow: false,
      recentHigh: null,
      recentLow: null,

      distanceFromEma10Pct: 999,
      distanceFromEma21Pct: 999,
      distanceFromEma50Pct: 999,

      trendLinearity: 0,

      shakeoutToEma21: false,
      shakeoutToEma50: false,
      recoveredFromShakeout: false,

      evidence: [
        "Insufficient candle history for trend analysis",
      ],
    };
  }

  const current =
    c.at(-1)!;

  const e10 =
    ema(c, 10);

  const e21 =
    ema(c, 21);

  /*
   * EMA50 becomes available once we have enough history.
   */
  const e50 =
    c.length >= 50
      ? ema(c, 50)
      : null;

  const e21Series =
    alignedEmaSeries(
      c,
      21,
    );

  const e50Series =
    alignedEmaSeries(
      c,
      50,
    );

  /*
   * Compare current EMA against EMA approximately
   * five candles ago.
   */
  const prior10 =
    ema(
      c.slice(0, -5),
      10,
    );

  const prior21 =
    ema(
      c.slice(0, -5),
      21,
    );

  const priceAbove10 =
    e10 !== null &&
    current > e10;

  const priceAbove21 =
    e21 !== null &&
    current > e21;

  const priceAbove50 =
    e50 !== null &&
    current > e50;

  const emaStructure =
    e10 !== null &&
    e21 !== null &&
    e10 > e21;

  const ema10Slope =
    e10 !== null &&
    prior10 !== null
      ? pct(
          e10,
          prior10,
        )
      : 0;

  const ema21Slope =
    e21 !== null &&
    prior21 !== null
      ? pct(
          e21,
          prior21,
        )
      : 0;

  /*
   * ============================================================
   * HIGHER LOW
   * ============================================================
   */

  const recent =
    c.slice(-30);

  const firstHalf =
    recent.slice(0, 15);

  const secondHalf =
    recent.slice(15);

  const firstLow =
    firstHalf.length
      ? Math.min(
          ...firstHalf,
        )
      : null;

  const secondLow =
    secondHalf.length
      ? Math.min(
          ...secondHalf,
        )
      : null;

  const higherLow =
    firstLow !== null &&
    secondLow !== null &&
    secondLow >=
      firstLow * 0.985;

  /*
   * ============================================================
   * TREND LINEARITY
   * ============================================================
   *
   * Use the EMA21 trend rather than raw price.
   *
   * This prevents one temporary shakeout candle from
   * completely destroying the trend quality measurement.
   */
  const trendWindow =
    e21Series.length >= 30
      ? e21Series
          .slice(-30)
          .filter(
            (
              value,
            ): value is number =>
              value !== null,
          )
      : e21Series.filter(
          (
            value,
          ): value is number =>
            value !== null,
        );

  const trendLinearity =
    calculateTrendLinearity(
      trendWindow,
    );

  /*
   * ============================================================
   * SHAKEOUT / RECOVERY
   * ============================================================
   */

  const shakeout =
    detectShakeoutRecovery(
      c,
      l,
      e21Series,
      e50Series,
    );

  /*
   * ============================================================
   * TREND QUALITY
   * ============================================================
   *
   * We intentionally loosen the slope requirement slightly
   * compared with the old version.
   *
   * A controlled shakeout can temporarily flatten the EMA
   * while the larger structure remains healthy.
   */
  const slopeHealthy =
    ema10Slope > -0.35 &&
    ema21Slope > -0.25;

  const baseTrend =
    emaStructure &&
    slopeHealthy &&
    higherLow;

  /*
   * Normal healthy trend.
   */
  const normalHealthy =
    baseTrend &&
    priceAbove21;

  /*
   * Healthy after testing EMA21 and recovering.
   */
  const healthy21Recovery =
    baseTrend &&
    shakeout.shakeoutToEma21 &&
    shakeout.recoveredFromShakeout;

  /*
   * Healthy after deeper EMA50 shakeout.
   *
   * Price does NOT have to immediately reclaim EMA21.
   *
   * This is specifically designed for cases such as the
   * Kirloskar setup discussed earlier.
   */
  const healthy50Recovery =
    baseTrend &&
    shakeout.shakeoutToEma50 &&
    priceAbove50 &&
    shakeout.recoveredFromShakeout;

  const healthy =
    normalHealthy ||
    healthy21Recovery ||
    healthy50Recovery;

  /*
   * Strong is stricter than healthy.
   *
   * A recovered 50 EMA shakeout may be HEALTHY without
   * immediately being STRONG.
   */
  const strong =
    healthy &&
    priceAbove10 &&
    priceAbove21 &&
    ema10Slope > 0 &&
    ema21Slope > 0 &&
    (
      trendLinearity >= 0.45 ||
      shakeout.recoveredFromShakeout
    );

  const distanceFromEma10Pct =
    e10 !== null
      ? Math.abs(
          pct(
            current,
            e10,
          ),
        )
      : 999;

  const distanceFromEma21Pct =
    e21 !== null
      ? Math.abs(
          pct(
            current,
            e21,
          ),
        )
      : 999;

  const distanceFromEma50Pct =
    e50 !== null
      ? Math.abs(
          pct(
            current,
            e50,
          ),
        )
      : 999;

  /*
   * ============================================================
   * TREND EVIDENCE
   * ============================================================
   */

  const evidence: string[] = [];

  evidence.push(
    `Trend linearity R²: ${trendLinearity.toFixed(
      2,
    )}`,
  );

  if (
    trendLinearity >= 0.70
  ) {
    evidence.push(
      "Highly consistent trend",
    );
  } else if (
    trendLinearity >= 0.50
  ) {
    evidence.push(
      "Good trend consistency",
    );
  } else {
    evidence.push(
      "Trend is less linear; structure and recovery evaluated separately",
    );
  }

  if (
    shakeout.shakeoutToEma21
  ) {
    evidence.push(
      shakeout.recoveredFromShakeout
        ? "21 EMA shakeout detected and recovered"
        : "21 EMA shakeout detected",
    );
  }

  if (
    shakeout.shakeoutToEma50
  ) {
    evidence.push(
      shakeout.recoveredFromShakeout
        ? "50 EMA shakeout detected and recovered"
        : "50 EMA shakeout detected",
    );
  }

  if (
    shakeout.recoveredFromShakeout
  ) {
    evidence.push(
      "Recovery after EMA shakeout is constructive",
    );
  }

  if (higherLow) {
    evidence.push(
      "Higher-low structure preserved",
    );
  }

  if (emaStructure) {
    evidence.push(
      "10 EMA above 21 EMA",
    );
  }

  if (priceAbove50) {
    evidence.push(
      "Price above 50 EMA",
    );
  }

  return {
    healthy,
    strong,

    ema10: e10,
    ema21: e21,
    ema50: e50,

    ema10Slope,
    ema21Slope,

    priceAbove10,
    priceAbove21,
    priceAbove50,

    emaStructure,

    higherLow,
    recentHigh:
      recentHigh(c),
    recentLow:
      recentLow(c),

    distanceFromEma10Pct,
    distanceFromEma21Pct,
    distanceFromEma50Pct,

    trendLinearity,

    shakeoutToEma21:
      shakeout.shakeoutToEma21,

    shakeoutToEma50:
      shakeout.shakeoutToEma50,

    recoveredFromShakeout:
      shakeout.recoveredFromShakeout,

    evidence,
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
    if (
      c[i] <=
      c[i - 1] * 1.01
    ) {
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
    let i = Math.max(
      1,
      h.length - 5,
    );
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
    let i = Math.max(
      1,
      h.length - 20,
    );
    i <
    Math.max(
      1,
      h.length - 5,
    );
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
    current >=
      e21 * 0.985;

  /*
   * Higher-low preservation.
   */
  const priorSection =
    c.slice(-25, -10);

  const recentSection =
    c.slice(-10);

  const priorLow =
    priorSection.length
      ? Math.min(
          ...priorSection,
        )
      : current;

  const recentLow =
    recentSection.length
      ? Math.min(
          ...recentSection,
        )
      : current;

  const higherLow =
    recentLow >=
    priorLow * 0.985;

  /*
   * Prior pivot protection.
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
    `Pullback depth ${depthPct.toFixed(
      1,
    )}%`,
  );

  evidence.push(
    `Volume ${(
      volumeRatio * 100
    ).toFixed(
      0,
    )}% of prior`,
  );

  evidence.push(
    `Volatility ${(
      volatilityRatio * 100
    ).toFixed(
      0,
    )}% of prior`,
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
    volume /
    maxDownVolume;

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
    recentHigh(
      c,
      20,
    ) ??
    current;

  const low20 =
    recentLow(
      c,
      20,
    ) ??
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
      : current * 1.10;

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
    (
      current > high20 * 0.99 &&
      !pullback.present
    );

  /*
   * Breakdown takes priority unless we are in a valid
   * shakeout/recovery.
   *
   * This is important for deeper 50 EMA shakeouts.
   *
   * Example:
   *
   * Price < EMA21
   * Price > EMA50
   * 50 EMA shakeout recovered
   *
   * This should NOT automatically become BREAKDOWN.
   */
  const breakdown =
    !trend.priceAbove21 &&
    !pullback.holdsEma21 &&
    !trend.recoveredFromShakeout;

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

  /*
   * ============================================================
   * LINEARITY / SHAKEOUT SCORE
   * ============================================================
   *
   * R² is a quality bonus.
   *
   * It is deliberately NOT a gate.
   */
  if (
    trend.trendLinearity >= 0.70
  ) {
    score += 10;

    evidence.push(
      `Strong trend linearity R² ${trend.trendLinearity.toFixed(
        2,
      )}`,
    );
  } else if (
    trend.trendLinearity >= 0.50
  ) {
    score += 5;

    evidence.push(
      `Good trend linearity R² ${trend.trendLinearity.toFixed(
        2,
      )}`,
    );
  }

  /*
   * Controlled shakeouts are constructive evidence.
   */
  if (
    trend.shakeoutToEma21
  ) {
    score += 3;

    evidence.push(
      trend.recoveredFromShakeout
        ? "21 EMA shakeout recovered"
        : "21 EMA shakeout detected",
    );
  }

  if (
    trend.shakeoutToEma50
  ) {
    score += 5;

    evidence.push(
      trend.recoveredFromShakeout
        ? "50 EMA shakeout recovered"
        : "50 EMA shakeout detected",
    );
  }

  if (
    trend.recoveredFromShakeout
  ) {
    score += 8;

    evidence.push(
      "Constructive recovery after EMA shakeout",
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
    state =
      "ENTRY";
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
      trend.distanceFromEma21Pct <= 6 ||
      trend.recoveredFromShakeout
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

/* ============================================================
 * RE-ENTRY ENGINE
 * ========================================================== */

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
 *
 * IMPORTANT:
 *
 * R:R is NOT used as a re-entry filter.
 */
export type ReEntryClassification = {
  state:
    | "RE-ENTRY WATCH"
    | "ENTRY"
    | "BREAKDOWN"
    | "EXTENDED — DON'T CHASE";

  /** The actual original entry from the journal trade. */
  originalEntry: number;

  /** The price at which a new/re-entry would be considered. */
  reEntry: number;

  /** Current market/setup price. */
  current: number;

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

  /*
   * setup.entry is the CURRENT market price.
   *
   * It is NOT the original trade entry.
   */
  const current =
    setup.entry;

  /*
   * ============================================================
   * RE-ENTRY FOUNDATION
   * ============================================================
   *
   * Never average down.
   *
   * Re-entry only becomes possible after price has already moved
   * above the original entry and remains above the original stop.
   *
   * R:R is intentionally NOT used here.
   */

  if (
    current <= originalEntry ||
    current <= originalStop
  ) {
    return {
      state: "BREAKDOWN",

      originalEntry,
      reEntry: current,
      current,

      stop: originalStop,
      target: setup.target,

      riskPct:
        current > 0
          ? (
              (current - originalStop) /
              current
            ) * 100
          : 999,

      rewardPct:
        current > 0
          ? (
              (setup.target - current) /
              current
            ) * 100
          : 0,

      rr:
        current > originalStop
          ? (
              setup.target - current
            ) /
            (
              current -
              originalStop
            )
          : 0,

      pocketPivot:
        setup.pocketPivot,

      trend:
        setup.trend,

      pullback:
        setup.pullback,

      evidence: [
        ...setup.evidence,
        "Price has not moved above the original entry",
        "Re-entry is invalid until the original entry is reclaimed",
      ],
    };
  }

  /*
   * ============================================================
   * TREND BREAKDOWN
   * ============================================================
   */

  if (
    setup.state ===
    "BREAKDOWN"
  ) {
    return {
      state: "BREAKDOWN",

      originalEntry,
      reEntry: current,
      current,

      stop: originalStop,
      target: setup.target,

      riskPct:
        current > 0
          ? (
              (current - originalStop) /
              current
            ) * 100
          : 999,

      rewardPct:
        current > 0
          ? (
              (setup.target - current) /
              current
            ) * 100
          : 0,

      rr:
        current > originalStop
          ? (
              setup.target - current
            ) /
            (
              current -
              originalStop
            )
          : 0,

      pocketPivot:
        setup.pocketPivot,

      trend:
        setup.trend,

      pullback:
        setup.pullback,

      evidence: [
        ...setup.evidence,
        "Trend breakdown detected",
        "Re-entry disabled",
      ],
    };
  }

  /*
   * ============================================================
   * EXTENDED
   * ============================================================
   *
   * Do not chase a stock simply because its trend is healthy.
   *
   * Wait for a constructive reset.
   */
  if (
    setup.state ===
    "EXTENDED — DON'T CHASE"
  ) {
    return {
      state:
        "EXTENDED — DON'T CHASE",

      originalEntry,
      reEntry: current,
      current,

      stop: originalStop,
      target: setup.target,

      riskPct:
        current > 0
          ? (
              (current - originalStop) /
              current
            ) * 100
          : 999,

      rewardPct:
        current > 0
          ? (
              (setup.target - current) /
              current
            ) * 100
          : 0,

      rr:
        current > originalStop
          ? (
              setup.target - current
            ) /
            (
              current -
              originalStop
            )
          : 0,

      pocketPivot:
        setup.pocketPivot,

      trend:
        setup.trend,

      pullback:
        setup.pullback,

      evidence: [
        ...setup.evidence,
        "Price is extended from the moving-average structure",
        "Wait for a constructive reset instead of chasing",
      ],
    };
  }

  /*
   * ============================================================
   * CURRENT RE-ENTRY METRICS
   * ============================================================
   *
   * Informational only.
   *
   * These values do NOT determine eligibility.
   */
  const risk =
    current -
    originalStop;

  const reward =
    setup.target -
    current;

  const rr =
    risk > 0
      ? reward / risk
      : 0;

  /*
   * ============================================================
   * RE-ENTRY QUALITY
   * ============================================================
   */

  const aboveOriginalEntry =
    current >
    originalEntry;

  const healthyTrend =
    setup.trend.healthy;

  const healthyPullback =
    setup.pullback.healthy;

  const higherLow =
    setup.pullback.higherLow;

  const contraction =
    setup.pullback.contraction;

  const freshPocketPivot =
    setup.pocketPivot !== null;

  /*
   * ============================================================
   * SHAKEOUT / RECOVERY WATCH
   * ============================================================
   *
   * This is important for stocks like Kirloskar:
   *
   * Original position profitable
   *       ↓
   * Deep shakeout
   *       ↓
   * 50 EMA tested
   *       ↓
   * Recovery
   *       ↓
   * Tightening
   *       ↓
   * RE-ENTRY WATCH
   *
   * We do NOT wait for a breakout here.
   */
  const shakeoutRecoveryWatch =
    aboveOriginalEntry &&
    setup.trend.emaStructure &&
    setup.trend.recoveredFromShakeout &&
    (
      setup.trend.shakeoutToEma21 ||
      setup.trend.shakeoutToEma50
    ) &&
    (
      higherLow ||
      setup.pullback.holdsEma21 ||
      contraction
    );

  /*
   * ============================================================
   * FRESH CONFIRMATION
   * ============================================================
   *
   * Fresh Pocket Pivot is strongest confirmation.
   *
   * R:R is deliberately NOT checked.
   */
  const confirmed =
    aboveOriginalEntry &&
    healthyTrend &&
    healthyPullback &&
    higherLow &&
    freshPocketPivot;

  /*
   * ============================================================
   * STRONG WATCH
   * ============================================================
   *
   * Get the stock onto the radar BEFORE confirmation.
   *
   * R:R is deliberately NOT checked.
   */
  const strongWatch =
    aboveOriginalEntry &&
    setup.trend.strong &&
    healthyPullback &&
    contraction;

  /*
   * ============================================================
   * EARLY WATCH
   * ============================================================
   *
   * Detect constructive resets before breakout.
   */
  const earlyWatch =
    aboveOriginalEntry &&
    healthyTrend &&
    (
      healthyPullback ||
      setup.pullback.present ||
      setup.trend.distanceFromEma21Pct <= 6 ||
      setup.trend.shakeoutToEma21 ||
      setup.trend.shakeoutToEma50
    ) &&
    (
      higherLow ||
      setup.pullback.holdsEma21 ||
      contraction ||
      shakeoutRecoveryWatch
    );

  let state:
    | "RE-ENTRY WATCH"
    | "ENTRY"
    | "BREAKDOWN"
    | "EXTENDED — DON'T CHASE";

  if (confirmed) {
    state = "ENTRY";
  } else if (
    strongWatch ||
    earlyWatch ||
    shakeoutRecoveryWatch
  ) {
    state =
      "RE-ENTRY WATCH";
  } else {
    /*
     * Keep the candidate visible.
     *
     * We do not introduce an unnecessary "WAIT" state.
     *
     * The evidence explains what is still missing.
     */
    state =
      "RE-ENTRY WATCH";
  }

  /*
   * ============================================================
   * EVIDENCE
   * ============================================================
   */

  const evidence = [
    ...setup.evidence,
    "Original entry respected",
    "Original stop respected",
  ];

  if (
    trendHasShakeoutRecovery(
      setup.trend,
    )
  ) {
    evidence.push(
      "EMA shakeout/recovery detected",
    );
  }

  if (confirmed) {
    evidence.push(
      "Fresh Pocket Pivot confirms the re-entry setup",
    );
  } else if (
    strongWatch
  ) {
    evidence.push(
      "Healthy pullback with volume/volatility contraction",
    );

    evidence.push(
      "Watching before confirmation",
    );
  } else if (
    shakeoutRecoveryWatch
  ) {
    evidence.push(
      "Constructive EMA shakeout/recovery",
    );

    evidence.push(
      "Watching before expansion",
    );
  } else if (
    earlyWatch
  ) {
    evidence.push(
      "Constructive re-entry structure developing",
    );

    evidence.push(
      "Watching for the next confirmation",
    );
  } else {
    evidence.push(
      "Setup is not yet fully constructive",
    );
  }

  return {
    state,

    originalEntry,
    reEntry: current,
    current,

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

    /*
     * Informational only.
     *
     * R:R has NO influence on re-entry state.
     */
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

/**
 * Small helper used only for re-entry evidence.
 */
function trendHasShakeoutRecovery(
  trend: TrendHealth,
): boolean {
  return (
    trend.recoveredFromShakeout &&
    (
      trend.shakeoutToEma21 ||
      trend.shakeoutToEma50
    )
  );
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
      a.index -
      b.index,
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
      h.length -
        LOOKBACK,
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
    avg(
      v.slice(-30, -10),
    );

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
      ).toFixed(
        1,
      )}% deep`,
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
      h.length -
        LOOKBACK,
    );

  const hi =
    h.slice(start);

  const lo =
    l.slice(start);

  let topIndex = -1;
  let top = -Infinity;

  for (
    let i = 0;
    i <
    hi.length -
      CONFIRM_DAYS;
    i++
  ) {
    if (hi[i] <= top) {
      continue;
    }

    const holds =
      hi
        .slice(
          i + 1,
          i +
            1 +
            CONFIRM_DAYS,
        )
        .every(
          (v) =>
            v <= hi[i],
        );

    if (holds) {
      top =
        hi[i];

      topIndex =
        i;
    }
  }

  if (topIndex === -1) {
    return null;
  }

  const bottomSearchEnd =
    Math.min(
      lo.length -
        CONFIRM_DAYS,
      topIndex +
        1 +
        MAX_BOX_DAYS,
    );

  let bottomIndex = -1;
  let bottom = Infinity;

  for (
    let i =
      topIndex + 1;
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
          i +
            1 +
            CONFIRM_DAYS,
        )
        .every(
          (v) =>
            v >= lo[i],
        );

    if (holds) {
      bottom =
        lo[i];

      bottomIndex =
        i;
    }
  }

  if (bottomIndex === -1) {
    return null;
  }

  const heightPct =
    (top - bottom) /
    top;

  if (
    heightPct > 0.2
  ) {
    return null;
  }

  return {
    top,
    bottom,

    topDate:
      ticks[
        start +
          topIndex
      ][0],

    bottomDate:
      ticks[
        start +
          bottomIndex
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
    PatternCandidate[] =
    [];

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

  const h =
    highs(ticks);

  const l =
    lows(ticks);

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
      avg(
        v.slice(-30, -10),
      );

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
      last <=
        box.top;

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
          volumeRatio >=
            1.5
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

          volumeRatio >=
          1.5
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

        series:
          recent,
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
    TCS:
      "IT Services",
    INFY:
      "IT Services",
    HDFCBANK:
      "Private Banks",
    ICICIBANK:
      "Private Banks",
    SBIN:
      "Public Banks",
    LT:
      "Capital Goods",
    SUNPHARMA:
      "Pharma",
    BHARTIARTL:
      "Telecom",
  };

export function themeForSymbol(
  symbol: string,
) {
  return (
    THEME_MAP[
      symbol
        .replace(
          /^EQ:/,
          "",
        )
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
      closes(
        item.ticks,
      );

    const theme =
      themeForSymbol(
        item.symbol,
      );

    const entry =
      c.length >= 21
        ? (
            c.at(-1)! /
              c.at(-21)! -
            1
          ) * 100
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
    .flatMap(
      (items) =>
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

  return [
    ...grouped,
  ]
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
