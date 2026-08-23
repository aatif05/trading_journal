import { NextRequest, NextResponse } from "next/server";
import { fetchStrikeTicks, normalizeSymbol } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbol = normalizeSymbol(request.nextUrl.searchParams.get("symbol") ?? "");
  if (!symbol) return NextResponse.json({ error: "Provide a symbol." }, { status: 400 });
  try {
    const ticks = await fetchStrikeTicks(symbol);
    return NextResponse.json({ symbol, ticks, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to fetch candles" }, { status: 502 });
  }
}
