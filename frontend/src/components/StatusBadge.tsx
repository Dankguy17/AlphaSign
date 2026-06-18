"use client";

import type { SessionStatus } from "@/lib/types";

type AnyStatus = SessionStatus | "idle";

const CONFIG: Record<AnyStatus, { label: string; color: string }> = {
  idle: { label: "idle", color: "var(--ds-ink-tertiary)" },
  queued: { label: "queued", color: "var(--ds-ink-subtle)" },
  running: { label: "running", color: "var(--ds-primary)" },
  complete: { label: "complete", color: "var(--ds-success)" },
  failed: { label: "failed", color: "#e05252" },
};

export function StatusBadge({ status }: { status: AnyStatus }) {
  const { label, color } = CONFIG[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        backgroundColor: "var(--ds-surface-2)",
        color,
        borderRadius: "9999px",
        padding: "2px 8px",
        fontSize: "12px",
        fontWeight: 400,
        lineHeight: 1.4,
      }}
    >
      {status === "running" && (
        <span
          style={{
            width: "5px",
            height: "5px",
            borderRadius: "50%",
            backgroundColor: color,
            animation: "pulse 1.4s ease-in-out infinite",
          }}
        />
      )}
      {label}
    </span>
  );
}
