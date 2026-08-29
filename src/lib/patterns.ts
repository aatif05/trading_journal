import type { PriceTick } from "./prices";

export type PatternCandidate = { symbol: string; pattern: "VCP" | "Darvas Box"; confidence: "Low" | "Medium" | "High"; evidence: string[]; breakoutLevel: number | null };

const closes = (ticks: PriceTick[]) => ticks.map((tick) => Number(tick[4])).filter(Number.isFinite);
const volumes = (ticks: PriceTick[]) => ticks.map((tick) => Number(tick[5])).filter(Number.isFinite);

export function detectPatterns(symbol: string, ticks: PriceTick[]): PatternCandidate[] {
  const c = closes(ticks); const v = volumes(ticks); if (c.length < 30) return [];
  const recent = c.slice(-20); const earlier = c.slice(-40, -20);
  const range = (values: number[]) => Math.max(...values) - Math.min(...values);
  const recentRange = range(recent); const earlierRange = range(earlier.length ? earlier : recent);
  const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const volumeContracting = avg(v.slice(-10)) < avg(v.slice(-20, -10)) * 0.9;
  const high = Math.max(...recent); const low = Math.min(...recent); const last = c.at(-1) ?? 0;
  const nearBreakout = last >= high * 0.97;
  const result: PatternCandidate[] = [];
  if (recentRange < earlierRange * 0.75 && volumeContracting) result.push({ symbol, pattern: "VCP", confidence: nearBreakout ? "High" : "Medium", evidence: ["20-session range contracted", "Recent volume is declining", nearBreakout ? "Price is near the range high" : "Price remains inside the contraction"], breakoutLevel: high });
  if (recentRange / Math.max(low, 1) < 0.12 && nearBreakout) result.push({ symbol, pattern: "Darvas Box", confidence: "Medium", evidence: ["Recent range is relatively tight", "Price is near the box ceiling", "Needs a confirmed breakout and volume follow-through"], breakoutLevel: high });
  return result;
}

export type ThemeSummary = { theme: string; symbols: string[]; return20d: number | null; breadth: number; momentum: "Leading" | "Mixed" | "Lagging" };
const THEME_MAP: Record<string, string> = { RELIANCE: "Energy & Conglomerates", TCS: "IT Services", INFY: "IT Services", HDFCBANK: "Private Banks", ICICIBANK: "Private Banks", SBIN: "Public Banks", LT: "Capital Goods", SUNPHARMA: "Pharma", BHARTIARTL: "Telecom" };
export function themeForSymbol(symbol: string) { return THEME_MAP[symbol.replace(/^EQ:/, "").toUpperCase()] ?? "Unclassified"; }
export function summarizeThemes(series: Array<{ symbol: string; ticks: PriceTick[] }>): ThemeSummary[] {
  const grouped = new Map<string, Array<{ symbol: string; return20d: number | null }>>();
  for (const item of series) { const c = closes(item.ticks); const theme = themeForSymbol(item.symbol); const entry = c.length >= 21 ? (c.at(-1)! / c.at(-21)! - 1) * 100 : null; const list = grouped.get(theme) ?? []; list.push({ symbol: item.symbol, return20d: entry }); grouped.set(theme, list); }
  const valid = [...grouped.values()].flatMap((items) => items.map((item) => item.return20d).filter((value): value is number => value !== null)); const median = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  return [...grouped].map(([theme, items]) => { const values = items.map((item) => item.return20d).filter((value): value is number => value !== null); const return20d = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; const breadth = values.length ? values.filter((value) => value > 0).length / values.length * 100 : 0; const momentum: ThemeSummary["momentum"] = return20d === null ? "Mixed" : return20d > median + 1 ? "Leading" : return20d < median - 1 ? "Lagging" : "Mixed"; return { theme, symbols: items.map((item) => item.symbol), return20d, breadth, momentum }; }).sort((a, b) => (b.return20d ?? -Infinity) - (a.return20d ?? -Infinity));
}
