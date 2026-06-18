import type {
  AgentPromptEvent,
  ChartData,
  ExecutiveRunRequest,
  ExecutiveSessionStatus,
} from "./types";

const BACKEND =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
const CHART_BACKEND =
  process.env.NEXT_PUBLIC_CHART_URL ?? "http://localhost:8001";

export async function createSession(
  req: ExecutiveRunRequest
): Promise<ExecutiveSessionStatus> {
  const res = await fetch(`${BACKEND}/executive/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
  return res.json();
}

export async function getSession(
  sessionId: string
): Promise<ExecutiveSessionStatus> {
  const res = await fetch(`${BACKEND}/executive/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`Session not found: ${res.status}`);
  return res.json();
}

export async function listEvents(
  sessionId: string
): Promise<AgentPromptEvent[]> {
  const res = await fetch(
    `${BACKEND}/executive/sessions/${sessionId}/events`
  );
  if (!res.ok) return [];
  return res.json();
}

export function eventStreamUrl(sessionId: string): string {
  return `${BACKEND}/executive/sessions/${sessionId}/events/stream`;
}

export function reportDownloadUrl(sessionId: string): string {
  return `${BACKEND}/executive/sessions/${sessionId}/report`;
}

export async function fetchChartData(
  ticker: string,
  window: string = "6M"
): Promise<ChartData | null> {
  try {
    const res = await fetch(
      `${CHART_BACKEND}/chart/${encodeURIComponent(ticker)}?window=${window}`
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
