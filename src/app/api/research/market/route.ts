import { NextResponse } from "next/server";
import { fetchStrikeTicks } from "@/lib/prices";
import { detectPatterns, INDIAN_MARKET_UNIVERSE, summarizeThemes } from "@/lib/patterns";

export async function GET(request: Request) {
  const symbols = new URL(request.url).searchParams.get("symbols")?.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 25) ?? [];
  const marketSymbols = [...new Set([...symbols, ...INDIAN_MARKET_UNIVERSE])].slice(0, 50);
  if (!marketSymbols.length) return NextResponse.json({ series: [], patterns: [], themes: [] });
  const series = (await Promise.all(marketSymbols.map(async (symbol) => ({ symbol, ticks: await fetchStrikeTicks(symbol, 60 * 24 * 45, "1d") })))).filter((item) => item.ticks.length);
  return NextResponse.json({ series, patterns: series.flatMap((item) => detectPatterns(item.symbol, item.ticks)), themes: summarizeThemes(series), fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
