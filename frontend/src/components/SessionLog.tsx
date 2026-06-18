"use client";

import { useEffect, useRef } from "react";
import type { AgentPromptEvent, WorkflowAgent } from "@/lib/types";

const AGENT_COLOR: Record<WorkflowAgent, string> = {
  executive: "var(--ds-primary)",
  narrative_analyst: "var(--ds-ink-muted)",
  signal_processing: "#7bbfa0",
  latent_state: "#85a8bf",
};

const AGENT_LABEL: Record<WorkflowAgent, string> = {
  executive: "Executive",
  narrative_analyst: "Narrative",
  signal_processing: "Signal",
  latent_state: "Latent",
};

export function SessionLog({ events }: { events: AgentPromptEvent[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "var(--ds-canvas)",
      }}
    >
      {/* Column header */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--ds-hairline)",
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          color: "var(--ds-ink-subtle)",
          flexShrink: 0,
        }}
      >
        Deliberation log
      </div>

      {/* Event list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {events.length === 0 && (
          <p
            style={{
              padding: "20px 16px",
              color: "var(--ds-ink-tertiary)",
              fontSize: "13px",
              margin: 0,
            }}
          >
            Waiting for agents...
          </p>
        )}

        {events.map((ev, i) => (
          <div
            key={i}
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--ds-hairline)",
              opacity: ev.kind === "status" ? 0.45 : 1,
            }}
          >
            {/* Meta row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "5px",
                marginBottom: "5px",
                flexWrap: "wrap",
              }}
            >
              <AgentChip agent={ev.from_agent} />
              <span
                style={{ color: "var(--ds-ink-tertiary)", fontSize: "11px" }}
              >
                →
              </span>
              <AgentChip agent={ev.to_agent} />

              {ev.ticker && (
                <span
                  style={{
                    backgroundColor: "var(--ds-surface-2)",
                    color: "var(--ds-ink-subtle)",
                    borderRadius: "4px",
                    padding: "1px 5px",
                    fontSize: "11px",
                    fontFamily: "var(--font-geist-mono, monospace)",
                  }}
                >
                  {ev.ticker}
                </span>
              )}

              {ev.round > 0 && (
                <span
                  style={{
                    backgroundColor: "var(--ds-surface-3)",
                    color: "var(--ds-ink-tertiary)",
                    borderRadius: "9999px",
                    padding: "1px 6px",
                    fontSize: "10px",
                  }}
                >
                  r{ev.round}
                </span>
              )}
            </div>

            {/* Message body */}
            <p
              style={{
                color: "var(--ds-ink-muted)",
                fontSize: "12px",
                fontFamily: "var(--font-geist-mono, monospace)",
                lineHeight: 1.55,
                margin: 0,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {ev.text}
            </p>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function AgentChip({ agent }: { agent: WorkflowAgent }) {
  return (
    <span
      style={{
        color: AGENT_COLOR[agent],
        fontSize: "11px",
        fontWeight: 500,
        fontFamily: "var(--font-geist-mono, monospace)",
        letterSpacing: "0.1px",
      }}
    >
      {AGENT_LABEL[agent]}
    </span>
  );
}
