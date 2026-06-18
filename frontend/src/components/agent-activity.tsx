import { formatDateTime, titleCase } from "@/lib/formatters";
import type { AgentEvent, SessionState } from "@/lib/types";

type AgentActivityProps = {
  events: AgentEvent[];
  session: SessionState | null;
  streamState: string;
};

export function AgentActivity({ events, session, streamState }: AgentActivityProps) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">Band activity</h2>
          <p className="text-xs text-slate-500">
            SSE stream: <span className="font-mono">{streamState}</span>
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {session?.status ?? "idle"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(session?.agents ?? defaultAgents).map((agent) => (
          <div
            key={agent.id}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
          >
            <span className="text-xs font-medium text-slate-700">{agent.name}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${statusColor(agent.status)}`} />
          </div>
        ))}
      </div>

      <div className="mt-4 max-h-96 overflow-auto rounded-md border border-slate-200">
        {events.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            Agent events will appear here from
            `GET /api/sessions/:session_id/events`.
          </div>
        ) : (
          <ol className="divide-y divide-slate-200">
            {events
              .slice()
              .reverse()
              .map((event) => (
                <li key={event.id} className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[var(--alpha-50)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--alpha-900)]">
                      {titleCase(event.agent)}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(event.timestamp)}
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900">
                    {event.title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{event.message}</p>
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
  if (status === "working") return "bg-[var(--alpha-600)]";
  if (status === "done") return "bg-[var(--positive)]";
  if (status === "error") return "bg-[var(--negative)]";
  return "bg-slate-300";
}
