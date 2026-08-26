"use client";

import { CloudOff, Info, LockKeyhole, Pencil, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { BottomNav } from "@/components/layout/bottom-nav";
import { useCapitalFlows } from "@/hooks/use-capital-flows";
import { useTrades } from "@/hooks/use-trades";
import { calculateFundYear, type FundMonth } from "@/lib/fund-management";
import { formatCurrency, formatPercent } from "@/lib/trades";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const columnHelp = {
  added: "Capital deposited during this month.",
  withdrawn: "Capital withdrawn during this month.",
  starting: "Previous month's final capital, plus added capital, less withdrawals.",
  netPL: "Net P/L from trades closed during this month, after brokerage.",
  percentPL: "Monthly net P/L as a percentage of starting capital.",
  final: "Starting capital plus this month's net P/L.",
  trades: "Number of trades closed during this month.",
  win: "Percentage of this month's closed trades that were profitable.",
  gain: "Average percentage return among profitable closed trades.",
  loss: "Average percentage loss among losing closed trades.",
};

function HeaderCell({
  children,
  help,
  editable = false,
  align = "right",
}: {
  children: React.ReactNode;
  help?: string;
  editable?: boolean;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`h-14 whitespace-nowrap border-b border-[#e9ecea] px-3 text-[9px] font-bold uppercase tracking-[0.15em] text-[#737c76] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {children}
        {editable && <Pencil className="h-2.5 w-2.5 text-[#8b938e]" aria-hidden="true" />}
        {help && (
          <span title={help} aria-label={help}>
            <Info className="h-2.5 w-2.5 text-[#a6ada8]" aria-hidden="true" />
          </span>
        )}
      </span>
    </th>
  );
}

function CapitalInput({
  value,
  label,
  onChange,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="relative min-w-[112px]">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#929a95]">
        ₹
      </span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value || ""}
        placeholder="0"
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-9 w-full rounded-lg border border-transparent bg-[#f6f7f6] py-1 pl-6 pr-2 text-right text-[11px] font-semibold tabular-nums text-[#38413b] outline-none transition hover:bg-[#f0f2f1] focus:border-[#9ed5bc] focus:bg-white focus:ring-2 focus:ring-[#e7f5ee]"
      />
    </div>
  );
}

const valueTone = (value: number) =>
  value > 0 ? "text-[#15955f]" : value < 0 ? "text-[#e14f69]" : "text-[#727b75]";

function EmptyMetric() {
  return <span className="text-[#b1b7b3]">—</span>;
}

function MetricCell({
  row,
  value,
  kind,
}: {
  row: FundMonth;
  value: number;
  kind: "money" | "percent" | "count" | "gain" | "loss";
}) {
  if (!row.hasTrades) return <EmptyMetric />;

  let tone = "text-[#303934]";
  if (kind === "money" || kind === "percent") tone = valueTone(value);
  if (kind === "gain" || (kind === "percent" && value > 0)) tone = "text-[#15955f]";
  if (kind === "loss" || (kind === "percent" && value < 0)) tone = "text-[#e14f69]";
  if (kind === "count") tone = "text-[#303934]";

  const formatted =
    kind === "money"
      ? formatCurrency(value)
      : kind === "count"
        ? String(value)
        : formatPercent(value);

  return <span className={`font-semibold tabular-nums ${tone}`}>{formatted}</span>;
}

export default function FundManagementPage() {
  const { trades, hydrated: tradesHydrated } = useTrades();
  const { flows, hydrated: flowsHydrated, updateFlow } = useCapitalFlows();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const years = useMemo(() => {
    const tradeYears = trades
      .flatMap((trade) => [trade.date, trade.e1Date, trade.e2Date, trade.e3Date])
      .map((date) => Number(date.slice(0, 4)))
      .filter(Number.isFinite);
    return [...new Set([currentYear - 1, currentYear, currentYear + 1, ...tradeYears])].sort(
      (a, b) => b - a,
    );
  }, [currentYear, trades]);

  const rows = useMemo(() => calculateFundYear(trades, flows, year), [flows, trades, year]);
  const hydrated = tradesHydrated && flowsHydrated;

  return (
    <main className="min-h-screen bg-[#f7f8fa] pb-20">
      <header className="border-b border-[#e7ebe8] bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#18251e] text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-bold tracking-tight">Ledgerly</p>
              <p className="text-[9px] uppercase tracking-[0.14em] text-[#929a95]">
                Trading journal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-[#e5e9e6] bg-[#fafbfa] px-3 py-1.5 text-[10px] font-medium text-[#69716c]">
            {hydrated ? (
              <LockKeyhole className="h-3 w-3 text-[#1b9762]" />
            ) : (
              <CloudOff className="h-3 w-3" />
            )}
            {hydrated ? "Private · synced to Neon" : "Loading journal…"}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-3 py-5 sm:px-6 sm:py-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-[-0.025em] text-[#202923]">
              Fund Management
            </h1>
            <p className="mt-1 text-[11px] text-[#8a928d]">
              Track and manage your month-over-month portfolio growth and attribution
            </p>
          </div>
          <label className="relative">
            <span className="sr-only">Year</span>
            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="h-9 min-w-[104px] appearance-none rounded-xl border border-[#e3e7e4] bg-white px-3 pr-8 text-[11px] font-bold text-[#303934] shadow-sm outline-none focus:border-[#9ed5bc] focus:ring-2 focus:ring-[#e7f5ee]"
            >
              {years.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[8px] text-[#7c857f]">
              ▼
            </span>
          </label>
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#e3e7e4] bg-white shadow-[0_2px_8px_rgba(24,40,30,0.035)]">
          <div className="journal-scrollbar overflow-x-auto">
            <table className="w-full min-w-[1430px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[82px]" />
                <col className="w-[132px]" />
                <col className="w-[132px]" />
                <col className="w-[148px]" />
                <col className="w-[125px]" />
                <col className="w-[100px]" />
                <col className="w-[148px]" />
                <col className="w-[88px]" />
                <col className="w-[92px]" />
                <col className="w-[104px]" />
                <col className="w-[104px]" />
              </colgroup>
              <thead className="bg-[#fbfcfb]">
                <tr>
                  <HeaderCell align="left">Month</HeaderCell>
                  <HeaderCell editable help={columnHelp.added}>Added (₹)</HeaderCell>
                  <HeaderCell editable help={columnHelp.withdrawn}>Withdrawn (₹)</HeaderCell>
                  <HeaderCell help={columnHelp.starting}>Starting capital (₹)</HeaderCell>
                  <HeaderCell help={columnHelp.netPL}>Net P/L (₹)</HeaderCell>
                  <HeaderCell help={columnHelp.percentPL}>% P/L</HeaderCell>
                  <HeaderCell help={columnHelp.final}>Final capital (₹)</HeaderCell>
                  <HeaderCell help={columnHelp.trades}>Trades</HeaderCell>
                  <HeaderCell help={columnHelp.win}>% Win</HeaderCell>
                  <HeaderCell help={columnHelp.gain}>Avg gain</HeaderCell>
                  <HeaderCell help={columnHelp.loss}>Avg loss</HeaderCell>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.month} className="border-b border-[#f0f2f1] last:border-b-0">
                    <th
                      scope="row"
                      className="h-[54px] px-3 text-left text-[11px] font-bold italic text-[#343d37]"
                    >
                      {monthNames[row.month]}
                    </th>
                    <td className="bg-[#fafbfa] px-2">
                      <CapitalInput
                        value={row.added}
                        label={`${monthNames[row.month]} ${year} capital added`}
                        onChange={(value) => updateFlow(year, row.month, "added", value)}
                      />
                    </td>
                    <td className="bg-[#fafbfa] px-2">
                      <CapitalInput
                        value={row.withdrawn}
                        label={`${monthNames[row.month]} ${year} capital withdrawn`}
                        onChange={(value) => updateFlow(year, row.month, "withdrawn", value)}
                      />
                    </td>
                    <td className="px-3 text-right text-[11px] tabular-nums text-[#7f8882]">
                      {formatCurrency(row.startingCapital)}
                    </td>
                    <td className="px-3 text-right text-[11px]">
                      <MetricCell row={row} value={row.netPL} kind="money" />
                    </td>
                    <td className="px-3 text-right text-[11px]">
                      <MetricCell row={row} value={row.percentPL} kind="percent" />
                    </td>
                    <td className="px-3 text-right text-[11px] font-bold tabular-nums text-[#353e38]">
                      {formatCurrency(row.finalCapital)}
                    </td>
                    <td className="px-3 text-right text-[11px]">
                      <MetricCell row={row} value={row.trades} kind="count" />
                    </td>
                    <td className="px-3 text-right text-[11px]">
                      <MetricCell row={row} value={row.winRate} kind="percent" />
                    </td>
                    <td className="px-3 text-right text-[11px]">
                      <MetricCell row={row} value={row.avgGain} kind="gain" />
                    </td>
                    <td className="px-3 text-right text-[11px]">
                      <MetricCell row={row} value={row.avgLoss} kind="loss" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-3 text-[10px] leading-4 text-[#929a95]">
          Monthly trade metrics include closed trades only and are attributed to their latest exit
          date. January opens on the previous year&apos;s closing capital, so deposits and
          withdrawals carry forward across years.
        </p>
      </div>

      <BottomNav />
    </main>
  );
}
