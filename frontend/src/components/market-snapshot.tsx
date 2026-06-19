"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  AreaSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type AreaData,
  type UTCTimestamp,
} from "lightweight-charts";
import { formatCompactNumber, formatCurrency, formatDateTime } from "@/lib/formatters";
import type { MarketSnapshot } from "@/lib/types";

type MarketSnapshotProps = {
  market: MarketSnapshot | null;
  loading?: boolean;
  error?: string | null;
};

export function MarketSnapshot({ market, loading = false, error = null }: MarketSnapshotProps) {
  if (!market) {
    return (
      <section className="panel p-5">
        <PanelHeading title="Market snapshot" subtitle="Waiting for ticker data" />
        <div className="empty-well mt-4 p-6 text-sm">
          {loading ? "Loading live Yahoo Finance data…" : error ?? "Submit a ticker to load live market data."}
        </div>
      </section>
    );
  }

  const positive = market.change >= 0;

  return (
    <section className="panel p-5">
      <PanelHeading
        title="Market snapshot"
        subtitle={`${market.source} · ${formatDateTime(market.as_of)}`}
      />

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[15px] font-medium text-[var(--ink)]">
              {market.ticker}
            </span>
            <span className="truncate text-xs text-[var(--ink-subtle)]">{market.name}</span>
          </div>
          <div className="mt-1.5 display text-[40px] leading-none">
            {formatCurrency(market.price)}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium ${
            positive
              ? "bg-[color-mix(in_srgb,var(--positive)_14%,transparent)] text-[var(--positive)]"
              : "bg-[color-mix(in_srgb,var(--negative)_14%,transparent)] text-[var(--negative)]"
          }`}
        >
          {positive ? "▲" : "▼"}
          {positive ? "+" : ""}
          {formatCurrency(market.change)}
          <span className="opacity-70">
            ({positive ? "+" : ""}
            {market.change_percent.toFixed(2)}%)
          </span>
        </span>
      </div>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Volume" value={formatCompactNumber(market.volume)} />
        <Metric label="Market cap" value={formatCompactNumber(market.market_cap)} />
        <Metric
          label="52-week range"
          value={`${formatCurrency(market.fifty_two_week_low)} – ${formatCurrency(market.fifty_two_week_high)}`}
          wide
        />
      </div>
      <PriceSparkline data={market.history} />
    </section>
  );
}

function PanelHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="panel-title">{title}</h2>
      <p className="panel-sub mt-2">{subtitle}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={`inset min-h-[68px] p-3 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-subtle)]">
        {label}
      </div>
      <div
        className={`mt-2 break-words text-sm font-medium text-[var(--ink)] ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function PriceSparkline({ data }: { data: { date: string; close: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartData = useMemo(() => toChartData(data), [data]);
  const positive = chartData.length > 1 && chartData.at(-1)!.value >= chartData[0].value;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || chartData.length < 2) return;

    const lineColor = positive ? "#2fbf71" : "#eb5757";
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 224,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8a8f98",
        attributionLogo: true,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(52, 52, 58, 0.35)" },
        horzLines: { color: "rgba(52, 52, 58, 0.35)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#34343a", scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: "#34343a", timeVisible: true, secondsVisible: false },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor,
      lineWidth: 2,
      topColor: positive ? "rgba(47, 191, 113, 0.28)" : "rgba(235, 87, 87, 0.28)",
      bottomColor: "rgba(15, 16, 17, 0)",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    series.setData(chartData);
    chart.timeScale().fitContent();

    const observer = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: Math.floor(entry.contentRect.width) });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [chartData, positive]);

  if (chartData.length < 2) return null;

  const values = chartData.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <div className="inset mt-4 overflow-hidden p-3.5">
      <div className="mb-2 flex items-center justify-between text-xs text-[var(--ink-subtle)]">
        <span>Price history · interactive</span>
        <span className="font-mono">
          {formatCurrency(min)} / {formatCurrency(max)}
        </span>
      </div>
      <div ref={containerRef} role="img" aria-label="Interactive price chart" className="h-56 w-full" />
    </div>
  );
}

function toChartData(data: { date: string; close: number }[]): AreaData<UTCTimestamp>[] {
  const points = new Map<number, number>();
  for (const point of data) {
    const milliseconds = Date.parse(point.date);
    if (Number.isFinite(milliseconds) && Number.isFinite(point.close)) {
      points.set(Math.floor(milliseconds / 1000), point.close);
    }
  }
  return [...points.entries()]
    .sort(([left], [right]) => left - right)
    .map(([time, value]) => ({ time: time as UTCTimestamp, value }));
}
