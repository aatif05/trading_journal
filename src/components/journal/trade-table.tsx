"use client";

import { CalendarDays, Info, RefreshCw, Trash2 } from "lucide-react";
import {
  calculateTradeMetrics,
  ColumnKey,
  durationOptions,
  entryTypeOptions,
  exitTriggerOptions,
  formatCurrency,
  formatPercent,
  planFollowedOptions,
  setupOptions,
  Trade,
} from "@/lib/trades";

type Props = {
  trades: Trade[];
  visibleColumns: Set<ColumnKey>;
  onUpdate: (id: string, patch: Partial<Trade>) => void;
  onDelete: (id: string) => void;
  onRefreshCmp?: (trade: Trade) => void;
  refreshingIds?: Set<string>;
};

const widths: Partial<Record<ColumnKey, string>> = {
  tradeNo: "w-[86px]",
  date: "w-[132px]",
  name: "w-[145px]",
  setup: "w-[138px]",
  side: "w-[112px]",
  entry: "w-[115px]",
  avgEntry: "w-[120px]",
  sl: "w-[110px]",
  cmp: "w-[120px]",
  entryType: "w-[150px]",
  initialQty: "w-[125px]",
  p1Price: "w-[120px]",
  p1Qty: "w-[125px]",
  p1Date: "w-[132px]",
  p1Sl: "w-[110px]",
  p2Price: "w-[120px]",
  p2Qty: "w-[125px]",
  p2Date: "w-[132px]",
  p2Sl: "w-[110px]",
  tsl: "w-[110px]",
  tslGroups: "w-[130px]",
  positionSize: "w-[130px]",
  currentAllocation: "w-[150px]",
  peakAllocation: "w-[145px]",
  slPercent: "w-[95px]",
  e1Price: "w-[120px]",
  e1Qty: "w-[125px]",
  e1Date: "w-[132px]",
  e2Price: "w-[120px]",
  e2Qty: "w-[125px]",
  e2Date: "w-[132px]",
  e3Price: "w-[120px]",
  e3Qty: "w-[125px]",
  e3Date: "w-[132px]",
  openQty: "w-[115px]",
  exitedQty: "w-[120px]",
  avgExitPrice: "w-[130px]",
  stockMove: "w-[110px]",
  rewardRisk: "w-[115px]",
  holdingDays: "w-[115px]",
  positionStatus: "w-[135px]",
  realized: "w-[135px]",
  grossPL: "w-[125px]",
  portfolioImpact: "w-[110px]",
  cummPF: "w-[110px]",
  planFollowed: "w-[125px]",
  exitTrigger: "w-[130px]",
  growthAreas: "w-[150px]",
  capitalAtRisk: "w-[130px]",
  baseDuration: "w-[130px]",
  quickNote: "w-[180px]",
  unrealized: "w-[130px]",
  brokerage: "w-[120px]",
  actions: "w-[90px]",
};

function MoneyInput({
  value,
  onChange,
  label,
  className = "",
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#89918c]">
        ₹
      </span>
      <input
        className={`cell-control cell-number pl-5 ${className}`}
        type="number"
        min="0"
        step="0.01"
        value={value || ""}
        placeholder="0.00"
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </div>
  );
}

function QtyInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
}) {
  return (
    <input
      className="cell-control cell-number"
      type="number"
      min="0"
      step="1"
      value={value || ""}
      placeholder="0"
      onChange={(event) => onChange(Number(event.target.value))}
      aria-label={label}
    />
  );
}

function DateInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="relative">
      <input
        className="cell-control pr-7 text-[11px]"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
      <CalendarDays className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#79817c]" />
    </div>
  );
}

function TextInput({
  value,
  onChange,
  label,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <input
      className={`cell-control ${className}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={label}
    />
  );
}

function MetricPill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex min-h-[34px] w-full items-center justify-center gap-1 rounded-lg bg-[#f5f7f6] px-2 text-center tabular-nums ${className}`}
    >
      {children}
    </span>
  );
}

