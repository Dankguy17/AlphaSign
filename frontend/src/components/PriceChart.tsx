"use client";

import { useEffect, useState } from "react";
import { fetchChartData } from "@/lib/api";
import type { ChartData, PricePoint } from "@/lib/types";

/* Paper palette — the only colored surface in the app */
const P = {
  bg: "#f8f5ef",
  ink: "#2d2825",
  grid: "#ddd8ce",
  muted: "#9e9890",
  lavender: "#5e6ad2",
  danger: "#b03a2e",
} as const;

const W = 560;
const H = 260;
const PAD = { top: 14, right: 20, bottom: 30, left: 54 };
const IW = W - PAD.left - PAD.right;
const IH = H - PAD.top - PAD.bottom;

export function PriceChart({
  ticker,
  window: win = "6M",
}: {
  ticker: string;
  window?: string;
}) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchChartData(ticker, win).then((d) => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [ticker, win]);

  return (
    <div
      style={{
        backgroundColor: P.bg,
        border: "1px solid #e4ddd3",
        borderRadius: "16px",
        padding: "20px 24px 16px",
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span
          style={{
            fontSize: "15px",
            fontWeight: 500,
            color: P.ink,
            letterSpacing: "-0.2px",
          }}
        >
          {ticker}
        </span>
        <span style={{ fontSize: "12px", color: P.muted }}>{win}</span>

        {data?.kalman?.structural_regime_shift && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: "10px",
              fontWeight: 500,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              color: P.danger,
              border: `1px solid ${P.danger}`,
              borderRadius: "4px",
              padding: "1px 5px",
              opacity: 0.85,
            }}
          >
            Regime shift
          </span>
        )}

        {data?.kalman && (
          <span
            style={{
              marginLeft: data?.kalman?.structural_regime_shift ? "0" : "auto",
              fontSize: "11px",
              color: P.muted,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            slope{" "}
            <span style={{ color: P.lavender }}>
              {data.kalman.kalman_trend_slope >= 0 ? "+" : ""}
              {data.kalman.kalman_trend_slope.toFixed(3)}
            </span>
          </span>
        )}
      </div>

      {/* Chart area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {loading && (
          <div
            style={{
              height: "200px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: P.muted, fontSize: "13px" }}>
              Loading…
            </span>
          </div>
        )}

        {!loading && !data && (
          <div
            style={{
              height: "200px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: P.muted, fontSize: "13px" }}>
              Price data unavailable
            </span>
          </div>
        )}

        {!loading && data && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ display: "block", overflow: "visible" }}
          >
            <ChartInner prices={data.prices} kalman={data.kalman} />
          </svg>
        )}
      </div>

      {/* Legend */}
      {data && (
        <div
          style={{
            display: "flex",
            gap: "14px",
            marginTop: "10px",
          }}
        >
          <LegendLine color={P.ink} label="Close" dashed={false} />
          <LegendLine color={P.lavender} label="Kalman" dashed={true} />
        </div>
      )}
    </div>
  );
}

/* ── Inner SVG ── */

function ChartInner({
  prices,
  kalman,
}: {
  prices: PricePoint[];
  kalman?: ChartData["kalman"];
}) {
  if (!prices.length) return null;

  const closes = prices.map((p) => p.close);
  const minC = Math.min(...closes);
  const maxC = Math.max(...closes);
  const range = maxC - minC || 1;

  const sx = (i: number) => (i / Math.max(prices.length - 1, 1)) * IW;
  const sy = (v: number) => IH - ((v - minC) / range) * IH;

  // Price path
  const pricePath = prices
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(i).toFixed(1)},${sy(p.close).toFixed(1)}`)
    .join(" ");

  // Kalman trend line: extend from (filtered_level - slope*n/2) to (filtered_level + slope*n/2)
  let kalmanEl: React.ReactNode = null;
  if (kalman) {
    const { filtered_level: fl, kalman_trend_slope: ks } = kalman;
    if (fl !== undefined && ks !== undefined) {
      const half = prices.length / 2;
      const y0 = sy(fl - ks * half);
      const yn = sy(fl + ks * half);
      kalmanEl = (
        <line
          x1={sx(0).toFixed(1)}
          y1={y0.toFixed(1)}
          x2={sx(prices.length - 1).toFixed(1)}
          y2={yn.toFixed(1)}
          stroke={P.lavender}
          strokeWidth={2}
          strokeDasharray="5 3"
          opacity={0.85}
        />
      );
    }
  }

  // Regime-shift vertical at last bar
  const regimeX =
    kalman?.structural_regime_shift ? sx(prices.length - 1) : null;

  // Y-axis ticks (4 evenly spaced)
  const yTicks = [0, 1 / 3, 2 / 3, 1].map((t) => minC + t * range);

  // X-axis ticks (first, mid, last)
  const xIdxs = [0, Math.floor(prices.length / 2), prices.length - 1];

  return (
    <g transform={`translate(${PAD.left},${PAD.top})`}>
      {/* Grid */}
      {yTicks.map((v, i) => (
        <line
          key={i}
          x1={0}
          y1={sy(v).toFixed(1)}
          x2={IW}
          y2={sy(v).toFixed(1)}
          stroke={P.grid}
          strokeWidth={1}
        />
      ))}

      {/* Y labels */}
      {yTicks.map((v, i) => (
        <text
          key={i}
          x={-6}
          y={sy(v) + 4}
          textAnchor="end"
          fill={P.muted}
          fontSize={9.5}
          fontFamily="ui-monospace, monospace"
        >
          {v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}
        </text>
      ))}

      {/* X labels */}
      {xIdxs.map((idx, i) => (
        <text
          key={i}
          x={sx(idx).toFixed(1)}
          y={IH + 20}
          textAnchor="middle"
          fill={P.muted}
          fontSize={9.5}
          fontFamily="ui-monospace, monospace"
        >
          {prices[idx].date.slice(5)}
        </text>
      ))}

      {/* Regime indicator */}
      {regimeX !== null && (
        <line
          x1={regimeX!.toFixed(1)}
          y1={0}
          x2={regimeX!.toFixed(1)}
          y2={IH}
          stroke={P.danger}
          strokeWidth={1}
          strokeDasharray="4 3"
          opacity={0.6}
        />
      )}

      {/* Price series */}
      <path
        d={pricePath}
        fill="none"
        stroke={P.ink}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Kalman overlay */}
      {kalmanEl}
    </g>
  );
}

function LegendLine({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      <svg width="18" height="8">
        <line
          x1={1}
          y1={4}
          x2={17}
          y2={4}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray={dashed ? "4 2" : undefined}
        />
      </svg>
      <span style={{ fontSize: "10px", color: P.muted }}>{label}</span>
    </div>
  );
}
