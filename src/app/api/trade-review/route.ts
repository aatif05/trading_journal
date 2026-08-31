import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

const reviewSchema = z.object({
  wentWell: z.array(z.string()).max(3),
  morePotentialProfit: z.array(z.string()).max(3),
  improve: z.array(z.string()).max(3),
  disclaimer: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.trade?.name || !body?.metric) return Response.json({ error: "A closed trade and metrics are required." }, { status: 400 });
    const result = await generateObject({
    model: google("gemini-3.6-flash"),
    schema: reviewSchema,
    system: "You are a concise trading journal coach. Analyze only the supplied historical trade facts. Never claim certainty, invent chart data, or give a future price prediction. Return practical observations in plain language.",
    prompt: `Review this closed trade:\n${JSON.stringify(body)}\n\nUse exactly three sections: wentWell, morePotentialProfit, improve. Mention missing evidence when relevant. Keep each item under 24 words.`,
  });
    return Response.json(result.object);
  } catch (error) {
    console.error("[v0] trade review generation failed", error);
    return Response.json({ error: "Trade review generation is unavailable." }, { status: 503 });
  }
}
