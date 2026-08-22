"use client";

import { CandlestickSeries, ColorType, CrosshairMode, createChart, HistogramSeries, LineSeries, type IChartApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { BarChart3, ChevronDown, Maximize2, Pause, Play, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { Trade } from "@/lib/trades";

const base = Array.from({ length: 90 }, (_, i) => {
  const close = 390 + i * 0.7 + Math.sin(i / 5) * 16 + (i > 55 ? (i - 55) * 2.2 : 0);
  const open = close - Math.sin(i * 1.7) * 7;
  return { time: Math.floor(new Date(2026, 0, i + 1).getTime() / 1000) as UTCTimestamp, open, high: Math.max(open, close) + 5 + (i % 4), low: Math.min(open, close) - 5, close, volume: 500 + ((i * 173) % 1400) };
});

function average(data: typeof base, period: number, exponential = false) {
  let prev = data[0].close;
  return data.map((item, i) => {
    if (i < period - 1) return { time: item.time, value: NaN };
    if (exponential) prev = item.close * (2 / (period + 1)) + prev * (1 - 2 / (period + 1));
    else prev = data.slice(i - period + 1, i + 1).reduce((sum, x) => sum + x.close, 0) / period;
    return { time: item.time, value: prev };
  }).filter((x) => Number.isFinite(x.value));
}

export function StockChart({ trades = [] }: { trades?: Trade[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const symbol = "AEROFLEX";
  const period = "1Y";
  const [replay, setReplay] = useState(false);
  const [markers, setMarkers] = useState<string[]>([]);

  useEffect(() => {
    if (!ref.current) return;
    const api = createChart(ref.current, { autoSize: true, layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#69736c" }, grid: { vertLines: { color: "#f1f4f2" }, horzLines: { color: "#f1f4f2" } }, crosshair: { mode: CrosshairMode.Normal }, rightPriceScale: { borderColor: "#e5eae6" }, timeScale: { borderColor: "#e5eae6", timeVisible: false } });
    const candles = api.addSeries(CandlestickSeries, { upColor: "#16a05d", downColor: "#ef4f5f", borderUpColor: "#16a05d", borderDownColor: "#ef4f5f", wickUpColor: "#16a05d", wickDownColor: "#ef4f5f" });
    candles.setData(base);
    const volume = api.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(base.map((x) => ({ time: x.time, value: x.volume, color: x.close >= x.open ? "#9bdab7" : "#f4a0a8" })));
    const sma = api.addSeries(LineSeries, { color: "#2864dd", lineWidth: 2, title: "SMA 10" });
    sma.setData(average(base, 10));
    const ema = api.addSeries(LineSeries, { color: "#ef5b62", lineWidth: 2, title: "EMA 20" });
    ema.setData(average(base, 20, true));
    api.timeScale().fitContent();
    chart.current = api;
    return () => { api.remove(); chart.current = null; };
  }, []);

  const trade = trades.find((x) => x.name === symbol);
  return <main className="min-h-screen bg-white pb-20 text-[#202923]">
    <header className="flex flex-wrap items-center justify-center gap-3 border-b border-[#edf0ee] px-4 py-4">
      <button className="flex items-center gap-2 rounded-xl border border-[#e6ebe7] px-5 py-2.5 font-bold shadow-sm"><span className="size-3 rounded-full bg-[#ef3138]" />{symbol}<ChevronDown className="size-4" /></button>
      <button className="rounded-xl border border-[#e6ebe7] px-5 py-2.5 font-semibold">{period}<ChevronDown className="ml-4 inline size-4" /></button>
      <button onClick={() => setReplay(!replay)} className="flex items-center gap-2 rounded-xl border border-[#e6ebe7] px-5 py-2.5 font-semibold">{replay ? <Pause className="size-4" /> : <Play className="size-4" />} Replay</button>
      <button className="flex items-center gap-2 rounded-xl border border-[#e6ebe7] px-5 py-2.5 font-semibold"><BarChart3 className="size-4" /> Bars</button>
      <button className="rounded-xl border border-[#e6ebe7] p-2.5" aria-label="Chart settings"><Settings2 className="size-4" /></button>
    </header>
    <section className="mx-auto max-w-[1500px] px-4 pt-4"><div className="flex flex-wrap items-center gap-3 rounded-2xl bg-[#fbfcfb] px-5 py-3 text-sm"><span className="font-bold uppercase tracking-wider text-[#9ba39d]">Moving avg:</span><span className="font-semibold text-[#2864dd]">● SMA 10</span><span className="font-semibold text-[#ef5b62]">● EMA 20</span><button className="ml-auto text-[#7a847d]" aria-label="Refresh chart"><RefreshCw className="size-4" /></button></div><div className="mt-3 flex items-center gap-4 px-2 text-sm"><span className="font-semibold text-[#2864dd]">━ SMA 10</span><span className="font-semibold text-[#ef5b62]">━ EMA 20</span>{trade && <span className="ml-auto rounded-lg bg-[#e9f8ef] px-3 py-1 text-[#148b50]">Entry ₹{trade.entry}</span>}</div><div ref={ref} className="h-[min(68vh,680px)] min-h-[420px] w-full" /></section>
    <div className="fixed bottom-20 right-5 flex flex-col gap-2"><button onClick={() => setMarkers([...markers, "marker"])} className="rounded-full bg-[#17201b] p-3 text-white shadow-lg" aria-label="Add entry or exit marker"><Plus className="size-5" /></button>{markers.length > 0 && <button onClick={() => setMarkers([])} className="rounded-full border border-[#e4e9e5] bg-white p-3 shadow-lg" aria-label="Clear markers"><Trash2 className="size-5" /></button>}<button className="rounded-full border border-[#e4e9e5] bg-white p-3 shadow-lg" aria-label="Fullscreen"><Maximize2 className="size-5" /></button></div>
  </main>;
}
