"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import { formatCurrency } from "@/lib/formatters";
import type { MarketSnapshot, PricePoint } from "@/lib/types";
import { Skeleton } from "@/components/skeleton";

const ranges = ["1d", "5d", "1m", "3m", "6m", "ytd", "1y", "5y", "max"] as const;
type ChartRange = (typeof ranges)[number];
type ChartStyle = "area" | "candles";
type Indicator = "sma20" | "ema20" | "bollinger" | "volume";

export function AdvancedStockChart({ market }: { market: MarketSnapshot }) {
  const [range, setRange] = useState<ChartRange>("1d");
  const [style, setStyle] = useState<ChartStyle>("area");
  const [indicators, setIndicators] = useState<Set<Indicator>>(new Set(["volume"]));
  const [snapshots, setSnapshots] = useState<Partial<Record<ChartRange, MarketSnapshot>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);

  useEffect(() => {
    return () => requestRef.current?.controller.abort();
  }, []);

  const displayedSnapshot = range === "1d" ? market : snapshots[range];

  async function selectRange(nextRange: ChartRange) {
    setRange(nextRange);
    setError(null);
    requestRef.current?.controller.abort();
    if (nextRange === "1d" || snapshots[nextRange]) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    const id = (requestRef.current?.id ?? 0) + 1;
    requestRef.current = { id, controller };
    setLoading(true);
    try {
      const response = await fetch(`/api/alphasign/api/market/${encodeURIComponent(market.ticker)}?range=${nextRange}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = (await response.json()) as MarketSnapshot & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Chart data request failed.");
      if (requestRef.current?.id === id) {
        setSnapshots((current) => ({ ...current, [nextRange]: payload }));
      }
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === "AbortError") && requestRef.current?.id === id) {
        setError(reason instanceof Error ? reason.message : "Chart data request failed.");
      }
    } finally {
      if (requestRef.current?.id === id) setLoading(false);
    }
  }

  function toggleIndicator(indicator: Indicator) {
    setIndicators((current) => {
      const next = new Set(current);
      if (next.has(indicator)) next.delete(indicator);
      else next.add(indicator);
      return next;
    });
  }

  return (
    <div className="inset mt-4 overflow-hidden p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--hairline)] pb-3">
        <div className="flex flex-wrap gap-1" aria-label="Chart range">
          {ranges.map((value) => (
            <ControlButton key={value} active={range === value} onClick={() => selectRange(value)}>
              {value.toUpperCase()}
            </ControlButton>
          ))}
        </div>
        <div className="flex gap-1">
          <ControlButton active={style === "area"} onClick={() => setStyle("area")}>Line</ControlButton>
          <ControlButton active={style === "candles"} onClick={() => setStyle("candles")}>Candles</ControlButton>
          <ControlButton active={false} onClick={() => setResetKey((key) => key + 1)}>Reset</ControlButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--hairline)] py-2">
        <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-[var(--ink-tertiary)]">Studies</span>
        <ControlButton active={indicators.has("sma20")} onClick={() => toggleIndicator("sma20")}>SMA 20</ControlButton>
        <ControlButton active={indicators.has("ema20")} onClick={() => toggleIndicator("ema20")}>EMA 20</ControlButton>
        <ControlButton active={indicators.has("bollinger")} onClick={() => toggleIndicator("bollinger")}>Bollinger</ControlButton>
        <ControlButton active={indicators.has("volume")} onClick={() => toggleIndicator("volume")}>Volume</ControlButton>
        <span className="ml-auto text-[11px] text-[var(--ink-tertiary)]">
          {loading ? "Loading…" : error ?? (displayedSnapshot ? `${displayedSnapshot.chart_interval ?? "live"} bars · ${displayedSnapshot.history.length} points` : "Select a range")}
        </span>
      </div>
      {loading || !displayedSnapshot ? (
        <div className="mt-2 space-y-2" aria-busy="true" aria-label="Loading chart range">
          <Skeleton className="h-[360px] w-full" />
          <div className="flex justify-between"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-32" /></div>
        </div>
      ) : (
        <ChartCanvas
          data={displayedSnapshot.history}
          style={style}
          indicators={indicators}
          resetKey={resetKey}
        />
      )}
    </div>
  );
}

function ControlButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${active ? "bg-[var(--primary)] text-white" : "text-[var(--ink-subtle)] hover:bg-[var(--surface-3)] hover:text-[var(--ink)]"}`}
    >
      {children}
    </button>
  );
}

