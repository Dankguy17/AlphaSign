import { formatCompactNumber, formatCurrency, formatDateTime } from "@/lib/formatters";
import type { MarketSnapshot } from "@/lib/types";

type MarketSnapshotProps = {
  market: MarketSnapshot | null;
};

export function MarketSnapshot({ market }: MarketSnapshotProps) {
  if (!market) {
    return (
      <section className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm">
        <PanelHeading title="Market snapshot" subtitle="Waiting for ticker data" />
        <div className="mt-6 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          Market data will load from `GET /api/market/:ticker` once the adapter is
          available.
        </div>
      </section>
    );
  }

  const positive = market.change >= 0;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm">
      <PanelHeading
        title="Market snapshot"
        subtitle={`${market.source} as of ${formatDateTime(market.as_of)}`}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Ticker" value={market.ticker} mono />
        <Metric label="Last price" value={formatCurrency(market.price)} />
        <Metric
          label="Day move"
          value={`${positive ? "+" : ""}${formatCurrency(market.change)} (${positive ? "+" : ""}${market.change_percent.toFixed(2)}%)`}
          tone={positive ? "positive" : "negative"}
        />
        <Metric label="Volume" value={formatCompactNumber(market.volume)} />
        <Metric label="Market cap" value={formatCompactNumber(market.market_cap)} />
        <Metric
          label="52-week range"
          value={`${formatCurrency(market.fifty_two_week_low)} - ${formatCurrency(market.fifty_two_week_high)}`}
        />
        <Metric label="Company" value={market.name} wide />
      </div>
      <PriceSparkline data={market.history} positive={positive} />
    </section>
  );
}

function PanelHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  mono,
  wide,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  mono?: boolean;
  wide?: boolean;
}) {
  const toneClass =
    tone === "positive"
      ? "text-[var(--positive)]"
      : tone === "negative"
        ? "text-[var(--negative)]"
        : "text-slate-950";

  return (
    <div
      className={`min-h-20 rounded-md border border-slate-200 bg-slate-50 p-3 ${wide ? "sm:col-span-2" : ""}`}
    >
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div
        className={`mt-2 break-words text-sm font-semibold ${toneClass} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function PriceSparkline({
  data,
  positive,
}: {
  data: { date: string; close: number }[];
  positive: boolean;
}) {
  if (data.length < 2) return null;
  const width = 720;
  const height = 180;
  const values = data.map((point) => point.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = data.map((point, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((point.close - min) / range) * (height - 24) - 12;
    return `${x},${y}`;
  });

  return (
    <div className="mt-4 h-56 rounded-md border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
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
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={positive ? "var(--alpha-700)" : "var(--negative)"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
