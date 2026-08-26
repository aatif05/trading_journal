import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

const USERNAME = "aatif";

export async function GET() {
  const [trades, flows] = await Promise.all([
    db.execute(sql`SELECT id, payload FROM journal_trades WHERE username = ${USERNAME} ORDER BY updated_at DESC`),
    db.execute(sql`SELECT payload FROM journal_capital_flows WHERE username = ${USERNAME} LIMIT 1`),
  ]);
  return NextResponse.json({ trades: trades.rows.map((row) => row.payload), flows: flows.rows[0]?.payload ?? {} });
}

export async function PUT(request: Request) {
  const body = await request.json() as { trades?: unknown; flows?: unknown; mode?: "upsert" | "replace" };
  if (body.trades !== undefined) {
    const trades = Array.isArray(body.trades) ? body.trades : [];
    await db.transaction(async (tx) => {
      for (const trade of trades) {
        if (!trade || typeof trade !== "object" || typeof (trade as { id?: unknown }).id !== "string") continue;
        const id = (trade as { id: string }).id;
        await tx.execute(sql`INSERT INTO journal_trades (id, username, payload, updated_at) VALUES (${id}, ${USERNAME}, ${JSON.stringify(trade)}::jsonb, now()) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`);
      }
    });
  }
  if (body.flows !== undefined) {
    await db.execute(sql`INSERT INTO journal_capital_flows (username, payload, updated_at) VALUES (${USERNAME}, ${JSON.stringify(body.flows)}::jsonb, now()) ON CONFLICT (username) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`);
  }
  return NextResponse.json({ ok: true });
}
