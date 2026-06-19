"use client";

import { AGENTS, AgentId, AgentMessage } from "@/lib/alphasign";

type AgentGraphProps = {
  messages: AgentMessage[];
  reportReady: boolean;
  activeAgent: AgentId | null;
  selected: AgentId | "all";
  onSelect: (agent: AgentId | "all") => void;
};

const NODE = { w: 168, h: 60 };
const POS: Record<AgentId, { x: number; y: number }> = {
  narrative_analyst: { x: 36, y: 60 },
  signal_processing: { x: 296, y: 60 },
  latent_state: { x: 556, y: 60 },
};
const REPORT = { x: 296, y: 178, w: 168, h: 50 };

export function AgentGraph({
  messages,
  reportReady,
  activeAgent,
  selected,
  onSelect,
}: AgentGraphProps) {
  const counts = AGENTS.reduce<Record<string, number>>((acc, agent) => {
    acc[agent.id] = messages.filter((m) => m.agent === agent.id).length;
    return acc;
  }, {});

  return (
    <section className="panel agent-workflow-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">Agent workflow</h2>
          <p className="panel-sub mt-2">
            Narrative → Signals → Latent, looping through the Band room.
          </p>
        </div>
        <span className="chip">{messages.length} messages</span>
      </div>

      <div className="agent-workflow-canvas mt-4 overflow-hidden">
        <svg
          viewBox="0 0 760 256"
          role="img"
          aria-label="Agent collaboration loop"
          className="h-64 w-full"
        >
          <defs>
            <radialGradient id="workflow-glow" cx="50%" cy="42%" r="65%">
              <stop offset="0" stopColor="var(--primary)" stopOpacity=".12" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="node-surface" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#202126" />
              <stop offset="1" stopColor="#16171a" />
            </linearGradient>
            <filter id="active-glow" x="-40%" y="-70%" width="180%" height="240%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feFlood floodColor="var(--primary)" floodOpacity=".28" />
              <feComposite in2="blur" operator="in" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--primary)" />
            </marker>
            <marker
              id="arrow-muted"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--hairline-tertiary)" />
            </marker>
          </defs>

          <rect width="760" height="256" fill="url(#workflow-glow)" />

          {/* Forward edges */}
          <line
            x1={POS.narrative_analyst.x + NODE.w}
            y1={POS.narrative_analyst.y + NODE.h / 2}
            x2={POS.signal_processing.x - 6}
            y2={POS.signal_processing.y + NODE.h / 2}
            stroke="var(--primary-line)"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
            className="workflow-route"
          />
          <line
            x1={POS.signal_processing.x + NODE.w}
            y1={POS.signal_processing.y + NODE.h / 2}
            x2={POS.latent_state.x - 6}
            y2={POS.latent_state.y + NODE.h / 2}
            stroke="var(--primary-line)"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
            className="workflow-route workflow-route--delay"
          />
          {/* Return loop: Latent → Narrative, arcing over the top */}
          <path
            d={`M ${POS.latent_state.x + NODE.w / 2} ${POS.latent_state.y}
                C ${POS.latent_state.x + NODE.w / 2} 6,
                  ${POS.narrative_analyst.x + NODE.w / 2} 6,
                  ${POS.narrative_analyst.x + NODE.w / 2} ${POS.narrative_analyst.y - 4}`}
            fill="none"
            stroke="var(--primary-line)"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            markerEnd="url(#arrow)"
            className="workflow-route workflow-route--return"
          />
          {/* Latent → Report */}
          <line
            x1={POS.latent_state.x + NODE.w / 2}
            y1={POS.latent_state.y + NODE.h}
            x2={REPORT.x + REPORT.w - 20}
            y2={REPORT.y}
            stroke={reportReady ? "var(--primary-line)" : "var(--hairline)"}
            strokeWidth={1.5}
            markerEnd={reportReady ? "url(#arrow)" : "url(#arrow-muted)"}
            className={reportReady ? "workflow-route" : ""}
          />

          <g className="workflow-particles" aria-hidden="true">
            {activeAgent === "narrative_analyst" && (
              <circle r="3.5" fill="var(--primary-hover)">
                <animateMotion dur="1.8s" repeatCount="indefinite" path="M204 90 L290 90" />
              </circle>
            )}
            {activeAgent === "signal_processing" && (
              <circle r="3.5" fill="var(--primary-hover)">
                <animateMotion dur="1.8s" repeatCount="indefinite" path="M464 90 L550 90" />
              </circle>
            )}
            {activeAgent === "latent_state" && (
              <circle r="3" fill="var(--primary-hover)">
                <animateMotion dur="2.2s" repeatCount="indefinite" path="M640 120 L444 178" />
              </circle>
            )}
          </g>

          {AGENTS.map((agent) => {
            const pos = POS[agent.id];
            const isActive = activeAgent === agent.id;
            const isSelected = selected === agent.id;
            const has = counts[agent.id] > 0;
            const stroke = isActive
              ? "var(--primary)"
              : isSelected
                ? "var(--primary-focus)"
                : has
                  ? "var(--hairline-tertiary)"
                  : "var(--hairline-strong)";
            return (
              <g
                key={agent.id}
                className={`workflow-node cursor-pointer ${isActive ? "workflow-node--active" : ""}`}
                onClick={() => onSelect(isSelected ? "all" : agent.id)}
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={NODE.w}
                  height={NODE.h}
                  rx={10}
                  fill={isActive ? "var(--primary-soft)" : "url(#node-surface)"}
                  stroke={stroke}
                  strokeWidth={isActive || isSelected ? 1.6 : 1}
                  filter={isActive ? "url(#active-glow)" : undefined}
                />
                <text
                  x={pos.x + 18}
                  y={pos.y + 26}
                  className="fill-[var(--ink)] text-[13px] font-semibold"
                >
                  {agent.short}
                </text>
                <text
                  x={pos.x + 18}
                  y={pos.y + 44}
                  className="fill-[var(--ink-subtle)] text-[11px]"
                >
                  {counts[agent.id]} msg
                </text>
                <circle
                  cx={pos.x + NODE.w - 18}
                  cy={pos.y + 20}
                  r={4}
                  fill={isActive ? "var(--primary)" : has ? "var(--positive)" : "var(--ink-tertiary)"}
                  className={isActive ? "live-dot" : ""}
                />
              </g>
            );
          })}

          {/* Report terminal */}
          <rect
            x={REPORT.x}
            y={REPORT.y}
            width={REPORT.w}
            height={REPORT.h}
            rx={10}
            fill={reportReady ? "var(--primary-soft)" : "url(#node-surface)"}
            stroke={reportReady ? "var(--primary)" : "var(--hairline-strong)"}
            strokeWidth={reportReady ? 1.6 : 1}
          />
          <text
            x={REPORT.x + 18}
            y={REPORT.y + 22}
            className="fill-[var(--ink)] text-[13px] font-semibold"
          >
            Final Report
          </text>
          <text
            x={REPORT.x + 18}
            y={REPORT.y + 39}
            className="fill-[var(--ink-subtle)] text-[11px]"
          >
            {reportReady ? "ready — PDF" : "pending"}
          </text>
        </svg>
      </div>
    </section>
  );
}
