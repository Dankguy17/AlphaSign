"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AgentMessage,
  ProtocolCardEvent,
  StreamEvent,
  checkReportReady,
  fetchHistory,
  fetchProtocolHistory,
  getAlphaSignBaseUrl,
  isAgentMessage,
  isProtocolCard,
  messageKey,
  resetSession,
} from "@/lib/alphasign";

export type StreamStatus = "connecting" | "live" | "disconnected";

export type AlphaSignStream = {
  messages: AgentMessage[];
  cards: ProtocolCardEvent[];
  status: StreamStatus;
  reportReady: boolean;
  reportTs: string | null;
  lastEventTs: string | null;
  error: string | null;
  reset: () => Promise<void>;
  reload: () => void;
};

export function useAlphaSignStream(): AlphaSignStream {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [cards, setCards] = useState<ProtocolCardEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [reportReady, setReportReady] = useState(false);
  const [reportTs, setReportTs] = useState<string | null>(null);
  const [lastEventTs, setLastEventTs] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // De-dupe set survives across renders.
  const seen = useRef<Set<string>>(new Set());

  const ingest = useCallback((message: AgentMessage) => {
    const key = messageKey(message);
    if (seen.current.has(key)) return;
    seen.current.add(key);
    setMessages((prev) => [...prev, message]);
    setLastEventTs(message.ts);
  }, []);

  const clearLocal = useCallback(() => {
    seen.current.clear();
    setMessages([]);
    setCards([]);
    setReportReady(false);
    setReportTs(null);
  }, []);

  const reset = useCallback(async () => {
    await resetSession();
    clearLocal();
  }, [clearLocal]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let source: EventSource | null = null;
    let cancelled = false;

    async function bootstrap() {
      setStatus("connecting");
      setError(null);

      // Seed from history + check whether a report already exists.
      try {
        const [history, protocolHistory, hasReport] = await Promise.all([
          fetchHistory(controller.signal),
          fetchProtocolHistory(controller.signal),
          checkReportReady(controller.signal),
        ]);
        if (cancelled) return;
        history.forEach(ingest);
        setCards(protocolHistory);
        if (hasReport) setReportReady(true);
      } catch {
        if (cancelled || controller.signal.aborted) return;
        const adapterBaseUrl = getAlphaSignBaseUrl();
        setError(
          `Cannot reach the adapter at ${adapterBaseUrl}. Start it, then reconnect.`,
        );
      }

      if (cancelled) return;

      // Open the live stream. EventSource auto-reconnects on drop.
      source = new EventSource(`${getAlphaSignBaseUrl()}/stream`);

      source.onopen = () => {
        setStatus("live");
        setError(null);
      };

      source.onmessage = (event) => {
        let data: StreamEvent;
        try {
          data = JSON.parse(event.data) as StreamEvent;
        } catch {
          return;
        }
        if ("type" in data && data.type === "report_ready") {
          setReportReady(true);
          setReportTs(data.ts);
        } else if ("type" in data && data.type === "reset") {
          clearLocal();
        } else if (isAgentMessage(data)) {
          ingest(data);
        } else if (isProtocolCard(data)) {
          setCards((previous) => previous.some((item) => item.source_ts === data.source_ts) ? previous : [...previous, data]);
        }
      };

      source.onerror = () => {
        // readyState 2 = closed; otherwise the browser is retrying.
        setStatus(source?.readyState === 2 ? "disconnected" : "connecting");
      };
    }

    void bootstrap();

    return () => {
      cancelled = true;
      controller.abort();
      source?.close();
    };
  }, [ingest, clearLocal, reloadToken]);

  return {
    messages,
    cards,
    status,
    reportReady,
    reportTs,
    lastEventTs,
    error,
    reset,
    reload,
  };
}
