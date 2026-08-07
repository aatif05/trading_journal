import { describe, expect, it } from "vitest";
import {
  calculateCurrentCapital,
  calculateFundYear,
  parseCapitalFlows,
  serializeCapitalFlows,
  updateCapitalFlow,
} from "./fund-management";
import { calculatePortfolio, createTrade, type Trade } from "./trades";

const sampleTrade = (overrides: Partial<Trade> = {}): Trade => ({
  ...createTrade([]),
  ...overrides,
});

describe("fund management calculations", () => {
  it("chains monthly capital flows and closed-trade P/L", () => {
    const winner = sampleTrade({
      id: "feb-winner",
      date: "2026-01-20",
      positionStatus: "Closed",
      avgEntry: 100,
      initialQty: 10,
      e1Price: 110,
      e1Qty: 10,
      e1Date: "2026-02-03",
    });
    const flows = {
      "2026-01": { added: 500, withdrawn: 0 },
      "2026-02": { added: 100, withdrawn: 50 },
    };

    const rows = calculateFundYear([winner], flows, 2026, 1_000);

    expect(rows[0].startingCapital).toBe(1_500);
    expect(rows[0].finalCapital).toBe(1_500);
    expect(rows[1].startingCapital).toBe(1_550);
    expect(rows[1].netPL).toBe(100);
    expect(rows[1].finalCapital).toBe(1_650);
    expect(rows[1].trades).toBe(1);
    expect(rows[1].winRate).toBe(100);
    expect(rows[1].avgGain).toBe(10);
    expect(rows[2].startingCapital).toBe(1_650);
  });

  it("carries the previous year's closing capital into January", () => {
    const flows = {
      "2025-11": { added: 1_000, withdrawn: 0 },
      "2026-03": { added: 200, withdrawn: 50 },
    };

    const rows = calculateFundYear([], flows, 2026);

    expect(rows[0].startingCapital).toBe(1_000);
    expect(rows[2].startingCapital).toBe(1_150);
    expect(rows[11].finalCapital).toBe(1_150);
  });

  it("derives current capital from flows and booked P/L", () => {
    const winner = sampleTrade({
      id: "closed-winner",
      date: "2026-06-10",
      positionStatus: "Closed",
      avgEntry: 100,
      initialQty: 10,
      e1Price: 110,
      e1Qty: 10,
      e1Date: "2026-06-20",
    });
    const flows = {
      "2026-06": { added: 5_000, withdrawn: 0 },
      "2026-07": { added: 1_000, withdrawn: 500 },
      // A future deposit must not inflate today's capital.
      "2026-12": { added: 9_000, withdrawn: 0 },
    };

    const capital = calculateCurrentCapital([winner], flows, new Date("2026-07-15T00:00:00Z"));

    expect(capital).toBe(5_600);
    expect(calculatePortfolio([winner], capital).grossImpact).toBeCloseTo(1.7857, 4);
  });

  it("reports zero percentages when no capital is recorded", () => {
    const open = sampleTrade({ positionStatus: "Open", initialQty: 5, avgEntry: 100 });
    const metrics = calculatePortfolio([open], calculateCurrentCapital([open], {}));

    expect(metrics.capital).toBe(0);
    expect(metrics.investedPercent).toBe(0);
    expect(metrics.grossImpact).toBe(0);
    expect(metrics.currentDrawdown).toBe(0);
  });

  it("ignores open trades in monthly attribution", () => {
    const open = sampleTrade({
      date: "2026-06-01",
      positionStatus: "Open",
      initialQty: 10,
      avgEntry: 100,
    });
    const rows = calculateFundYear([open], {}, 2026, 350_000);

    expect(rows.every((row) => !row.hasTrades)).toBe(true);
    expect(rows[11].finalCapital).toBe(350_000);
  });
});

describe("capital flow persistence", () => {
  it("updates, round-trips, and sanitizes flow values", () => {
    const flows = updateCapitalFlow({}, 2026, 6, "added", 77_000);
    const parsed = parseCapitalFlows(serializeCapitalFlows(flows));

    expect(parsed["2026-07"]).toEqual({ added: 77_000, withdrawn: 0 });
    expect(updateCapitalFlow(parsed, 2026, 6, "withdrawn", -100)["2026-07"].withdrawn).toBe(0);
    expect(parseCapitalFlows("not-json")).toEqual({});
  });
});
