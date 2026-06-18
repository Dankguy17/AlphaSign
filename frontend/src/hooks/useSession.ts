"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createSession, eventStreamUrl, getSession } from "@/lib/api";
import type {
  AgentPromptEvent,
  SessionStatus,
  SignalResponseMetadata,
} from "@/lib/types";

interface LatestSignal {
  ticker: string;
  window: string;
}

interface SessionState {
  status: SessionStatus | "idle";
  sessionId: string | null;
  events: AgentPromptEvent[];
  latestSignal: LatestSignal | null;
  error: string | null;
}

export function useSession() {
  const [state, setState] = useState<SessionState>({
    status: "idle",
    sessionId: null,
    events: [],
    latestSignal: null,
    error: null,
  });

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const submit = useCallback(
    async (tickers: string[], maxDeliberations: number, userInstruction?: string) => {
      cleanup();
      setState({
        status: "queued",
        sessionId: null,
        events: [],
        latestSignal: null,
        error: null,
      });

      let sessionId: string;
      try {
        const session = await createSession({
          tickers,
          max_deliberations: maxDeliberations,
          user_instruction: userInstruction,
        });
        sessionId = session.session_id;
      } catch (err) {
        setState((s) => ({ ...s, status: "failed", error: String(err) }));
        return;
      }

      activeRef.current = sessionId;
      setState((s) => ({ ...s, status: "running", sessionId }));

      // Open SSE stream
      const es = new EventSource(eventStreamUrl(sessionId));
      esRef.current = es;

      es.addEventListener("executive_prompt", (e: MessageEvent) => {
        try {
          const event: AgentPromptEvent = JSON.parse(e.data as string);
          setState((s) => ({ ...s, events: [...s.events, event] }));

          // Extract latest signal window when signal_processing responds
          if (
            event.from_agent === "signal_processing" &&
            event.ticker &&
            activeRef.current === sessionId
          ) {
            const meta = event.metadata as SignalResponseMetadata;
            if (meta.window) {
              setState((s) => ({
                ...s,
                latestSignal: { ticker: event.ticker!, window: meta.window! },
              }));
            }
          }
        } catch {
          // ignore malformed events
        }
      });

      // Poll status every 3 s
      pollRef.current = setInterval(async () => {
        try {
          const status = await getSession(sessionId);
          setState((s) => ({ ...s, status: status.status }));
          if (status.status === "complete" || status.status === "failed") {
            cleanup();
            if (status.error) setState((s) => ({ ...s, error: status.error }));
          }
        } catch {
          // keep polling
        }
      }, 3000);
    },
    [cleanup]
  );

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  return { ...state, submit };
}
