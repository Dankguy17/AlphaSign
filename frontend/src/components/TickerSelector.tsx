"use client";

import { useState } from "react";

const PRESET_TICKERS = [
  "AAPL", "MSFT", "GOOGL", "NVDA",
  "TSLA", "META", "AMZN", "NFLX",
];

interface Props {
  onSubmit: (tickers: string[], maxDeliberations: number) => void;
  disabled?: boolean;
}

export function TickerSelector({ onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set(["MSFT"]));
  const [custom, setCustom] = useState("");
  const [maxDel, setMaxDel] = useState(2);

  const toggle = (t: string) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  const handleSubmit = () => {
    const customList = custom
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);
    const all = [...selected, ...customList];
    if (all.length > 0) onSubmit(all, maxDel);
  };

  const isReady = selected.size > 0 || custom.trim().length > 0;

  return (
    <div
      style={{
        backgroundColor: "var(--ds-surface-1)",
        border: "1px solid var(--ds-hairline)",
        borderRadius: "12px",
        padding: "32px",
        width: "100%",
        maxWidth: "460px",
      }}
    >
      {/* Title */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontSize: "22px",
            fontWeight: 500,
            color: "var(--ds-ink)",
            letterSpacing: "-0.4px",
            margin: 0,
          }}
        >
          AlphaSign
        </h1>
        <p
          style={{
            fontSize: "14px",
            color: "var(--ds-ink-subtle)",
            margin: "6px 0 0",
          }}
        >
          Multi-agent financial risk intelligence
        </p>
      </div>

      {/* Section label */}
      <p
        style={{
          fontSize: "11px",
          fontWeight: 500,
          letterSpacing: "0.4px",
          textTransform: "uppercase",
          color: "var(--ds-ink-subtle)",
          margin: "0 0 8px",
        }}
      >
        Tickers
      </p>

      {/* Checkbox grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px",
          marginBottom: "12px",
        }}
      >
        {PRESET_TICKERS.map((t) => {
          const checked = selected.has(t);
          return (
            <label
              key={t}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: `1px solid ${checked ? "var(--ds-primary)" : "var(--ds-hairline)"}`,
                backgroundColor: checked
                  ? "rgba(94,106,210,0.07)"
                  : "var(--ds-canvas)",
                cursor: "pointer",
                userSelect: "none",
                color: checked ? "var(--ds-ink)" : "var(--ds-ink-muted)",
                fontSize: "13px",
                fontWeight: 500,
                transition: "border-color 0.1s, background-color 0.1s",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(t)}
                style={{
                  accentColor: "var(--ds-primary)",
                  width: "13px",
                  height: "13px",
                  cursor: "pointer",
                }}
              />
              {t}
            </label>
          );
        })}
      </div>

      {/* Custom input */}
      <input
        type="text"
        placeholder="Add custom tickers: PLTR, ARM, ..."
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && isReady && !disabled && handleSubmit()}
        style={{
          width: "100%",
          backgroundColor: "var(--ds-surface-1)",
          border: "1px solid var(--ds-hairline-strong)",
          borderRadius: "8px",
          padding: "8px 12px",
          color: "var(--ds-ink)",
          fontSize: "14px",
          outline: "none",
          boxSizing: "border-box",
          marginBottom: "16px",
        }}
      />

      {/* Deliberations stepper */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <span style={{ fontSize: "13px", color: "var(--ds-ink-muted)", display: "block" }}>
            Deliberation rounds
          </span>
          <span style={{ fontSize: "11px", color: "var(--ds-ink-tertiary)" }}>
            More rounds = deeper analysis
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {([-1, 1] as const).map((delta) => (
            <button
              key={delta}
              onClick={() => setMaxDel((d) => Math.min(5, Math.max(1, d + delta)))}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "1px solid var(--ds-hairline)",
                backgroundColor: "var(--ds-surface-2)",
                color: "var(--ds-ink-muted)",
                cursor: "pointer",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              {delta < 0 ? "−" : "+"}
            </button>
          ))}
          <span
            style={{
              color: "var(--ds-ink)",
              fontWeight: 500,
              minWidth: "18px",
              textAlign: "center",
              fontSize: "15px",
            }}
          >
            {maxDel}
          </span>
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={disabled || !isReady}
        style={{
          width: "100%",
          backgroundColor:
            disabled || !isReady ? "var(--ds-surface-2)" : "var(--ds-primary)",
          color: "#ffffff",
          border: "none",
          borderRadius: "8px",
          padding: "10px 14px",
          fontSize: "14px",
          fontWeight: 500,
          cursor: disabled || !isReady ? "not-allowed" : "pointer",
          opacity: disabled || !isReady ? 0.45 : 1,
          letterSpacing: "0px",
        }}
      >
        Analyze →
      </button>
    </div>
  );
}