function ChartCanvas({ data, style, indicators, resetKey }: { data: PricePoint[]; style: ChartStyle; indicators: Set<Indicator>; resetKey: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const points = useMemo(() => normalizePoints(data), [data]);
  useEffect(() => {
    const container = containerRef.current;
    if (!container || points.length < 2) return;
    const positive = points.at(-1)!.close >= points[0].close;
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 410,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8a8f98", attributionLogo: true, fontFamily: "var(--font-mono)", fontSize: 11 },
      grid: { vertLines: { color: "rgba(52,52,58,.32)" }, horzLines: { color: "rgba(52,52,58,.32)" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#34343a", scaleMargins: { top: 0.08, bottom: indicators.has("volume") ? 0.25 : 0.08 } },
      timeScale: { borderColor: "#34343a", timeVisible: true, secondsVisible: false, rightOffset: 4 },
    });
    if (style === "candles" && points.every(hasOhlc)) {
      const series = chart.addSeries(CandlestickSeries, { upColor: "#2fbf71", downColor: "#eb5757", borderVisible: false, wickUpColor: "#2fbf71", wickDownColor: "#eb5757" });
      series.setData(points.map((point) => ({ time: point.time, open: point.open, high: point.high, low: point.low, close: point.close } satisfies CandlestickData<UTCTimestamp>)));
    } else {
      const color = positive ? "#2fbf71" : "#eb5757";
      const series = chart.addSeries(AreaSeries, { lineColor: color, lineWidth: 2, topColor: positive ? "rgba(47,191,113,.25)" : "rgba(235,87,87,.25)", bottomColor: "rgba(15,16,17,0)" });
      series.setData(points.map(({ time, close: value }) => ({ time, value })));
    }
    if (indicators.has("volume")) {
      const volume = chart.addSeries(HistogramSeries, { priceScaleId: "volume", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      volume.setData(points.map((point, index) => ({ time: point.time, value: point.volume ?? 0, color: index === 0 || point.close >= points[index - 1].close ? "rgba(47,191,113,.38)" : "rgba(235,87,87,.38)" } satisfies HistogramData<UTCTimestamp>)));
    }
    addStudy(chart, points, indicators);
    chart.timeScale().fitContent();
    const observer = new ResizeObserver(([entry]) => chart.applyOptions({ width: Math.floor(entry.contentRect.width) }));
    observer.observe(container);
    return () => { observer.disconnect(); chart.remove(); };
  }, [points, style, indicators, resetKey]);

  if (points.length < 2) return <div className="empty-well mt-3 p-8 text-center text-sm">No chart history returned for this range.</div>;
  return (
    <div className="relative mt-2">
      <div className="pointer-events-none absolute left-2 top-2 z-10 font-mono text-[11px] text-[var(--ink-subtle)]">
        O {formatCurrency(points.at(-1)!.open)} · H {formatCurrency(points.at(-1)!.high)} · L {formatCurrency(points.at(-1)!.low)} · C {formatCurrency(points.at(-1)!.close)}
      </div>
      <div ref={containerRef} role="img" aria-label="Interactive stock chart with technical analysis" className="h-[410px] w-full" />
    </div>
  );
}

type NormalizedPoint = PricePoint & { time: UTCTimestamp };
function normalizePoints(data: PricePoint[]): NormalizedPoint[] {
  const unique = new Map<number, PricePoint>();
  for (const point of data) {
    const time = Math.floor(Date.parse(point.date) / 1000);
    if (Number.isFinite(time) && Number.isFinite(point.close)) unique.set(time, point);
  }
  return [...unique.entries()].sort(([a], [b]) => a - b).map(([time, point]) => ({ ...point, time: time as UTCTimestamp }));
}
function hasOhlc(point: NormalizedPoint): point is NormalizedPoint & Required<Pick<PricePoint, "open" | "high" | "low">> {
  return [point.open, point.high, point.low].every(Number.isFinite);
}
function movingAverage(values: number[], period: number) {
  return values.map((_, index) => index < period - 1 ? null : values.slice(index - period + 1, index + 1).reduce((sum, value) => sum + value, 0) / period);
}
function exponentialAverage(values: number[], period: number) {
  const result: number[] = []; const multiplier = 2 / (period + 1);
  values.forEach((value, index) => result.push(index === 0 ? value : value * multiplier + result[index - 1] * (1 - multiplier)));
  return result;
}
function addStudy(chart: ReturnType<typeof createChart>, points: NormalizedPoint[], indicators: Set<Indicator>) {
  const closes = points.map((point) => point.close);
  const addLine = (values: (number | null)[], color: string, width: 1 | 2 = 1, lineStyle = LineStyle.Solid) => {
    const series = chart.addSeries(LineSeries, { color, lineWidth: width, lineStyle, priceLineVisible: false, lastValueVisible: false });
    series.setData(values.flatMap((value, index) => value == null ? [] : [{ time: points[index].time, value } satisfies LineData<UTCTimestamp>]));
  };
  if (indicators.has("sma20")) addLine(movingAverage(closes, 20), "#f2c94c", 2);
  if (indicators.has("ema20")) addLine(exponentialAverage(closes, 20), "#56ccf2", 2);
  if (indicators.has("bollinger")) {
    const middle = movingAverage(closes, 20);
    const deviations = middle.map((mean, index) => mean == null ? null : Math.sqrt(closes.slice(index - 19, index + 1).reduce((sum, value) => sum + (value - mean) ** 2, 0) / 20));
    addLine(middle.map((mean, index) => mean == null ? null : mean + 2 * deviations[index]!), "#bb6bd9", 1, LineStyle.Dashed);
    addLine(middle.map((mean, index) => mean == null ? null : mean - 2 * deviations[index]!), "#bb6bd9", 1, LineStyle.Dashed);
  }
}
