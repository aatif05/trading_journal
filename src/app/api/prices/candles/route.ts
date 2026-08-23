import { NextRequest, NextResponse } from "next/server";
import { fetchStrikeTicks, normalizeSymbol } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = normalizeSymbol(request.nextUrl.searchParams.get("symbol") ?? "");
  if (!symbol) return NextResponse.json({ error: "Provide a symbol." }, { status: 400 });
  const range = request.nextUrl.searchParams.get("range") ?? "6M";
  const interval = request.nextUrl.searchParams.get("interval") ?? "1d";
  const lookback = range === "1M" ? 60 * 24 * 31 : range === "3M" ? 60 * 24 * 92 : range === "1Y" ? 60 * 24 * 365 : 60 * 24 * 183;
  const candleInterval = interval === "1m" ? "1m" : interval === "5m" ? "5m" : interval === "15m" ? "15m" : interval === "1h" ? "1h" : "1d";
  try {
    const ticks = await fetchStrikeTicks(symbol, lookback, candleInterval);
    return NextResponse.json({ symbol, ticks, range, interval, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch candles" }, { status: 502 });
  }
}
