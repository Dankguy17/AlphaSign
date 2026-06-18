import { formatDateTime, titleCase } from "@/lib/formatters";
import type { ReportPayload } from "@/lib/types";

type NewsPanelProps = {
  report: ReportPayload | null;
};

export function NewsPanel({ report }: NewsPanelProps) {
  const news = report?.news ?? [];

  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">News and narrative</h2>
        <p className="text-xs text-slate-500">Backend-provided headlines and themes.</p>
      </div>
      {news.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          News items will appear when the adapter includes report news payloads.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {news.map((item, index) => (
            <li
              key={item.id ?? `${item.headline}-${index}`}
              className="rounded-md border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{item.source ?? "Unknown source"}</span>
                <span>{formatDateTime(item.published_at)}</span>
                {item.sentiment ? (
                  <span className={`rounded px-1.5 py-0.5 ${sentimentClass(item.sentiment)}`}>
                    {item.sentiment}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 text-sm font-semibold leading-6 text-slate-900">
                {item.headline}
              </h3>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                {item.reliability ? <span>Reliability: {item.reliability}</span> : null}
                {typeof item.relevance === "number" ? (
                  <span>Relevance: {Math.round(item.relevance * 100)}%</span>
                ) : null}
                {item.related_agent ? <span>{titleCase(String(item.related_agent))}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function sentimentClass(sentiment: string) {
  if (sentiment === "positive") return "bg-green-100 text-green-800";
  if (sentiment === "negative") return "bg-red-100 text-red-800";
  if (sentiment === "mixed") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}