function TableHead({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`h-11 border-b border-[#e8ebe9] bg-[#fbfcfb] px-2.5 text-left text-[9px] font-semibold uppercase tracking-[0.075em] text-[#747d77] ${className}`}
    >
      <span className="flex items-center gap-1.5">
        <span className="text-[#c2c8c4]">⋮⋮</span>
        {children}
      </span>
    </th>
  );
}

const toneForNumber = (number: number) =>
  number > 0 ? "text-[#158b5a]" : number < 0 ? "text-[#db4d65]" : "text-[#3e4741]";

export function TradeTable({
  trades,
  visibleColumns,
  onUpdate,
  onDelete,
  onRefreshCmp,
  refreshingIds = new Set(),
}: Props) {
  const show = (key: ColumnKey) => visibleColumns.has(key);
  const metrics = calculateTradeMetrics(trades);
  const remove = (trade: Trade) => {
    if (window.confirm(`Delete trade #${trade.tradeNo} (${trade.name})?`)) {
      onDelete(trade.id);
    }
  };

  if (!trades.length) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center border-t border-[#edf0ee] bg-white px-6 text-center">
        <p className="text-sm font-semibold text-[#334039]">No trades found</p>
        <p className="mt-1 text-xs text-[#8a928d]">Add a trade or change your search filters.</p>
      </div>
    );
  }

  return (
    <div className="journal-scrollbar max-h-[calc(100vh-405px)] min-h-[300px] overflow-auto">
      <table className="min-w-max table-fixed border-collapse bg-white">
        <thead className="sticky top-0 z-30">
          <tr>
            <th className="sticky left-0 z-40 h-11 w-12 border-b border-r border-[#e8ebe9] bg-[#fbfcfb] px-2" />
            {show("tradeNo") && <TableHead>Trade no.</TableHead>}
            {show("date") && <TableHead>Date</TableHead>}
            {show("name") && (
              <TableHead className="sticky left-12 z-40 border-r">Name</TableHead>
            )}
            {show("setup") && <TableHead>Setup</TableHead>}
            {show("side") && <TableHead>Buy/Sell</TableHead>}
            {show("entry") && <TableHead>Entry (₹)</TableHead>}
            {show("avgEntry") && <TableHead>Avg entry (₹)</TableHead>}
            {show("sl") && <TableHead>SL (₹)</TableHead>}
            {show("cmp") && <TableHead>CMP (₹)</TableHead>}
            {show("entryType") && <TableHead>Entry type</TableHead>}
            {show("initialQty") && <TableHead>Initial qty/lot</TableHead>}
            {show("p1Price") && <TableHead>Add 1 price (₹)</TableHead>}
            {show("p1Qty") && <TableHead>Add 1 qty/lot</TableHead>}
            {show("p1Date") && <TableHead>Add 1 date</TableHead>}
            {show("p1Sl") && <TableHead>Add 1 SL (₹)</TableHead>}
            {show("p2Price") && <TableHead>Add 2 price (₹)</TableHead>}
            {show("p2Qty") && <TableHead>Add 2 qty/lot</TableHead>}
            {show("p2Date") && <TableHead>Add 2 date</TableHead>}
            {show("p2Sl") && <TableHead>Add 2 SL (₹)</TableHead>}
            {show("tsl") && <TableHead>TSL (₹)</TableHead>}
            {show("tslGroups") && <TableHead>TSL groups</TableHead>}
            {show("positionSize") && <TableHead>Position size</TableHead>}
            {show("currentAllocation") && <TableHead>Current allocation (%)</TableHead>}
            {show("peakAllocation") && <TableHead>Peak allocation (%)</TableHead>}
            {show("slPercent") && <TableHead>SL %</TableHead>}
            {show("e1Price") && <TableHead>Exit 1 price (₹)</TableHead>}
            {show("e1Qty") && <TableHead>Exit 1 qty/lot</TableHead>}
            {show("e1Date") && <TableHead>Exit 1 date</TableHead>}
            {show("e2Price") && <TableHead>Exit 2 price (₹)</TableHead>}
            {show("e2Qty") && <TableHead>Exit 2 qty/lot</TableHead>}
            {show("e2Date") && <TableHead>Exit 2 date</TableHead>}
            {show("e3Price") && <TableHead>Exit 3 price (₹)</TableHead>}
            {show("e3Qty") && <TableHead>Exit 3 qty/lot</TableHead>}
            {show("e3Date") && <TableHead>Exit 3 date</TableHead>}
            {show("openQty") && <TableHead>Open qty/lot</TableHead>}
            {show("exitedQty") && <TableHead>Exited qty/lot</TableHead>}
            {show("avgExitPrice") && <TableHead>Avg exit price</TableHead>}
            {show("stockMove") && <TableHead>Stock move</TableHead>}
            {show("rewardRisk") && <TableHead>Reward:risk</TableHead>}
            {show("holdingDays") && <TableHead>Holding days</TableHead>}
            {show("positionStatus") && <TableHead>Position status</TableHead>}
            {show("realized") && <TableHead>Realised amount</TableHead>}
            {show("grossPL") && <TableHead>Gross P/L ₹</TableHead>}
            {show("portfolioImpact") && <TableHead>PF impact</TableHead>}
            {show("cummPF") && <TableHead>Cumm PF</TableHead>}
            {show("planFollowed") && <TableHead>Plan followed</TableHead>}
            {show("exitTrigger") && <TableHead>Exit trigger</TableHead>}
            {show("growthAreas") && <TableHead>Growth areas</TableHead>}
            {show("capitalAtRisk") && <TableHead>Open heat</TableHead>}
            {show("baseDuration") && <TableHead>Base duration</TableHead>}
            {show("quickNote") && <TableHead>Notes</TableHead>}
            {show("unrealized") && <TableHead>Unrealized P/L</TableHead>}
            {show("brokerage") && <TableHead>Brokerage (₹)</TableHead>}
            {show("actions") && <TableHead>Actions</TableHead>}
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => {
            const trade = metric;
            const cell = "border-b border-[#edf0ee] px-2.5 py-2 text-xs";
            return (
              <tr key={trade.id} className="group hover:bg-[#fbfcfb]">
                <td className="sticky left-0 z-20 w-12 border-b border-r border-[#edf0ee] bg-white px-2 text-center group-hover:bg-[#fbfcfb]">
                  <button
                    onClick={() => remove(trade)}
                    aria-label={`Delete trade ${trade.tradeNo}`}
                    title="Delete trade"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#bcc2be] opacity-30 transition hover:bg-[#fff0f2] hover:text-[#df5066] group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
                {show("tradeNo") && (
                  <td className={`${cell} ${widths.tradeNo} text-center font-bold`}>
                    {trade.tradeNo}
                  </td>
                )}
                {show("date") && (
                  <td className={`${cell} ${widths.date}`}>
                    <DateInput
                      value={trade.date}
                      onChange={(date) => onUpdate(trade.id, { date })}
                      label="Trade date"
                    />
                  </td>
                )}
                {show("name") && (
                  <td
                    className={`${cell} ${widths.name} sticky left-12 z-10 border-r bg-white group-hover:bg-[#fbfcfb]`}
                  >
                    <TextInput
                      className="font-semibold uppercase"
                      value={trade.name}
                      onChange={(name) => onUpdate(trade.id, { name: name.toUpperCase() })}
                      label="Stock name"
                    />
                  </td>
                )}
                {show("setup") && (
                  <td className={`${cell} ${widths.setup}`}>
                    <select
                      className="cell-control"
                      value={trade.setup}
                      onChange={(event) => onUpdate(trade.id, { setup: event.target.value })}
                      aria-label="Trade setup"
                    >
                      {setupOptions.map((option) => (
                        <option key={option} value={option}>
                          {option || "Select setup"}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                {show("side") && (
                  <td className={`${cell} ${widths.side}`}>
                    <select
                      className={`cell-control font-medium ${
                        trade.side === "Buy"
                          ? "bg-[#eaf8f1] text-[#188b5b]"
                          : "bg-[#fff0f2] text-[#d74a62]"
                      }`}
                      value={trade.side}
                      onChange={(event) =>
                        onUpdate(trade.id, { side: event.target.value as Trade["side"] })
                      }
                      aria-label="Buy or sell"
                    >
                      <option>Buy</option>
                      <option>Sell</option>
                    </select>
                  </td>
                )}
                {show("entry") && (
                  <td className={`${cell} ${widths.entry}`}>
                    <MoneyInput
                      value={trade.entry}
                      onChange={(entry) => onUpdate(trade.id, { entry })}
                      label="Entry price"
                    />
                  </td>
                )}
                {show("avgEntry") && (
                  <td className={`${cell} ${widths.avgEntry}`}>
                    <MoneyInput
                      value={trade.avgEntry}
                      onChange={(avgEntry) => onUpdate(trade.id, { avgEntry })}
                      label="Average entry price"
                    />
                  </td>
                )}
                {show("sl") && (
                  <td className={`${cell} ${widths.sl}`}>
                    <MoneyInput
                      value={trade.sl}
                      onChange={(sl) => onUpdate(trade.id, { sl })}
                      label="Stop loss"
                    />
                  </td>
                )}
                {show("cmp") && (
                  <td className={`${cell} ${widths.cmp}`}>
                    <div className="relative">
                      <MoneyInput
                        value={trade.cmp}
                        onChange={(cmp) => onUpdate(trade.id, { cmp })}
                        label="Current market price"
                        className="pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => onRefreshCmp?.(trade)}
                        disabled={!onRefreshCmp || refreshingIds.has(trade.id) || !trade.name.trim()}
                        aria-label={`Refresh live CMP for ${trade.name || "trade"}`}
                        title="Refresh live CMP"
                        className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#85af99] transition hover:bg-[#eaf6f0] hover:text-[#178a58] disabled:opacity-40"
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${refreshingIds.has(trade.id) ? "animate-spin" : ""}`}
                        />
                      </button>
                    </div>
                  </td>
                )}
                {show("entryType") && (
                  <td className={`${cell} ${widths.entryType}`}>
                    <select
                      className="cell-control text-[10px] uppercase"
                      value={trade.entryType}
                      onChange={(event) => onUpdate(trade.id, { entryType: event.target.value })}
                      aria-label="Entry type"
                    >
                      {entryTypeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option || "Select entry type"}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                {show("initialQty") && (
                  <td className={`${cell} ${widths.initialQty}`}>
                    <QtyInput
                      value={trade.initialQty}
                      onChange={(initialQty) => onUpdate(trade.id, { initialQty })}
                      label="Initial quantity"
                    />
                  </td>
                )}
                {show("p1Price") && (
                  <td className={`${cell} ${widths.p1Price}`}>
                    <MoneyInput
                      value={trade.p1Price}
                      onChange={(p1Price) => onUpdate(trade.id, { p1Price })}
                      label="Add 1 price"
                    />
                  </td>
                )}
                {show("p1Qty") && (
                  <td className={`${cell} ${widths.p1Qty}`}>
                    <QtyInput
                      value={trade.p1Qty}
                      onChange={(p1Qty) => onUpdate(trade.id, { p1Qty })}
                      label="Add 1 quantity"
                    />
                  </td>
                )}
                {show("p1Date") && (
                  <td className={`${cell} ${widths.p1Date}`}>
                    <DateInput
                      value={trade.p1Date}
                      onChange={(p1Date) => onUpdate(trade.id, { p1Date })}
                      label="Add 1 date"
                    />
                  </td>
                )}
                {show("p1Sl") && (
                  <td className={`${cell} ${widths.p1Sl}`}>
                    <MoneyInput
                      value={trade.p1Sl}
                      onChange={(p1Sl) => onUpdate(trade.id, { p1Sl })}
                      label="Add 1 stop loss"
                    />
                  </td>
                )}
                {show("p2Price") && (
                  <td className={`${cell} ${widths.p2Price}`}>
                    <MoneyInput
                      value={trade.p2Price}
                      onChange={(p2Price) => onUpdate(trade.id, { p2Price })}
                      label="Add 2 price"
                    />
                  </td>
                )}
                {show("p2Qty") && (
                  <td className={`${cell} ${widths.p2Qty}`}>
                    <QtyInput
                      value={trade.p2Qty}
                      onChange={(p2Qty) => onUpdate(trade.id, { p2Qty })}
                      label="Add 2 quantity"
                    />
                  </td>
                )}
                {show("p2Date") && (
                  <td className={`${cell} ${widths.p2Date}`}>
                    <DateInput
                      value={trade.p2Date}
                      onChange={(p2Date) => onUpdate(trade.id, { p2Date })}
                      label="Add 2 date"
                    />
                  </td>
                )}
                {show("p2Sl") && (
                  <td className={`${cell} ${widths.p2Sl}`}>
                    <MoneyInput
                      value={trade.p2Sl}
                      onChange={(p2Sl) => onUpdate(trade.id, { p2Sl })}
                      label="Add 2 stop loss"
                    />
                  </td>
                )}
                {show("tsl") && (
                  <td className={`${cell} ${widths.tsl}`}>
                    <MoneyInput
                      value={trade.tsl}
                      onChange={(tsl) => onUpdate(trade.id, { tsl })}
                      label="Trailing stop loss"
                    />
                  </td>
                )}
                {show("tslGroups") && (
                  <td className={`${cell} ${widths.tslGroups}`}>
                    <TextInput
                      value={trade.tslGroups}
                      onChange={(tslGroups) => onUpdate(trade.id, { tslGroups })}
                      label="TSL groups"
                    />
                  </td>
                )}
                {show("positionSize") && (
                  <td className={`${cell} ${widths.positionSize}`}>
                    <MetricPill className="font-semibold">
                      {formatCurrency(metric.positionSize)}
                    </MetricPill>
                  </td>
                )}
                {show("currentAllocation") && (
                  <td className={`${cell} ${widths.currentAllocation}`}>
                    <MetricPill className="font-semibold">
                      {formatPercent(metric.currentAllocation)}
                    </MetricPill>
                  </td>
                )}
                {show("peakAllocation") && (
                  <td className={`${cell} ${widths.peakAllocation}`}>
                    <div className="relative">
                      <input
                        className="cell-control cell-number pr-6"
                        type="number"
                        min="0"
                        step="0.01"
                        value={trade.peakAllocation || ""}
                        placeholder="0.00"
                        onChange={(event) =>
                          onUpdate(trade.id, { peakAllocation: Number(event.target.value) })
                        }
                        aria-label="Peak allocation percent"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#89918c]">
                        %
                      </span>
                    </div>
                  </td>
                )}
                {show("slPercent") && (
                  <td className={`${cell} ${widths.slPercent}`}>
                    <MetricPill className={`font-semibold ${toneForNumber(-metric.slPercent || 0)}`}>
                      {formatPercent(metric.slPercent)}
                    </MetricPill>
                  </td>
                )}
                {show("e1Price") && (
                  <td className={`${cell} ${widths.e1Price}`}>
                    <MoneyInput
                      value={trade.e1Price}
                      onChange={(e1Price) => onUpdate(trade.id, { e1Price })}
                      label="Exit 1 price"
                    />
                  </td>
                )}
                {show("e1Qty") && (
                  <td className={`${cell} ${widths.e1Qty}`}>
                    <QtyInput
                      value={trade.e1Qty}
                      onChange={(e1Qty) => onUpdate(trade.id, { e1Qty })}
                      label="Exit 1 quantity"
                    />
                  </td>
                )}
                {show("e1Date") && (
                  <td className={`${cell} ${widths.e1Date}`}>
                    <DateInput
                      value={trade.e1Date}
                      onChange={(e1Date) => onUpdate(trade.id, { e1Date })}
                      label="Exit 1 date"
                    />
                  </td>
                )}
                {show("e2Price") && (
                  <td className={`${cell} ${widths.e2Price}`}>
                    <MoneyInput
                      value={trade.e2Price}
                      onChange={(e2Price) => onUpdate(trade.id, { e2Price })}
                      label="Exit 2 price"
                    />
                  </td>
                )}
                {show("e2Qty") && (
                  <td className={`${cell} ${widths.e2Qty}`}>
                    <QtyInput
                      value={trade.e2Qty}
                      onChange={(e2Qty) => onUpdate(trade.id, { e2Qty })}
                      label="Exit 2 quantity"
                    />
                  </td>
                )}
                {show("e2Date") && (
                  <td className={`${cell} ${widths.e2Date}`}>
                    <DateInput
                      value={trade.e2Date}
                      onChange={(e2Date) => onUpdate(trade.id, { e2Date })}
                      label="Exit 2 date"
                    />
                  </td>
                )}
                {show("e3Price") && (
                  <td className={`${cell} ${widths.e3Price}`}>
                    <MoneyInput
                      value={trade.e3Price}
                      onChange={(e3Price) => onUpdate(trade.id, { e3Price })}
                      label="Exit 3 price"
                    />
                  </td>
                )}
                {show("e3Qty") && (
                  <td className={`${cell} ${widths.e3Qty}`}>
                    <QtyInput
                      value={trade.e3Qty}
                      onChange={(e3Qty) => onUpdate(trade.id, { e3Qty })}
                      label="Exit 3 quantity"
                    />
                  </td>
                )}
                {show("e3Date") && (
                  <td className={`${cell} ${widths.e3Date}`}>
                    <DateInput
                      value={trade.e3Date}
                      onChange={(e3Date) => onUpdate(trade.id, { e3Date })}
                      label="Exit 3 date"
                    />
                  </td>
                )}
                {show("openQty") && (
                  <td className={`${cell} ${widths.openQty}`}>
                    <MetricPill className="font-semibold">{metric.openQty}</MetricPill>
                  </td>
                )}
                {show("exitedQty") && (
                  <td className={`${cell} ${widths.exitedQty}`}>
                    <MetricPill className="font-semibold">{metric.exitedQty}</MetricPill>
                  </td>
                )}
                {show("avgExitPrice") && (
                  <td className={`${cell} ${widths.avgExitPrice}`}>
                    <MoneyInput
                      value={trade.avgExitPrice || metric.computedAvgExit}
                      onChange={(avgExitPrice) => onUpdate(trade.id, { avgExitPrice })}
                      label="Average exit price"
                    />
                  </td>
                )}
                {show("stockMove") && (
                  <td className={`${cell} ${widths.stockMove}`}>
                    <MetricPill className={`font-semibold ${toneForNumber(metric.stockMove)}`}>
                      {formatPercent(metric.stockMove)}
                      <Info className="h-3 w-3 text-[#a7aea9]" />
                    </MetricPill>
                  </td>
                )}
                {show("rewardRisk") && (
                  <td className={`${cell} ${widths.rewardRisk}`}>
                    <MetricPill className="font-semibold">
                      {metric.rewardRisk.toFixed(2)}R
                      <Info className="h-3 w-3 text-[#a7aea9]" />
                    </MetricPill>
                  </td>
                )}
                {show("holdingDays") && (
                  <td className={`${cell} ${widths.holdingDays}`}>
                    <MetricPill className="font-medium">
                      {metric.holdingDays} days
                      <Info className="h-3 w-3 text-[#a7aea9]" />
                    </MetricPill>
                  </td>
                )}
                {show("positionStatus") && (
                  <td className={`${cell} ${widths.positionStatus}`}>
                    <select
                      className={`cell-control text-center font-semibold ${
                        trade.positionStatus === "Open" ? "text-[#26302a]" : "text-[#69716c]"
                      }`}
                      value={trade.positionStatus}
                      onChange={(event) =>
                        onUpdate(trade.id, {
                          positionStatus: event.target.value as Trade["positionStatus"],
                        })
                      }
                      aria-label="Position status"
                    >
                      <option>Open</option>
                      <option>Closed</option>
                    </select>
                  </td>
                )}
                {show("realized") && (
                  <td className={`${cell} ${widths.realized}`}>
                    <MetricPill className={`font-semibold ${toneForNumber(metric.realized)}`}>
                      {formatCurrency(metric.realized)}
                    </MetricPill>
                  </td>
                )}
                {show("grossPL") && (
                  <td className={`${cell} ${widths.grossPL}`}>
                    <MetricPill className={`font-bold ${toneForNumber(metric.grossPL)}`}>
                      {formatCurrency(metric.grossPL)}
                    </MetricPill>
                  </td>
                )}
                {show("portfolioImpact") && (
                  <td className={`${cell} ${widths.portfolioImpact}`}>
                    <MetricPill className={`font-semibold ${toneForNumber(metric.portfolioImpact)}`}>
                      {formatPercent(metric.portfolioImpact)}
                    </MetricPill>
                  </td>
                )}
                {show("cummPF") && (
                  <td className={`${cell} ${widths.cummPF}`}>
                    <MetricPill className={`font-semibold ${toneForNumber(metric.cummPF)}`}>
                      {formatPercent(metric.cummPF)}
                    </MetricPill>
                  </td>
                )}
                {show("planFollowed") && (
                  <td className={`${cell} ${widths.planFollowed}`}>
                    <select
                      className="cell-control"
                      value={trade.planFollowed}
                      onChange={(event) => onUpdate(trade.id, { planFollowed: event.target.value })}
                      aria-label="Plan followed"
                    >
                      {planFollowedOptions.map((option) => (
                        <option key={option} value={option}>
                          {option || "Select"}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                {show("exitTrigger") && (
                  <td className={`${cell} ${widths.exitTrigger}`}>
                    <select
                      className="cell-control"
                      value={trade.exitTrigger}
                      onChange={(event) => onUpdate(trade.id, { exitTrigger: event.target.value })}
                      aria-label="Exit trigger"
                    >
                      {exitTriggerOptions.map((option) => (
                        <option key={option} value={option}>
                          {option || "Select"}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                {show("growthAreas") && (
                  <td className={`${cell} ${widths.growthAreas}`}>
                    <TextInput
                      value={trade.growthAreas}
                      onChange={(growthAreas) => onUpdate(trade.id, { growthAreas })}
                      label="Growth areas"
                    />
                  </td>
                )}
                {show("capitalAtRisk") && (
                  <td className={`${cell} ${widths.capitalAtRisk}`}>
                    <MetricPill className="font-semibold text-[#e14f69]">
                      {formatCurrency(metric.capitalAtRisk)}
                    </MetricPill>
                  </td>
                )}
                {show("baseDuration") && (
                  <td className={`${cell} ${widths.baseDuration}`}>
                    <select
                      className="cell-control"
                      value={trade.baseDuration}
                      onChange={(event) => onUpdate(trade.id, { baseDuration: event.target.value })}
                      aria-label="Base duration"
                    >
                      {durationOptions.map((option) => (
                        <option key={option} value={option}>
                          {option || "Select"}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                {show("quickNote") && (
                  <td className={`${cell} ${widths.quickNote}`}>
                    <TextInput
                      value={trade.quickNote}
                      onChange={(quickNote) => onUpdate(trade.id, { quickNote })}
                      label="Notes"
                    />
                  </td>
                )}
                {show("unrealized") && (
                  <td className={`${cell} ${widths.unrealized}`}>
                    <MetricPill className={`font-semibold ${toneForNumber(metric.unrealized)}`}>
                      {formatCurrency(metric.unrealized)}
                    </MetricPill>
                  </td>
                )}
                {show("brokerage") && (
                  <td className={`${cell} ${widths.brokerage}`}>
                    <MoneyInput
                      value={trade.brokerage}
                      onChange={(brokerage) => onUpdate(trade.id, { brokerage })}
                      label="Brokerage"
                    />
                  </td>
                )}
                {show("actions") && (
                  <td className={`${cell} ${widths.actions} text-center`}>
                    <button
                      onClick={() => remove(trade)}
                      aria-label={`Delete trade ${trade.tradeNo}`}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#ead7db] bg-[#fff7f8] px-2.5 text-[11px] font-semibold text-[#d24a61] transition hover:bg-[#ffe8ec]"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
