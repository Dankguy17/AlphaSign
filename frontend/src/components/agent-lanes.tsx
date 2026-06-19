"use client";

import { AGENTS, AgentId, AgentMessage, relativeTime } from "@/lib/alphasign";

type AgentLanesProps = {
  messages: AgentMessage[];
  activeAgent: AgentId | null;
  selected: AgentId | "all";
  onSelect: (agent: AgentId | "all") => void;
};

export function AgentLanes({
  messages,
  activeAgent,
  selected,
  onSelect,
}: AgentLanesProps) {
  return (
    <section className="panel p-5">
      <h2 className="panel-title">Agents</h2>
      <p className="panel-sub mt-2">Latest output per Band participant. Tap to filter.</p>

      <div className="mt-4 space-y-2.5">
        {AGENTS.map((agent) => {
          const own = messages.filter((m) => m.agent === agent.id);
          const latest = own[own.length - 1] ?? null;
          const isActive = activeAgent === agent.id;
          const isSelected = selected === agent.id;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelect(isSelected ? "all" : agent.id)}
              aria-pressed={isSelected}
              className={`inset block w-full p-3.5 text-left transition ${
                isSelected
                  ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                  : "hover:border-[var(--hairline-tertiary)]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isActive
                        ? "live-dot bg-[var(--primary)]"
                        : own.length > 0
                          ? "bg-[var(--positive)]"
                          : "bg-[var(--ink-tertiary)]"
                    }`}
                  />
                  <span className="text-[13px] font-medium text-[var(--ink)]">
                    {agent.name}
                  </span>
                </span>
                <span className="font-mono text-[11px] text-[var(--ink-subtle)]">
                  {own.length}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-[var(--ink-subtle)]">
                {latest ? latest.text : "No messages yet."}
              </p>
              <div className="mt-2 text-[11px] text-[var(--ink-tertiary)]">
                {latest ? `Last active ${relativeTime(latest.ts)}` : "Idle"}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
