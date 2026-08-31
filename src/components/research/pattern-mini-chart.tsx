"use client";

import { CandlestickSeries, ColorType, createChart, HistogramSeries, LineSeries, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";

type Tick = [string, string, string, string, string, string];
export function PatternMiniChart({ ticks, ceiling, floor, breakout }: { ticks: Tick[]; ceiling: number; floor: number; breakout: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || ticks.length < 2) return;
    const values = ticks.map((tick) => Number(tick[4]));
    const chart = createChart(ref.current, { autoSize: true, layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#718079" }, grid: { vertLines: { visible: false }, horzLines: { color: "#eef3ef" } }, rightPriceScale: { visible: true, borderColor: "#dce7df", scaleMargins: { top: 0.08, bottom: 0.22 } }, timeScale: { visible: true, borderColor: "#dce7df", timeVisible: false }, crosshair: { vertLine: { visible: false }, horzLine: { visible: false } } });
    const series = chart.addSeries(CandlestickSeries, { upColor: "#15955f", downColor: "#e14f69", borderUpColor: "#15955f", borderDownColor: "#e14f69", wickUpColor: "#15955f", wickDownColor: "#e14f69" });
    series.setData(ticks.map((tick) => ({ time: Math.floor(new Date(tick[0]).getTime() / 1000) as UTCTimestamp, open: Number(tick[1]), high: Number(tick[2]), low: Number(tick[3]), close: Number(tick[4]) })));
    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    volume.setData(ticks.map((tick) => ({ time: Math.floor(new Date(tick[0]).getTime() / 1000) as UTCTimestamp, value: Number(tick[5]) || 0, color: Number(tick[4]) >= Number(tick[1]) ? "#9ed4b5" : "#efb0b9" })));
    series.createPriceLine({ price: ceiling, color: "#15955f", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "Box high" });
    series.createPriceLine({ price: floor, color: "#9bc9ad", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "Box low" });
    series.createPriceLine({ price: breakout, color: "#c48a17", lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: "Breakout" });
    const ma = chart.addSeries(LineSeries, { color: "#4d78a8", lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title: "MA20" });
    ma.setData(ticks.map((tick, index) => ({ time: Math.floor(new Date(tick[0]).getTime() / 1000) as UTCTimestamp, value: values.slice(Math.max(0, index - 19), index + 1).reduce((sum, value) => sum + value, 0) / Math.min(index + 1, 20) })));
    const ma50 = chart.addSeries(LineSeries, { color: "#b7791f", lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title: "MA50" });
    ma50.setData(ticks.map((tick, index) => ({ time: Math.floor(new Date(tick[0]).getTime() / 1000) as UTCTimestamp, value: values.slice(Math.max(0, index - 49), index + 1).reduce((sum, value) => sum + value, 0) / Math.min(index + 1, 50) })));
    const lineData = values.map((_, index) => ({ time: (index + 1) as UTCTimestamp }));
    const ceilingLine = chart.addSeries(LineSeries, { color: "#8bb99a", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    const floorLine = chart.addSeries(LineSeries, { color: "#8bb99a", lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    ceilingLine.setData(lineData.map((point) => ({ ...point, value: ceiling })));
    floorLine.setData(lineData.map((point) => ({ ...point, value: floor })));
    const baseBand = chart.addSeries(LineSeries, { color: "rgba(139, 185, 154, 0.16)", lineWidth: 3, priceLineVisible: false, lastValueVisible: false });
    baseBand.setData(lineData.map((point) => ({ ...point, value: (ceiling + floor) / 2 })));
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, ticks.length - 90), to: ticks.length + 2 });
    return () => chart.remove();
  }, [breakout, ceiling, floor, ticks]);
  return <div ref={ref} className="h-32 w-full overflow-hidden rounded-xl border border-[#e8eee9] bg-white" aria-label="Candlestick base formation chart" />;
}
