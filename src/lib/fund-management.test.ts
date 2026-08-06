import { describe, expect, it } from "vitest";
import {
  calculateFundYear,
  parseCapitalFlows,
  serializeCapitalFlows,
  updateCapitalFlow,
} from "./fund-management";
import { demoTrades, type Trade } from "./trades";

describe("fund management calculations", () => {
  it("chains monthly capital flows and closed-trade P/L", () => {
    const winner: Trade = {
      ...demoTrades[0],
      id: "feb-winner",
      date: "2026-01-20",
      positionStatus: "Closed",
      avgEntry: 100,
      initialQty: 10,
      e1Price: 110,
      e1Qty: 10,
      e1Date: "2026-02-03",
    };
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

  it("ignores open trades in monthly attribution", () => {
    const rows = calculateFundYear(demoTrades, {}, 2026, 350_000);

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
