import type { MarketSnapshot, ReportPayload } from "@/lib/types";

type SignalChartsProps = {
  market: MarketSnapshot | null;
  report: ReportPayload | null;
};

const metricLabels = [
  ["return", "Return"],
  ["volatility", "Volatility"],
  ["beta", "Beta"],
  ["idiosyncratic_volatility", "Idio vol"],
  ["sentiment", "Sentiment"],
  ["confidence", "Confidence"],
] as const;

export function SignalCharts({ market, report }: SignalChartsProps) {
  const signals = report?.signals ?? {};
  const hasSignals = Object.keys(signals).length > 0;

  return (
    <section className="panel p-5">
      <div>
        <h2 className="panel-title">Signals &amp; confidence</h2>
        <p className="panel-sub mt-1.5">Quantitative indicators supplied by the final report.</p>
      </div>
      {!hasSignals ? (
        <div className="empty-well mt-4 p-6 text-sm">
          Signal metrics will populate after the executive report is available.
        </div>
      ) : (
        <div className="mt-4 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3.5">
            {metricLabels.map(([key, label]) => {
              const value = signals[key];
              if (typeof value !== "number") return null;
              const normalized = normalizeMetric(key, value);
              return (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--ink-subtle)]">{label}</span>
                    <span className="font-mono text-[var(--ink)]">{value.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${normalized}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <ConfidenceGauge confidence={report?.recommendation?.confidence ?? 0} />
        </div>
      )}
      {market ? (
        <div className="mt-4 text-[11px] text-[var(--ink-tertiary)]">
          Market context: {market.ticker} sourced from {market.source}.
        </div>
      ) : null}
    </section>
  );
}

function ConfidenceGauge({ confidence }: { confidence: number }) {
  const value = Math.max(0, Math.min(1, confidence));
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="inset flex min-h-44 items-center justify-center">
      <svg viewBox="0 0 120 120" className="h-36 w-36" role="img" aria-label="Confidence">
        <circle cx="60" cy="60" r="42" fill="none" stroke="var(--surface-3)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke="var(--primary)"
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={`${circumference * value} ${circumference}`}
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="59"
          textAnchor="middle"
          className="fill-[var(--ink)] text-[22px] font-semibold"
          style={{ letterSpacing: "-0.04em" }}
        >
          {Math.round(value * 100)}
        </text>
        <text
          x="60"
          y="77"
          textAnchor="middle"
          className="fill-[var(--ink-subtle)] text-[10px] font-medium uppercase"
          style={{ letterSpacing: "0.4px" }}
        >
          confidence
        </text>
      </svg>
    </div>
  );
}

function normalizeMetric(key: string, value: number) {
  if (key === "sentiment" || key === "confidence") return Math.max(0, Math.min(100, value * 100));
  if (key === "beta") return Math.max(0, Math.min(100, (value / 3) * 100));
  return Math.max(0, Math.min(100, Math.abs(value)));
}
