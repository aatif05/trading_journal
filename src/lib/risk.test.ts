import { describe, expect, it } from "vitest";
import { findMissingStopLossTrades, momentumSignal, safePercent } from "./risk";
import type { TradeMetric } from "./trades";

const metric = (overrides: Partial<TradeMetric> = {}) => ({ positionStatus: "Open", sl: 0, tradeNo: 1, name: "TEST", ...overrides }) as TradeMetric;

describe("risk and research signals", () => {
  it("finds active trades without a valid stop loss", () => {
    expect(findMissingStopLossTrades([metric(), metric({ sl: 90 }), metric({ positionStatus: "Closed" })])).toHaveLength(1);
  });
  it("classifies momentum conservatively", () => {
    expect(momentumSignal(2.1).label).toBe("Strong positive");
    expect(momentumSignal(-2.1).label).toBe("Strong negative");
    expect(momentumSignal(null).label).toBe("No data");
  });
  it("does not invent percentages with missing or zero baselines", () => {
    expect(safePercent(10, 0)).toBeNull();
    expect(safePercent(null, 100)).toBeNull();
    expect(safePercent(10, 100)).toBe(10);
  });
});
