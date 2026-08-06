import { NextRequest, NextResponse } from "next/server";
import { fetchStrikeLatestPrices, uniqueSymbols } from "@/lib/prices";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const symbols = uniqueSymbols(
    (request.nextUrl.searchParams.get("symbols") ?? "")
      .split(",")
      .map((value) => value.trim()),
  );

  if (!symbols.length) {
    return NextResponse.json({ error: "Provide at least one symbol." }, { status: 400 });
  }

  if (symbols.length > 25) {
    return NextResponse.json({ error: "Maximum 25 symbols per request." }, { status: 400 });
  }

  try {
    const prices = await fetchStrikeLatestPrices(symbols);
    return NextResponse.json({
      prices,
      fetchedAt: new Date().toISOString(),
      requested: symbols,
      found: Object.keys(prices),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch prices";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
