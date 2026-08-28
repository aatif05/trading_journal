import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { symbol?: string; inputs?: Record<string, unknown>; mode?: "analysis" | "ideas" };
    const symbol = body.symbol?.trim().toUpperCase();
    if (!symbol) return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
    const result = await generateText({
      model: google("gemini-3.6-flash"),
      instructions: "You are a cautious market research assistant. Never give financial advice or certainty. Use only supplied inputs, state missing data, cite the inputs used, and return concise JSON-like markdown sections: thesis, signals, risks, invalidation, confidence, inputs used.",
      prompt: `Research ${symbol}. Mode: ${body.mode ?? "analysis"}. Supplied market inputs: ${JSON.stringify(body.inputs ?? {})}`,
    });
    return NextResponse.json({ symbol, text: result.text, inputs: body.inputs ?? {} });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Research unavailable" }, { status: 502 });
  }
}
