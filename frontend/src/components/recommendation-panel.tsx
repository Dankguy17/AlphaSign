import type { ReportPayload } from "@/lib/types";

type RecommendationPanelProps = {
  report: ReportPayload | null;
};

export function RecommendationPanel({ report }: RecommendationPanelProps) {
  const recommendation = report?.recommendation;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">Recommendation</h2>
        <p className="text-xs text-slate-500">Informational analysis only.</p>
      </div>

      {!recommendation ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          Pending executive recommendation or insufficient evidence.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-md px-3 py-1.5 text-sm font-bold uppercase ${actionClass(
                recommendation.action,
              )}`}
            >
              {recommendation.action}
            </span>
            <span className="font-mono text-sm text-slate-700">
              {Math.round(recommendation.confidence * 100)}% confidence
            </span>
            {recommendation.time_horizon ? (
              <span className="text-sm text-slate-500">
                Horizon: {recommendation.time_horizon}
              </span>
            ) : null}
          </div>
          <ul className="space-y-2">
            {recommendation.rationale.map((item) => (
              <li key={item} className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                {item}
              </li>
            ))}
          </ul>
          <p className="text-xs leading-5 text-slate-500">
            AlphaSign output is not financial advice. Validate all signals, sources,
            liquidity, and suitability before making investment decisions.
          </p>
        </div>
      )}
    </section>
  );
}

function actionClass(action: string) {
  if (action === "buy") return "bg-green-100 text-green-800";
  if (action === "sell" || action === "avoid") return "bg-red-100 text-red-800";
  if (action === "watch") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}
