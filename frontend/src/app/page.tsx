"use client";

import { useSession } from "@/hooks/useSession";
import { PriceChart } from "@/components/PriceChart";
import { ReportDownload } from "@/components/ReportDownload";
import { SessionLog } from "@/components/SessionLog";
import { StatusBadge } from "@/components/StatusBadge";
import { TickerSelector } from "@/components/TickerSelector";

export default function Home() {
  const { status, sessionId, events, latestSignal, error, submit } =
    useSession();

  const isIdle = status === "idle";
  const isActive = status === "running" || status === "queued";

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--ds-canvas)",
        minHeight: "100vh",
      }}
    >
      {/* ── Top bar ── */}
      <header
        style={{
          height: "56px",
          borderBottom: "1px solid var(--ds-hairline)",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          gap: "10px",
          backgroundColor: "var(--ds-canvas)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--ds-primary)",
            letterSpacing: "-0.2px",
          }}
        >
          AlphaSign
        </span>

        {!isIdle && (
          <>
            <span style={{ color: "var(--ds-hairline-strong)", lineHeight: 1 }}>
              ·
            </span>
            <StatusBadge status={status} />

            {sessionId && (
              <span
                style={{
                  color: "var(--ds-ink-tertiary)",
                  fontSize: "11px",
                  fontFamily: "var(--font-geist-mono, monospace)",
                }}
              >
                {sessionId.slice(0, 8)}
              </span>
            )}
          </>
        )}

        {status === "complete" && sessionId && (
          <div style={{ marginLeft: "auto" }}>
            <ReportDownload sessionId={sessionId} />
          </div>
        )}
      </header>

      {/* ── Body ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {isIdle ? (
          /* Idle — centered selector */
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 24px",
            }}
          >
            <TickerSelector onSubmit={submit} disabled={false} />
          </div>
        ) : (
          /* Active / complete — split layout */
          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              overflow: "hidden",
            }}
          >
            {/* Left — log */}
            <div
              style={{
                borderRight: "1px solid var(--ds-hairline)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <SessionLog events={events} />
            </div>

            {/* Right — chart */}
            <div
              style={{
                padding: "24px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              {latestSignal ? (
                <PriceChart
                  ticker={latestSignal.ticker}
                  window={latestSignal.window}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px dashed var(--ds-hairline)",
                    borderRadius: "12px",
                    gap: "8px",
                  }}
                >
                  <span
                    style={{ color: "var(--ds-ink-tertiary)", fontSize: "13px" }}
                  >
                    Chart appears after signal processing
                  </span>
                  {isActive && (
                    <span
                      style={{
                        color: "var(--ds-ink-tertiary)",
                        fontSize: "11px",
                        fontFamily: "var(--font-geist-mono, monospace)",
                      }}
                    >
                      waiting for signal agent…
                    </span>
                  )}
                </div>
              )}

              {error && (
                <p
                  style={{
                    color: "#e05252",
                    fontSize: "12px",
                    margin: 0,
                    fontFamily: "var(--font-geist-mono, monospace)",
                  }}
                >
                  {error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
