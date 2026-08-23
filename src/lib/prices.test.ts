import { describe, expect, it, vi } from "vitest";
import {
  buildStrikePriceUrl,
  extractLatestPrices,
  fetchStrikeLatestPrices,
  latestCloseFromTicks,
  normalizeSymbol,
  toIstIso,
  uniqueSymbols,
} from "./prices";

describe("price helpers", () => {
  it("normalizes equity symbols", () => {
    expect(normalizeSymbol(" eq:stallion ")).toBe("STALLION");
    expect(uniqueSymbols(["APOLLO", "apollo", "EQ:GABRIEL", ""])).toEqual([
      "APOLLO",
      "GABRIEL",
    ]);
  });

  it("reads the latest candle close", () => {
    expect(
      latestCloseFromTicks([
        ["2026-08-06T11:52:00+05:30", 1, 1, 1, 273.89, 1, 1],
        ["2026-08-06T11:53:00+05:30", 1, 1, 1, 273.7, 1, 1],
      ]),
    ).toBe(273.7);
    expect(latestCloseFromTicks([])).toBeNull();
  });

  it("extracts prices from a Strike payload", () => {
    const prices = extractLatestPrices(
      {
        data: {
          ticks: {
            STALLION: [["2026-08-06T11:53:00+05:30", 273.89, 273.89, 273.7, 273.7, 2412, 1363626]],
          },
        },
      },
      ["STALLION", "MISSING"],
    );

    expect(prices).toEqual({ STALLION: 273.7 });
  });

  it("builds an IST query URL", () => {
    const url = buildStrikePriceUrl(
      ["STALLION"],
      new Date("2026-08-06T06:23:16.000Z"),
      15,
    );

    expect(url).toContain("candleInterval=1m");
    expect(url).toContain("securities=EQ%3ASTALLION");
    expect(url).toContain(encodeURIComponent(toIstIso(new Date("2026-08-07T06:23:16.000Z"))));
    expect(buildStrikePriceUrl(["STALLION"], new Date("2026-08-06T06:23:16.000Z"), 15, "1d")).toContain("candleInterval=1d");
    expect("2026-08-21T15:30:00+05:30".slice(0, 10)).toBe("2026-08-21");
  });

  it("pipe-separates batched securities", () => {
    const url = buildStrikePriceUrl(["APOLLO", "STALLION"]);

    expect(decodeURIComponent(url)).toContain("securities=EQ:APOLLO|EQ:STALLION");
  });
});

describe("fetchStrikeLatestPrices", () => {
  const jsonResponse = (ticks: Record<string, unknown[]>) =>
    ({
      ok: true,
      json: async () => ({ data: { ticks } }),
    }) as unknown as Response;

  it("widens the lookback window until a price resolves", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(
        jsonResponse({
          APOLLO: [["2026-08-06T11:53:00+05:30", 404, 404, 404, 404.5, 10, 100]],
        }),
      );

    const prices = await fetchStrikeLatestPrices(["APOLLO"], fetchImpl as unknown as typeof fetch);

    expect(prices).toEqual({ APOLLO: 404.5 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("keeps prices from symbols that resolve when others fail", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        STALLION: [["2026-08-06T11:53:00+05:30", 273, 274, 273, 273.7, 10, 100]],
      }),
    );

    const prices = await fetchStrikeLatestPrices(
      ["STALLION", "UNKNOWNSYM"],
      fetchImpl as unknown as typeof fetch,
    );

    expect(prices).toEqual({ STALLION: 273.7 });
  });
});
