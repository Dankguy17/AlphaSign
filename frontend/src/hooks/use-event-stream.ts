"use client";

import { useEffect, useState } from "react";
import { eventsUrl } from "@/lib/api";
import type { AgentEvent } from "@/lib/types";

type StreamState = "idle" | "connecting" | "open" | "error" | "closed";

export function useEventStream(
  sessionId: string | null,
  onEvent: (event: AgentEvent) => void,
) {
  const [state, setState] = useState<StreamState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      const timer = window.setTimeout(() => {
        setState("idle");
        setError(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      setState("connecting");
      setError(null);
    }, 0);

    if (typeof EventSource === "undefined") {
      window.clearTimeout(timer);
      const unsupportedTimer = window.setTimeout(() => {
        setState("error");
        setError("This browser does not support EventSource.");
      }, 0);
      return () => window.clearTimeout(unsupportedTimer);
    }

    const source = new EventSource(eventsUrl(sessionId));

    source.onopen = () => setState("open");
    source.onmessage = (message) => {
      try {
        onEvent(JSON.parse(message.data) as AgentEvent);
      } catch (eventError) {
        setError(
          eventError instanceof Error
            ? eventError.message
            : "Could not parse session event.",
        );
      }
    };
    source.onerror = () => {
      setState("error");
      setError("Live event stream disconnected. Polling will continue.");
      source.close();
    };

    return () => {
      window.clearTimeout(timer);
      source.close();
      setState("closed");
    };
  }, [onEvent, sessionId]);

  return { state, error };
}
