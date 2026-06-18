export type WorkflowAgent =
  | "executive"
  | "narrative_analyst"
  | "signal_processing"
  | "latent_state";

export type EventKind = "status" | "prompt" | "response" | "summary" | "report";
export type SessionStatus = "queued" | "running" | "complete" | "failed";

export interface AgentPromptEvent {
  session_id: string;
  round: number;
  from_agent: WorkflowAgent;
  to_agent: WorkflowAgent;
  ticker: string | null;
  kind: EventKind;
  text: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface ExecutiveRunRequest {
  tickers: string[];
  max_deliberations: number;
  user_instruction?: string;
}

export interface ExecutiveSessionStatus {
  session_id: string;
  status: SessionStatus;
  tickers: string[];
  max_deliberations: number;
  report_path: string | null;
  error: string | null;
}

export interface PricePoint {
  date: string;
  close: number;
}

export interface KalmanSummary {
  filtered_level: number;
  kalman_trend_slope: number;
  structural_regime_shift: boolean;
  predicted_next_value?: number;
  noise_variance?: number;
  latest_innovation_z?: number;
}

export interface ChartData {
  ticker: string;
  window: string;
  prices: PricePoint[];
  kalman?: KalmanSummary;
}

// Metadata shapes per event kind
export interface SignalResponseMetadata {
  window?: string;
  metrics?: {
    log_return?: number;
    volatility?: number;
    beta?: number;
    market_adjusted_return?: number;
    idiosyncratic_vol?: number;
  };
  price_points?: number;
}

export interface LatentResponseMetadata {
  kalman?: Partial<KalmanSummary>;
  summary?: string;
}
