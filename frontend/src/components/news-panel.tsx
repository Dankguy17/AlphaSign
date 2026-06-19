import { formatDateTime, titleCase } from "@/lib/formatters";
import type { ReportPayload } from "@/lib/types";

type NewsPanelProps = {
  report: ReportPayload | null;
};

export function NewsPanel({ report }: NewsPanelProps) {
  const news = report?.news ?? [];

  return (
    <section className="panel p-5">
      <div>
        <h2 className="panel-title">News &amp; narrative</h2>
        <p className="panel-sub mt-1.5">Backend-provided headlines and themes.</p>
      </div>
      {news.length === 0 ? (
        <div className="empty-well mt-4 p-6 text-sm">
          News items will appear when the adapter includes report news payloads.
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {news.map((item, index) => (
            <li key={item.id ?? `${item.headline}-${index}`} className="inset p-3.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-subtle)]">
                <span className="text-[var(--ink-muted)]">{item.source ?? "Unknown source"}</span>
                <span aria-hidden>·</span>
                <span>{formatDateTime(item.published_at)}</span>
                {item.sentiment ? (
                  <span className={`rounded-md px-1.5 py-0.5 ${sentimentClass(item.sentiment)}`}>
                    {item.sentiment}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-2 text-[13px] font-medium leading-6 text-[var(--ink)]">
                {item.headline}
              </h3>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--ink-subtle)]">
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
  if (sentiment === "positive")
    return "bg-[color-mix(in_srgb,var(--positive)_16%,transparent)] text-[var(--positive)]";
  if (sentiment === "negative")
    return "bg-[color-mix(in_srgb,var(--negative)_16%,transparent)] text-[var(--negative)]";
  if (sentiment === "mixed")
    return "bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning)]";
  return "bg-[var(--surface-3)] text-[var(--ink-muted)]";
}
