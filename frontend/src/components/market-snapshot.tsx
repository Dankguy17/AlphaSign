import { formatCompactNumber, formatCurrency, formatDateTime } from "@/lib/formatters";
import type { MarketSnapshot } from "@/lib/types";

type MarketSnapshotProps = {
  market: MarketSnapshot | null;
};

export function MarketSnapshot({ market }: MarketSnapshotProps) {
  if (!market) {
    return (
      <section className="panel p-5">
        <PanelHeading title="Market snapshot" subtitle="Waiting for ticker data" />
        <div className="empty-well mt-4 p-6 text-sm">
          Market data loads from <span className="font-mono">GET /api/market/:ticker</span> once
          the adapter is available.
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
  if (data.length < 2) return null;
  const width = 720;
  const height = 180;
  const values = data.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((point.close - min) / range) * (height - 24) - 12;
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <div className="inset mt-4 p-3.5">
      <div className="mb-2 flex items-center justify-between text-xs text-[var(--ink-subtle)]">
        <span>Price history</span>
        <span className="font-mono">
          {formatCurrency(min)} / {formatCurrency(max)}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Price chart"
        className="h-44 w-full"
        preserveAspectRatio="none"
      >
        <polygon points={area} fill="var(--primary-soft)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
