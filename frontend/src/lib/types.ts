export type SessionStatus =
  | "idle"
  | "starting"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentStatus = "idle" | "working" | "done" | "error";

export type AgentId =
  | "narrative_analyst"
  | "signal_processing"
  | "latent_state"
  | "executive"
  | "frontend_observer"
  | "system";

export type AgentEventType =
  | "session_started"
  | "agent_message"
  | "request_packet"
  | "findings_packet"
  | "tool_started"
  | "tool_completed"
  | "report_ready"
  | "error";

export type RecommendationAction =
  | "buy"
  | "sell"
  | "hold"
  | "watch"
  | "avoid"
  | "unknown";

export type HealthStatus = {
  status: "ok" | "degraded" | "unavailable";
  band_configured?: boolean;
  version?: string;
  message?: string;
};

export type AgentState = {
  id: AgentId;
  name: string;
  status: AgentStatus;
};

export type SessionState = {
  session_id: string;
  ticker: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  agents: AgentState[];
  latest_event_id: string | null;
  report_ready: boolean;
};

export type AgentEvent = {
  id: string;
  session_id: string;
  timestamp: string;
  type: AgentEventType;
  agent: AgentId;
  target_agent: AgentId | string | null;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  raw: string | null;
};

export type PricePoint = {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
};

export type MarketSnapshot = {
  ticker: string;
  name: string;
  price: number;
  change: number;
  change_percent: number;
  volume?: number | null;
  market_cap?: number | null;
  fifty_two_week_low?: number | null;
  fifty_two_week_high?: number | null;
  history: PricePoint[];
  chart_range?: string;
  chart_interval?: string;
  source: string;
  as_of: string;
};

export type NewsItem = {
  id?: string;
  headline: string;
  source?: string;
  published_at?: string;
  sentiment?: "positive" | "negative" | "neutral" | "mixed";
  relevance?: number;
  reliability?: string;
  related_agent?: AgentId | string;
};

export type ReportSection = {
  id: string;
  title: string;
  content: string;
};

export type Recommendation = {
  action: RecommendationAction;
  confidence: number;
  time_horizon?: string;
  rationale: string[];
};

export type SignalMetrics = {
  return?: number;
  volatility?: number;
  beta?: number;
  idiosyncratic_volatility?: number;
  sentiment?: number;
  confidence?: number;
  [key: string]: number | string | boolean | undefined;
};

export type ReportPayload = {
  session_id: string;
  ticker: string;
  status: "draft" | "final" | "failed";
  recommendation?: Recommendation;
  sections: ReportSection[];
  signals?: SignalMetrics;
  news?: NewsItem[];
  raw_report: string;
};

export type ApiError = {
  message: string;
  status?: number;
  code?: string;
};
