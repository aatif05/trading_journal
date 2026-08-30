"use client";

import { CandlestickSeries, ColorType, createChart, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";

export function PatternMiniChart({ values, ceiling, floor, breakout }: { values: number[]; ceiling: number; floor: number; breakout: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || values.length < 2) return;
    const chart = createChart(ref.current, { autoSize: true, layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#718079" }, grid: { vertLines: { visible: false }, horzLines: { color: "#eef3ef" } }, rightPriceScale: { visible: false }, timeScale: { visible: false }, crosshair: { vertLine: { visible: false }, horzLine: { visible: false } } });
    const series = chart.addSeries(CandlestickSeries, { upColor: "#15955f", downColor: "#e14f69", borderUpColor: "#15955f", borderDownColor: "#e14f69", wickUpColor: "#15955f", wickDownColor: "#e14f69" });
    series.setData(values.map((close, index) => ({ time: (index + 1) as UTCTimestamp, open: index ? values[index - 1] : close, high: Math.max(close, index ? values[index - 1] : close) * 1.004, low: Math.min(close, index ? values[index - 1] : close) * 0.996, close })));
    series.createPriceLine({ price: ceiling, color: "#15955f", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "Box high" });
    series.createPriceLine({ price: floor, color: "#9bc9ad", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "Box low" });
    series.createPriceLine({ price: breakout, color: "#c48a17", lineWidth: 1, lineStyle: 1, axisLabelVisible: false, title: "Trigger" });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [breakout, ceiling, floor, values]);
  return <div ref={ref} className="h-32 w-full overflow-hidden rounded-xl border border-[#e8eee9] bg-white" aria-label="Candlestick base formation chart" />;
}
