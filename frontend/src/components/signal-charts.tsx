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
    <section className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">Signals and confidence</h2>
        <p className="text-xs text-slate-500">
          Quantitative indicators supplied by the final report.
        </p>
      </div>
      {!hasSignals ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          Signal metrics will populate after the executive report is available.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3">
            {metricLabels.map(([key, label]) => {
              const value = signals[key];
              if (typeof value !== "number") return null;
              const normalized = normalizeMetric(key, value);
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{label}</span>
                    <span className="font-mono text-slate-900">{value.toFixed(2)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-[var(--alpha-700)]"
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
        <div className="mt-4 text-xs text-slate-500">
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
    <div className="flex min-h-44 items-center justify-center rounded-md border border-slate-200 bg-slate-50">
      <svg viewBox="0 0 120 120" className="h-36 w-36" role="img" aria-label="Confidence">
        <circle
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
        />
        <circle
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke="var(--alpha-700)"
          strokeLinecap="round"
          strokeWidth="12"
          strokeDasharray={`${circumference * value} ${circumference}`}
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="58"
          textAnchor="middle"
          className="fill-slate-950 text-xl font-bold"
        >
          {Math.round(value * 100)}
        </text>
        <text
          x="60"
          y="77"
          textAnchor="middle"
          className="fill-slate-500 text-[10px] font-medium"
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
