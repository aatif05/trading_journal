"use client";

import {
  Columns3,
  Download,
  Eye,
  FileDown,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import { ChangeEvent, useRef } from "react";
import {
  ColumnKey,
  Trade,
  tradeColumns,
  tradesFromCsv,
  tradesToCsv,
} from "@/lib/trades";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  status: "All" | "Active" | "Open" | "Partial" | "Closed";
  onStatusChange: (status: "All" | "Active" | "Open" | "Partial" | "Closed") => void;
  visibleColumns: Set<ColumnKey>;
  onToggleColumn: (key: ColumnKey) => void;
  trades: Trade[];
  onImport: (trades: Trade[]) => void;
  onAdd: () => void;
  onRefreshPrices?: () => void;
  refreshingPrices?: boolean;
};

const iconButton =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[#5f6e66] transition hover:border-[#d7e2da] hover:bg-white hover:text-[#17251d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8e778]";

export function JournalToolbar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  visibleColumns,
  onToggleColumn,
  trades,
  onImport,
  onAdd,
  onRefreshPrices,
  refreshingPrices = false,
}: Props) {
  const fileInput = useRef<HTMLInputElement>(null);

  const exportCsv = () => {
    const blob = new Blob([tradesToCsv(trades)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `trading-journal-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const imported = tradesFromCsv(await file.text());
    if (imported.length) onImport(imported);
    event.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e0e8e2] bg-[#f8faf8] p-2.5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a928d]" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search trades"
            aria-label="Search trades"
            className="h-9 w-52 rounded-xl border border-[#dbe5de] bg-white pl-9 pr-3 text-xs font-medium outline-none transition placeholder:text-[#9aa79f] focus:border-[#8dba9f] focus:ring-2 focus:ring-[#e4f4e9]"
          />
        </label>
        <label className="flex h-9 items-center gap-2 rounded-xl border border-[#dbe5de] bg-white px-3 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-[#79c78f]" />
          Status:
          <select
            value={status}
            onChange={(event) =>
              onStatusChange(
                event.target.value as "All" | "Active" | "Open" | "Partial" | "Closed",
              )
            }
            className="bg-transparent font-semibold outline-none"
            aria-label="Filter by trade status"
          >
            <option>All</option>
            <option>Active</option>
            <option>Open</option>
            <option>Partial</option>
            <option>Closed</option>
          </select>
        </label>

        <details className="relative">
          <summary className="flex h-9 list-none items-center gap-2 rounded-xl border border-[#dbe5de] bg-white px-3 text-xs font-semibold transition hover:border-[#c8d8ce] hover:bg-[#fbfcfb]">
            <Columns3 className="h-3.5 w-3.5" />
            Columns
          </summary>
          <div className="absolute left-0 top-11 z-40 grid max-h-80 w-72 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-[#e1e5e2] bg-white p-2 shadow-xl">
            {tradeColumns.map((column) => (
              <label
                key={column.key}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] hover:bg-[#f5f7f6]"
              >
                <input
                  type="checkbox"
                  checked={visibleColumns.has(column.key)}
                  onChange={() => onToggleColumn(column.key)}
                  className="accent-[#198e5d]"
                />
                {column.label}
              </label>
            ))}
          </div>
        </details>
      </div>

      <div className="flex items-center gap-1 self-end lg:self-auto">
        <button className={iconButton} aria-label="Focus journal view" title="Focus view">
          <Eye className="h-4 w-4" />
        </button>
        <button
          className={iconButton}
          onClick={onRefreshPrices}
          disabled={!onRefreshPrices || refreshingPrices}
          aria-label="Refresh open trade CMPs"
          title="Refresh open trade CMPs"
        >
          <RefreshCw className={`h-4 w-4 ${refreshingPrices ? "animate-spin" : ""}`} />
        </button>
        <button
          className={`${iconButton} border-[#15251c] bg-[#17251d] text-white shadow-[0_3px_8px_rgba(19,37,29,0.15)] hover:border-[#17251d] hover:bg-[#2b4034] hover:text-white`}
          onClick={onAdd}
          aria-label="Add trade"
          title="Add trade"
        >
          <Plus className="h-4 w-4" />
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={importCsv}
        />
        <button
          className={iconButton}
          onClick={() => fileInput.current?.click()}
          aria-label="Import CSV"
          title="Import CSV"
        >
          <Upload className="h-4 w-4" />
        </button>
        <button className={iconButton} onClick={exportCsv} aria-label="Export CSV" title="Export CSV">
          <Download className="h-4 w-4" />
        </button>
        <span className="ml-1 hidden items-center gap-1 text-[10px] text-[#9ba29e] sm:flex">
          <FileDown className="h-3 w-3" />
          CSV
        </span>
      </div>
    </div>
  );
}
