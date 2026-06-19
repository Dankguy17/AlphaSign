// Typed client for the real AlphaSign backend adapter.
import { getAdapterUrl } from "@/lib/adapter-url";
//
// Contract (see backend/agent_callback_integration.py):
//   GET  /stream    SSE of agent messages + report_ready + reset events
//   GET  /messages  full history as JSON array (initial load / reconnect)
//   GET  /report    PDF download (404 until generated)
//   POST /reset     clear history between sessions

export const ALPHASIGN_BASE_URL = getAdapterUrl();

export function getAlphaSignBaseUrl() {
  return getAdapterUrl();
}

export type AgentId =
  | "narrative_analyst"
  | "signal_processing"
  | "latent_state";

export type AgentMessage = {
  agent: AgentId;
  room_id: string;
  text: string;
  ts: string;
};

export type ProtocolCard = {
  protocol_version: "1.0";
  kind: "finding" | "signal" | "risk" | "request" | "status";
  title: string;
  summary: string;
  stance: "bullish" | "bearish" | "neutral" | "mixed" | "unknown";
  confidence: number | null;
  metrics: { label: string; value: string }[];
  evidence: string[];
  risks: string[];
  next_action: string | null;
};

export type ProtocolCardEvent = {
  type: "protocol_card";
  agent: AgentId;
  room_id: string;
  source_ts: string;
  ts: string;
  card: ProtocolCard;
};

export type StreamEvent =
  | AgentMessage
  | ProtocolCardEvent
  | { type: "protocol_error"; agent: AgentId; source_ts: string; error: string; ts?: string }
  | { type: "report_ready"; path: string; ts: string }
  | { type: "reset"; ts: string };

export type AgentMeta = {
  id: AgentId;
  name: string;
  short: string;
  /** Agent this one @mentions by default, per the system prompts. */
  forwardsTo: AgentId;
};

// Turn flow (always-on loop): Narrative → Signals → Latent → Narrative.
export const AGENTS: AgentMeta[] = [
  {
    id: "narrative_analyst",
    name: "Narrative Analyst",
    short: "Narrative",
    forwardsTo: "signal_processing",
  },
  {
    id: "signal_processing",
    name: "Signal Processing",
    short: "Signals",
    forwardsTo: "latent_state",
  },
  {
    id: "latent_state",
    name: "Latent State",
    short: "Latent",
    forwardsTo: "narrative_analyst",
  },
];

export const AGENT_BY_ID: Record<AgentId, AgentMeta> = Object.fromEntries(
  AGENTS.map((agent) => [agent.id, agent]),
) as Record<AgentId, AgentMeta>;

export function isAgentMessage(event: StreamEvent): event is AgentMessage {
  return !("type" in event) && (event as AgentMessage).agent !== undefined;
}

export function isProtocolCard(event: StreamEvent): event is ProtocolCardEvent {
  return "type" in event && event.type === "protocol_card";
}

/** Stable de-dupe key — the adapter may replay history over the stream. */
export function messageKey(message: AgentMessage): string {
  return `${message.agent}|${message.ts}|${message.text.slice(0, 64)}`;
}

export function getReportUrl() {
  return `${getAlphaSignBaseUrl()}/report`;
}

export async function fetchHistory(signal?: AbortSignal): Promise<AgentMessage[]> {
  const res = await fetch(`${getAlphaSignBaseUrl()}/messages`, {
    signal,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`History fetch failed (${res.status})`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.filter(
    (item): item is AgentMessage =>
      typeof item?.agent === "string" && typeof item?.text === "string",
  );
}

export async function fetchProtocolHistory(signal?: AbortSignal): Promise<ProtocolCardEvent[]> {
  const res = await fetch(`${getAlphaSignBaseUrl()}/messages`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`Protocol history fetch failed (${res.status})`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is ProtocolCardEvent => item?.type === "protocol_card" && !!item.card);
}

export async function checkReportReady(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(getReportUrl(), { method: "HEAD", signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resetSession(): Promise<void> {
  const res = await fetch(`${getAlphaSignBaseUrl()}/reset`, { method: "POST" });
  if (!res.ok) throw new Error(`Reset failed (${res.status})`);
}

/** "12s ago", "4m ago", "2h ago". */
export function relativeTime(ts?: string | null): string {
  if (!ts) return "—";
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
