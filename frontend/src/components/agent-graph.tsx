import type { AgentEvent, SessionState } from "@/lib/types";

type AgentGraphProps = {
  events: AgentEvent[];
  session: SessionState | null;
};

const nodePositions = {
  narrative_analyst: { x: 60, y: 44, label: "Narrative" },
  signal_processing: { x: 260, y: 44, label: "Signals" },
  latent_state: { x: 460, y: 44, label: "Latent" },
  executive: { x: 660, y: 44, label: "Executive" },
  frontend_observer: { x: 360, y: 164, label: "Observer" },
  system: { x: 60, y: 164, label: "System" },
};

export function AgentGraph({ events, session }: AgentGraphProps) {
  const agents = session?.agents ?? [];
  const edges = events.filter((event) => event.target_agent && event.agent !== "system");

  return (
    <section className="rounded-lg border border-[var(--border)] bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-950">Agent workflow</h2>
        <p className="text-xs text-slate-500">
          Request and findings flow across Band participants.
        </p>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
        <svg
          viewBox="0 0 760 240"
          role="img"
          aria-label="Agent collaboration graph"
          className="h-64 w-full"
        >
          {edges.slice(-12).map((event, index) => {
            const from = nodePositions[event.agent] ?? nodePositions.system;
            const targetKey = String(event.target_agent) as keyof typeof nodePositions;
            const to = nodePositions[targetKey] ?? nodePositions.frontend_observer;
            return (
              <line
                key={`${event.id}-${index}`}
                x1={from.x + 70}
                y1={from.y + 28}
                x2={to.x}
                y2={to.y + 28}
                stroke="var(--alpha-300)"
                strokeWidth={2}
                strokeDasharray={event.type === "request_packet" ? "5 5" : "0"}
              />
            );
          })}
          {Object.entries(nodePositions).map(([id, node]) => {
            const status =
              agents.find((agent) => agent.id === id)?.status ??
              (id === "system" ? "done" : "idle");
            return (
              <g key={id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width="140"
                  height="56"
                  rx="8"
                  fill={nodeFill(status)}
                  stroke={nodeStroke(status)}
                />
                <text
                  x={node.x + 70}
                  y={node.y + 31}
                  textAnchor="middle"
                  className="fill-slate-900 text-[13px] font-semibold"
                >
                  {node.label}
                </text>
                <circle
                  cx={node.x + 122}
                  cy={node.y + 18}
                  r="5"
                  fill={nodeStroke(status)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function nodeFill(status: string) {
  if (status === "working") return "var(--alpha-50)";
  if (status === "done") return "#f0fdf4";
  if (status === "error") return "#fef2f2";
  return "#ffffff";
}

function nodeStroke(status: string) {
  if (status === "working") return "var(--alpha-700)";
  if (status === "done") return "var(--positive)";
  if (status === "error") return "var(--negative)";
  return "#cbd5e1";
}
