import { formatDateTime, titleCase } from "@/lib/formatters";
import type { AgentEvent, SessionState } from "@/lib/types";

type AgentActivityProps = {
  events: AgentEvent[];
  session: SessionState | null;
  streamState: string;
};

export function AgentActivity({ events, session, streamState }: AgentActivityProps) {
  return (
    <section className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">Band activity</h2>
          <p className="panel-sub mt-1.5">
            SSE stream · <span className="font-mono text-[var(--ink-muted)]">{streamState}</span>
          </p>
        </div>
        <span className="chip capitalize">{session?.status ?? "idle"}</span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(session?.agents ?? defaultAgents).map((agent) => (
          <div
            key={agent.id}
            className="inset flex items-center justify-between px-3 py-2"
          >
            <span className="text-xs font-medium text-[var(--ink-muted)]">{agent.name}</span>
            <span
              className={`h-2 w-2 rounded-full ${statusColor(agent.status)} ${agent.status === "working" ? "live-dot" : ""}`}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 max-h-96 overflow-auto rounded-md border border-[var(--hairline)]">
        {events.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ink-subtle)]">
            Agent events will appear here from{" "}
            <span className="font-mono">GET /api/sessions/:id/events</span>.
          </div>
        ) : (
          <ol className="divide-y divide-[var(--hairline)]">
            {events
              .slice()
              .reverse()
              .map((event) => (
                <li key={event.id} className="p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--primary-hover)]">
                      {titleCase(event.agent)}
                    </span>
                    <span className="text-[11px] text-[var(--ink-tertiary)]">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>
                  <div className="mt-2 text-[13px] font-medium text-[var(--ink)]">
                    {event.title}
                  </div>
                  <p className="mt-1 text-[13px] leading-6 text-[var(--ink-subtle)]">
                    {event.message}
                  </p>
                </li>
              ))}
          </ol>
        )}
      </div>
    </section>
  );
}

const defaultAgents = [
  { id: "narrative_analyst", name: "Narrative Analyst", status: "idle" },
  { id: "signal_processing", name: "Signal Processing", status: "idle" },
  { id: "latent_state", name: "Latent State", status: "idle" },
  { id: "executive", name: "Executive", status: "idle" },
  { id: "frontend_observer", name: "Frontend Observer", status: "idle" },
] as const;

function statusColor(status: string) {
  if (status === "working") return "bg-[var(--primary)]";
  if (status === "done") return "bg-[var(--positive)]";
  if (status === "error") return "bg-[var(--negative)]";
  return "bg-[var(--ink-tertiary)]";
}
