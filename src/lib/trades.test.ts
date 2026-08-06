import { describe, expect, it } from "vitest";
import {
  calculatePortfolio,
  calculateTrade,
  demoTrades,
  parseStoredTrades,
  serializeTrades,
  tradesFromCsv,
  tradesToCsv,
  type Trade,
} from "./trades";

describe("trade calculations", () => {
  it("calculates open-position P/L, risk, and holding days", () => {
    const trade: Trade = {
      ...demoTrades[0],
      entry: 100,
      avgEntry: 100,
      initialQty: 10,
      sl: 95,
      cmp: 110,
      date: "2026-08-01",
    };

    const metric = calculateTrade(trade, new Date("2026-08-06T12:00:00Z"));

    expect(metric.unrealized).toBe(100);
    expect(metric.capitalAtRisk).toBe(50);
    expect(metric.stockMove).toBe(10);
    expect(metric.rewardRisk).toBe(2);
    expect(metric.holdingDays).toBe(5);
  });

  it("uses only closed positions to calculate win rate", () => {
    const winner: Trade = {
      ...demoTrades[0],
      id: "winner",
      positionStatus: "Closed",
      avgEntry: 100,
      initialQty: 10,
      avgExitPrice: 110,
    };
    const loser: Trade = {
      ...winner,
      id: "loser",
      avgExitPrice: 90,
    };

    expect(calculatePortfolio([winner, loser, demoTrades[1]]).winRate).toBe(50);
  });
});

describe("local persistence", () => {
  it("round-trips saved trades and rejects invalid payloads", () => {
    const serialized = serializeTrades(demoTrades);

    expect(parseStoredTrades(serialized)).toEqual(demoTrades);
    expect(parseStoredTrades('{"version":1,"trades":[]}')).toEqual([]);
    expect(parseStoredTrades('{"version":3,"trades":[]}')).toBeNull();
    expect(parseStoredTrades("not-json")).toBeNull();
  });

  it("fills missing v2 fields when migrating legacy trades", () => {
    const legacy = JSON.stringify({
      version: 1,
      trades: [
        {
          id: "legacy",
          tradeNo: 1,
          date: "2026-07-01",
          name: "LEGACY",
          entry: 10,
          avgEntry: 10,
          initialQty: 5,
          cmp: 12,
        },
      ],
    });
    const migrated = parseStoredTrades(legacy);

    expect(migrated?.[0].p3Qty).toBe(0);
    expect(migrated?.[0].tslGroups).toBe("");
    expect(migrated?.[0].quickNote).toBe("");
  });
});

describe("CSV portability", () => {
  it("round-trips commas and quotes in text fields", () => {
    const source = [{ ...demoTrades[0], name: 'ACME, "INDIA"' }];
    const imported = tradesFromCsv(tradesToCsv(source));

    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe('ACME, "INDIA"');
    expect(imported[0].entry).toBe(source[0].entry);
  });
});
