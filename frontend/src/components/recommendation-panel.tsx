import type { ReportPayload } from "@/lib/types";

type RecommendationPanelProps = {
  report: ReportPayload | null;
};

export function RecommendationPanel({ report }: RecommendationPanelProps) {
  const recommendation = report?.recommendation;

  return (
    <section className="panel p-5">
      <div>
        <h2 className="panel-title">Recommendation</h2>
        <p className="panel-sub mt-1.5">Informational analysis only.</p>
      </div>

      {!recommendation ? (
        <div className="empty-well mt-4 p-6 text-sm">
          Pending executive recommendation or insufficient evidence.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`rounded-md px-3 py-1.5 text-sm font-semibold uppercase tracking-wide ${actionClass(
                recommendation.action,
              )}`}
            >
              {recommendation.action}
            </span>
            <span className="font-mono text-sm text-[var(--ink-muted)]">
              {Math.round(recommendation.confidence * 100)}% confidence
            </span>
            {recommendation.time_horizon ? (
              <span className="text-sm text-[var(--ink-subtle)]">
                Horizon: {recommendation.time_horizon}
              </span>
            ) : null}
          </div>
          <ul className="space-y-2">
            {recommendation.rationale.map((item) => (
              <li
                key={item}
                className="inset border-l-2 border-l-[var(--primary)] p-3 text-[13px] leading-6 text-[var(--ink-muted)]"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-5 text-[var(--ink-tertiary)]">
            AlphaSign output is not financial advice. Validate all signals, sources, liquidity,
            and suitability before making investment decisions.
          </p>
        </div>
      )}
    </section>
  );
}

function actionClass(action: string) {
  if (action === "buy")
    return "bg-[color-mix(in_srgb,var(--positive)_18%,transparent)] text-[var(--positive)]";
  if (action === "sell" || action === "avoid")
    return "bg-[color-mix(in_srgb,var(--negative)_18%,transparent)] text-[var(--negative)]";
  if (action === "watch")
    return "bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]";
  return "bg-[var(--surface-3)] text-[var(--ink-muted)]";
}
