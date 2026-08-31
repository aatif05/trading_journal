"use client";

import { CandlestickSeries, ColorType, createChart, HistogramSeries, LineSeries, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";

type Tick = [string, string, string, string, string, string];

type PatternMiniChartProps = {
  ticks: Tick[];
  ceiling: number;
  floor: number;
  breakout: number;
  boxStart?: string | null;
  boxEnd?: string | null;
};

export function PatternMiniChart({ ticks, ceiling, floor, breakout, boxStart, boxEnd }: PatternMiniChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || ticks.length < 2) return;

    const values = ticks.map((tick) => Number(tick[4]));
    const times = ticks.map((tick) => Math.floor(new Date(tick[0]).getTime() / 1000) as UTCTimestamp);

    const chart = createChart(ref.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#ffffff" }, textColor: "#718079" },
      grid: { vertLines: { visible: false }, horzLines: { color: "#eef3ef" } },
      rightPriceScale: { visible: true, borderColor: "#dce7df", scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: { visible: true, borderColor: "#dce7df", timeVisible: false },
      crosshair: { vertLine: { visible: false }, horzLine: { visible: false } },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#15955f",
      downColor: "#e14f69",
      borderUpColor: "#15955f",
      borderDownColor: "#e14f69",
      wickUpColor: "#15955f",
      wickDownColor: "#e14f69",
    });
    series.setData(
      ticks.map((tick, i) => ({
        time: times[i],
        open: Number(tick[1]),
        high: Number(tick[2]),
        low: Number(tick[3]),
        close: Number(tick[4]),
      })),
    );

    const volume = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    volume.setData(
      ticks.map((tick, i) => ({
        time: times[i],
        value: Number(tick[5]) || 0,
        color: Number(tick[4]) >= Number(tick[1]) ? "#9ed4b5" : "#efb0b9",
      })),
    );

    series.createPriceLine({
      price: breakout,
      color: "#c48a17",
      lineWidth: 1,
      lineStyle: 1,
      axisLabelVisible: true,
      title: "Breakout",
    });

    const ma = chart.addSeries(LineSeries, { color: "#4d78a8", lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title: "MA20" });
    ma.setData(
      ticks.map((tick, index) => ({
        time: times[index],
        value: values.slice(Math.max(0, index - 19), index + 1).reduce((sum, value) => sum + value, 0) / Math.min(index + 1, 20),
      })),
    );

    const ma50 = chart.addSeries(LineSeries, { color: "#b7791f", lineWidth: 1, priceLineVisible: false, lastValueVisible: true, title: "MA50" });
    ma50.setData(
      ticks.map((tick, index) => ({
        time: times[index],
        value: values.slice(Math.max(0, index - 49), index + 1).reduce((sum, value) => sum + value, 0) / Math.min(index + 1, 50),
      })),
    );

    if (boxStart && boxEnd) {
      const startTime = Math.floor(new Date(boxStart).getTime() / 1000);
      const endTime = Math.floor(new Date(boxEnd).getTime() / 1000);
      const inRange = times.filter((t) => t >= startTime && t <= endTime);

      if (inRange.length >= 2) {
        const boxTop = chart.addSeries(LineSeries, {
          color: "#15955f",
          lineWidth: 2,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        boxTop.setData(inRange.map((time) => ({ time: time as UTCTimestamp, value: ceiling })));

        const boxBottom = chart.addSeries(LineSeries, {
          color: "#9bc9ad",
          lineWidth: 2,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        boxBottom.setData(inRange.map((time) => ({ time: time as UTCTimestamp, value: floor })));
      }
    }

    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, ticks.length - 90), to: ticks.length + 2 });

    return () => chart.remove();
  }, [breakout, ceiling, floor, ticks, boxStart, boxEnd]);

  return (
    <div
      ref={ref}
      className="h-full w-full overflow-hidden rounded-xl border border-[#e8eee9] bg-white"
      aria-label="Candlestick base formation chart"
    />
  );
}
