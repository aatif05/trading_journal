import { describe, expect, it } from "vitest";
import {
  calculatePortfolio,
  calculateTrade,
  createTrade,
  parseStoredTrades,
  serializeTrades,
  tradesFromCsv,
  tradesToCsv,
  type Trade,
} from "./trades";

const sampleTrade = (overrides: Partial<Trade> = {}): Trade => ({
  ...createTrade([]),
  ...overrides,
});

describe("trade calculations", () => {
  it("calculates open-position P/L, risk, and holding days", () => {
    const trade = sampleTrade({
      entry: 100,
      avgEntry: 100,
      initialQty: 10,
      sl: 95,
      cmp: 110,
      date: "2026-08-01",
    });

    const metric = calculateTrade(trade, new Date("2026-08-06T12:00:00Z"));

    expect(metric.unrealized).toBe(100);
    expect(metric.capitalAtRisk).toBe(50);
    expect(metric.stockMove).toBe(10);
    expect(metric.rewardRisk).toBe(2);
    expect(metric.holdingDays).toBe(5);
  });

  it("derives open, partial, and closed status from quantities", () => {
    const open = sampleTrade({ initialQty: 10, e1Qty: 0, positionStatus: "Closed" });
    const partial = sampleTrade({ initialQty: 10, e1Qty: 4, e1Price: 110, positionStatus: "Open" });
    const closed = sampleTrade({ initialQty: 10, e1Qty: 10, e1Price: 110, positionStatus: "Open" });

    expect(calculateTrade(open).positionStatus).toBe("Open");
    expect(calculateTrade(partial).positionStatus).toBe("Partial");
    expect(calculateTrade(closed).positionStatus).toBe("Closed");
  });

  it("calculates open heat across scale-in legs and remaining quantity", () => {
    const trade = sampleTrade({
      entry: 100,
      initialQty: 10,
      sl: 95,
      p1Price: 120,
      p1Qty: 5,
      p1Sl: 110,
      e1Qty: 5,
      e1Price: 125,
    });

    expect(calculateTrade(trade).capitalAtRisk).toBeCloseTo(200 / 3);
  });

  it("uses only closed positions to calculate win rate", () => {
    const winner = sampleTrade({
      id: "winner",
      positionStatus: "Closed",
      avgEntry: 100,
      initialQty: 10,
      avgExitPrice: 110,
    });
    const loser = sampleTrade({
      id: "loser",
      positionStatus: "Closed",
      avgEntry: 100,
      initialQty: 10,
      avgExitPrice: 90,
    });
    const open = sampleTrade({ id: "open", positionStatus: "Open" });

    expect(calculatePortfolio([winner, loser, open]).winRate).toBe(50);
  });
});

describe("local persistence", () => {
  it("round-trips saved trades and rejects invalid payloads", () => {
    const trades = [sampleTrade({ name: "ACME", tradeNo: 1 })];
    const serialized = serializeTrades(trades);

    expect(parseStoredTrades(serialized)).toEqual(trades);
    expect(parseStoredTrades('{"version":1,"trades":[]}')).toEqual([]);
    expect(parseStoredTrades('{"version":3,"trades":[]}')).toEqual([]);
    expect(parseStoredTrades('{"version":4,"trades":[]}')).toBeNull();
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

    expect(migrated?.[0].e3Qty).toBe(0);
    expect(migrated?.[0].tslGroups).toBe("");
    expect(migrated?.[0].quickNote).toBe("");
    expect(migrated?.[0].brokerage).toBe(0);
  });

  it("migrates legacy exit fields from p* to e*", () => {
    const legacy = JSON.stringify({
      version: 2,
      trades: [
        {
          id: "legacy-exit",
          tradeNo: 2,
          date: "2026-07-01",
          name: "EXIT",
          entry: 10,
          avgEntry: 10,
          initialQty: 100,
          cmp: 12,
          p1Price: 11,
          p1Qty: 40,
          p1Date: "2026-07-02",
          p2Price: 12,
          p2Qty: 30,
          p3Price: 13,
          p3Qty: 20,
        },
      ],
    });
    const migrated = parseStoredTrades(legacy);

    expect(migrated?.[0].e1Price).toBe(11);
    expect(migrated?.[0].e1Qty).toBe(40);
    expect(migrated?.[0].e2Qty).toBe(30);
    expect(migrated?.[0].e3Qty).toBe(20);
    expect(migrated?.[0].p1Qty).toBe(0);
    expect(migrated?.[0].p2Qty).toBe(0);
  });
});

describe("CSV portability", () => {
  it("round-trips commas and quotes in text fields", () => {
    const source = [sampleTrade({ name: 'ACME, "INDIA"', entry: 42.5 })];
    const imported = tradesFromCsv(tradesToCsv(source));

    expect(imported).toHaveLength(1);
    expect(imported[0].name).toBe('ACME, "INDIA"');
    expect(imported[0].entry).toBe(source[0].entry);
  });
});
