import type { AgentEvent, MarketSnapshot, ReportPayload, SessionState } from "@/lib/types";

const now = new Date().toISOString();

export const fixtureSession: SessionState = {
  session_id: "fixture-session",
  ticker: "NVDA",
  status: "completed",
  created_at: now,
  updated_at: now,
  latest_event_id: "fixture-5",
  report_ready: true,
  agents: [
    { id: "narrative_analyst", name: "Narrative Analyst", status: "done" },
    { id: "signal_processing", name: "Signal Processing", status: "done" },
    { id: "latent_state", name: "Latent State", status: "done" },
    { id: "executive", name: "Executive", status: "done" },
    { id: "frontend_observer", name: "Frontend Observer", status: "done" },
  ],
};

export const fixtureEvents: AgentEvent[] = [
  {
    id: "fixture-1",
    session_id: fixtureSession.session_id,
    timestamp: now,
    type: "session_started",
    agent: "frontend_observer",
    target_agent: "narrative_analyst",
    title: "Session accepted",
    message: "Adapter acknowledged NVDA analysis request.",
    raw: null,
  },
  {
    id: "fixture-2",
    session_id: fixtureSession.session_id,
    timestamp: now,
    type: "request_packet",
    agent: "narrative_analyst",
    target_agent: "signal_processing",
    title: "Request packet",
    message: "Requesting price, volatility, and abnormal return context.",
    raw: null,
  },
  {
    id: "fixture-3",
    session_id: fixtureSession.session_id,
    timestamp: now,
    type: "findings_packet",
    agent: "signal_processing",
    target_agent: "latent_state",
    title: "Findings returned",
    message: "Momentum remains positive while short-term volatility is elevated.",
    raw: null,
  },
  {
    id: "fixture-4",
    session_id: fixtureSession.session_id,
    timestamp: now,
    type: "agent_message",
    agent: "latent_state",
    target_agent: "executive",
    title: "State synthesis",
    message: "Narrative and signal layers agree on constructive but risk-aware posture.",
    raw: null,
  },
  {
    id: "fixture-5",
    session_id: fixtureSession.session_id,
    timestamp: now,
    type: "report_ready",
    agent: "executive",
    target_agent: null,
    title: "Report ready",
    message: "Executive recommendation is ready for review.",
    raw: null,
  },
];

export const fixtureMarket: MarketSnapshot = {
  ticker: "NVDA",
  name: "NVIDIA Corporation",
  price: 142.83,
  change: 2.15,
  change_percent: 1.53,
  volume: 214_552_900,
  market_cap: 3_510_000_000_000,
  fifty_two_week_low: 86.62,
  fifty_two_week_high: 153.13,
  source: "isolated fixture",
  as_of: now,
  history: [
    { date: "2026-06-10", close: 132.4 },
    { date: "2026-06-11", close: 134.2 },
    { date: "2026-06-12", close: 133.7 },
    { date: "2026-06-15", close: 137.9 },
    { date: "2026-06-16", close: 139.8 },
    { date: "2026-06-17", close: 140.7 },
    { date: "2026-06-18", close: 142.83 },
  ],
};

export const fixtureReport: ReportPayload = {
  session_id: fixtureSession.session_id,
  ticker: "NVDA",
  status: "final",
  recommendation: {
    action: "watch",
    confidence: 0.68,
    time_horizon: "2-6 weeks",
    rationale: [
      "Signal stack remains constructive but volatility reduces entry quality.",
      "Narrative support is strong around data center demand.",
      "Risk case depends on valuation compression and supply-chain headlines.",
    ],
  },
  signals: {
    return: 4.7,
    volatility: 31.2,
    beta: 1.84,
    idiosyncratic_volatility: 18.6,
    sentiment: 0.62,
    confidence: 0.68,
  },
  news: [
    {
      headline: "Analysts raise estimates on data center demand durability",
      source: "Fixture Wire",
      published_at: now,
      sentiment: "positive",
      reliability: "medium",
      relevance: 0.81,
      related_agent: "narrative_analyst",
    },
    {
      headline: "Options market implies elevated near-term volatility",
      source: "Fixture Market Desk",
      published_at: now,
      sentiment: "mixed",
      reliability: "medium",
      relevance: 0.74,
      related_agent: "signal_processing",
    },
  ],
  sections: [],
  raw_report: `Executive Summary
NVDA screens as constructive but extended. The agent consensus favors waiting for a cleaner entry unless the mandate requires immediate exposure.

Bullish Case
Data center demand, operating leverage, and persistent AI infrastructure spending support upside.

Bearish Case
Valuation sensitivity, crowded positioning, and any slowdown in hyperscaler capex remain the main risks.

Quantitative Signals
Momentum is positive, volatility is elevated, and beta remains above market.

Source Reliability
Fixture content is isolated for frontend verification only and must be replaced by backend adapter output.`,
};
