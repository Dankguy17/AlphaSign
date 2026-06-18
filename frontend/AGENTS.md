<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AlphaSign Frontend Implementation Brief

Build the AlphaSign frontend as a polished, operator-grade financial intelligence workspace for entering a ticker, watching Band agents collaborate in real time, and reading their final investment report in a clean UI.

The implementation should be frontend-first. Keep the majority of file changes inside `/frontend`. Backend edits are allowed only for the minimal frontend adapter protocol described below, plus any tiny schema/export changes strictly required to support it.

## Product Goal

AlphaSign should let a user:

1. Enter or choose a stock ticker.
2. Submit that ticker to the backend.
3. See the backend start an agent session through Band.
4. Watch agents interact in real time.
5. See basic market data, recent news, signals, and recommendations.
6. Read the backend's final report as a parsed, structured, readable analysis.
7. Inspect advanced but clean visualizations for price, signals, confidence, sentiment, and agent workflow state.

This is a demo-facing product. Prioritize a complete, reliable flow over speculative features.

## Scope Rules

- Primary work area: `/frontend`.
- Allowed backend work: only create or update the frontend adapter described in `Backend Adapter Protocol`.
- Do not refactor existing agents unless the adapter cannot function without a small, isolated change.
- Do not move backend agent logic into the frontend.
- Do not hard-code one ticker as the app's only happy path.
- Do not expose secrets to the browser. All API keys stay in `backend/.env` or server-only env files.
- Do not create a marketing landing page. The first screen must be the usable AlphaSign dashboard.

## Existing Project Context

- Frontend is a Next.js app in `/frontend`.
- Current frontend dependency baseline is Next `16.2.9`, React `19.2.4`, TypeScript, Tailwind CSS 4, and ESLint.
- Existing `frontend/src/app/page.tsx` is the default starter page and should be replaced by the real app.
- Backend shared schemas live in `backend/shared/schemas.py`.
- Existing backend packets:
  - `FindingsPacket`
  - `RequestPacket`
  - `SessionConfig`
- Existing backend agents include:
  - `signal_processing`
  - `narrative_analyst`
  - `latent_state`
  - `executive`
- Band is the agent communication layer. The frontend should observe and display that collaboration; it should not fake agent activity after the backend adapter exists.

## Design Direction

Use a clean financial operations interface: dense, legible, and calm. The app should feel like a professional research terminal, not a marketing site.

Palette requested by project owner:

```txt
["#e3f2fd","#bbdefb","#90caf9","#64b5f6","#42a5f5","#2196f3","#1e88e5","#1976d2","#1565c0","#0d47a1"]
```

Use this as the primary blue scale for navigation, active states, chart accents, and status emphasis. Avoid making the whole product a one-note blue page. Pair it with:

- Neutral backgrounds: white, near-white, zinc/slate grays.
- Financial semantic accents:
  - positive: green
  - negative/risk: red
  - warning/uncertainty: amber
  - neutral/pending: gray
- High-contrast text.

Cards are acceptable for individual repeated items, report sections, metric tiles, and panels. Avoid nesting cards inside cards. Keep border radii restrained at 8px or less unless an existing component requires otherwise.

## Expected First Screen

The first viewport should be the working dashboard:

- Header with AlphaSign wordmark/title, connection status, and backend/Band status.
- Ticker input with autocomplete or quick-select chips.
- Primary action to start analysis.
- Market snapshot panel.
- Agent activity panel.
- Report panel or empty state.
- Visualization area.

Do not start with a hero section.

## Frontend Features

### Backend Connectivity

Implement a typed frontend API client. It should read a base URL from an env var such as `NEXT_PUBLIC_ALPHASIGN_API_URL`, with a sensible local default like `http://localhost:8000`.

The client should support:

- Health check.
- Start analysis session.
- Fetch current session state.
- Subscribe to live session events.
- Fetch ticker market data.
- Fetch final parsed report.

Handle loading, empty, error, retry, disconnected, and completed states explicitly.

### Ticker Input

Support:

- Manual ticker entry.
- Uppercase normalization.
- Basic validation.
- Common ticker suggestions.
- Recent selections in local state.
- Optional search endpoint if the backend adapter adds one.

Suggested defaults: `AAPL`, `MSFT`, `NVDA`, `TSLA`, `AMZN`, `GOOGL`, `META`, `AMD`, `NFLX`, `SPY`.

### Band Agent Activity

Display real-time collaboration as an event stream and workflow graph:

- Agent joined/ready.
- Agent message sent.
- Request packet sent.
- Findings packet returned.
- Tool/action started.
- Tool/action completed.
- Error/retry.
- Final report ready.

Show agents as distinct nodes:

- Narrative Analyst
- Signal Processing
- Latent State
- Executive
- Frontend Observer

Create a new backend Band-facing observer/adapter agent only if required by the Band model to expose events to the frontend. Name it `frontend_observer` or `frontend_adapter`. Its responsibility is observation and relay, not investment reasoning.

### Report Parsing

The backend may return prose-heavy agent output. Parse it into a clean UI without losing the raw text.

Display:

- Executive summary.
- Recommendation.
- Confidence.
- Bullish case.
- Bearish/risk case.
- Catalysts.
- Quantitative signals.
- Narrative/news themes.
- Source reliability.
- Agent-by-agent findings.
- Raw report toggle.

If the backend returns structured JSON, prefer it. If it returns markdown/plain text, parse section headings conservatively and keep a raw fallback.

### Market Data

Use backend-provided data where possible. The backend already has `yfinance` in scope, so do not call Yahoo Finance directly from the browser unless explicitly needed and legally acceptable.

Display:

- Company/ticker.
- Latest price.
- Daily change and percent change.
- Volume.
- Market cap if available.
- 52-week range if available.
- Sparkline or price chart.
- Timestamp/source label.

### News, Signals, And Trade Recommendation

Display backend-provided news and signal data cleanly:

- News headline.
- Source.
- Published date.
- Sentiment or relevance if available.
- Reliability tier/confidence if available.
- Related agent/lens.

For trade recommendations, use careful language:

- Suggested action: buy/sell/hold/watch/avoid.
- Time horizon.
- Confidence.
- Supporting evidence.
- Key risks.
- This is informational and not financial advice.

Do not invent recommendations client-side when the backend does not provide one. If no recommendation exists, show "Pending executive recommendation" or "Insufficient evidence".

### Graph Visualization

Implement clean, useful charts instead of decorative visuals.

Recommended visualization set:

- Price chart with window selector.
- Signal metrics chart: return, volatility, beta, idiosyncratic volatility.
- Sentiment over time.
- Agent collaboration graph with nodes and event edges.
- Confidence gauge or bar.

Prefer established libraries for charting/graphs. Good options:

- `recharts` for financial metric charts.
- `reactflow` or a lightweight SVG/canvas implementation for the agent graph.
- `lucide-react` for icons.

Install dependencies only when they clearly reduce complexity. Keep visualizations responsive and non-overlapping on mobile and desktop.

## Suggested Frontend Structure

Keep the app simple but modular:

```txt
frontend/src/
  app/
    page.tsx
    layout.tsx
    globals.css
  components/
    app-shell.tsx
    ticker-command.tsx
    market-snapshot.tsx
    agent-activity.tsx
    agent-graph.tsx
    report-viewer.tsx
    signal-charts.tsx
    news-panel.tsx
    recommendation-panel.tsx
  lib/
    api.ts
    report-parser.ts
    formatters.ts
    types.ts
  hooks/
    use-analysis-session.ts
    use-event-stream.ts
```

This is a guide, not a required exact tree. Match existing Next.js 16 app conventions after reading the local docs.

## Backend Adapter Protocol

Scaffold a small backend adapter that gives the frontend a stable HTTP and event-stream surface over the existing agents and Band room activity.

Preferred location:

```txt
backend/frontend_adapter/
  __init__.py
  api.py
  models.py
  session_store.py
  band_bridge.py
```

Alternative acceptable location if it better fits the repo:

```txt
backend/shared/frontend_adapter.py
backend/app.py
```

The adapter should not replace Band. It should coordinate with Band and expose a frontend-safe view of what is happening.

### Adapter Responsibilities

- Accept a ticker from the frontend.
- Create or attach to a Band chat/session for that ticker.
- Trigger the appropriate starting agent, likely Narrative Analyst.
- Listen for Band messages/events.
- Normalize Band messages into frontend event objects.
- Cache session state in memory for local demo use.
- Expose session state over HTTP.
- Stream live events to the frontend through SSE or WebSocket.
- Return market/news/signal/report data in structured JSON where possible.

### Minimal HTTP Contract

Use FastAPI because the backend already includes it.

Required endpoints:

```txt
GET  /health
POST /api/sessions
GET  /api/sessions/{session_id}
GET  /api/sessions/{session_id}/events
GET  /api/sessions/{session_id}/report
GET  /api/market/{ticker}
```

Optional endpoints:

```txt
GET  /api/tickers/search?q=...
POST /api/sessions/{session_id}/cancel
POST /api/sessions/{session_id}/restart
```

### Adapter Method Scaffold

The backend adapter should expose methods equivalent to:

```txt
create_session(ticker, sector=None, max_rounds=2) -> SessionState
start_band_analysis(session_id) -> None
publish_frontend_event(session_id, event) -> None
subscribe_session_events(session_id) -> event stream
get_session_state(session_id) -> SessionState
get_market_snapshot(ticker) -> MarketSnapshot
get_final_report(session_id) -> ReportPayload
normalize_band_message(message) -> AgentEvent
parse_agent_output(raw_message) -> ParsedAgentPayload
```

This is a protocol scaffold, not a mandate to implement exactly these function names if a cleaner local pattern emerges.

### Frontend-Facing Data Shapes

Session state:

```txt
{
  "session_id": "string",
  "ticker": "AAPL",
  "status": "idle|starting|running|completed|failed|cancelled",
  "created_at": "ISO-8601",
  "updated_at": "ISO-8601",
  "agents": [{"id": "signal_processing", "name": "Signal Processing", "status": "idle|working|done|error"}],
  "latest_event_id": "string|null",
  "report_ready": true
}
```

Agent event:

```txt
{
  "id": "string",
  "session_id": "string",
  "timestamp": "ISO-8601",
  "type": "session_started|agent_message|request_packet|findings_packet|tool_started|tool_completed|report_ready|error",
  "agent": "narrative_analyst|signal_processing|latent_state|executive|frontend_observer|system",
  "target_agent": "string|null",
  "title": "string",
  "message": "string",
  "payload": {},
  "raw": "string|null"
}
```

Market snapshot:

```txt
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "price": 123.45,
  "change": 1.23,
  "change_percent": 1.01,
  "volume": 12345678,
  "market_cap": 1234567890,
  "fifty_two_week_low": 100.0,
  "fifty_two_week_high": 150.0,
  "history": [{"date": "YYYY-MM-DD", "close": 123.45}],
  "source": "yfinance",
  "as_of": "ISO-8601"
}
```

Report payload:

```txt
{
  "session_id": "string",
  "ticker": "AAPL",
  "status": "draft|final|failed",
  "recommendation": {
    "action": "buy|sell|hold|watch|avoid|unknown",
    "confidence": 0.0,
    "time_horizon": "string",
    "rationale": ["string"]
  },
  "sections": [{"id": "summary", "title": "Executive Summary", "content": "string"}],
  "signals": {},
  "news": [],
  "raw_report": "string"
}
```

## Live Events Transport

Prefer Server-Sent Events for the first implementation:

- Browser-native `EventSource`.
- Simple one-way updates.
- Good enough for agent progress streaming.

Use WebSocket only if the backend adapter already has a clear WebSocket pattern or the UI needs bidirectional updates during a session.

The frontend should gracefully fall back to polling `GET /api/sessions/{session_id}` if the event stream fails.

## Error Handling

Frontend must show actionable errors for:

- Backend unreachable.
- Band not configured.
- Invalid ticker.
- Market data fetch failed.
- Agent session failed.
- Event stream disconnected.
- Report unavailable.

Avoid stack traces in the UI. Log developer details to the console only in development.

## Accessibility And Responsiveness

- Use semantic buttons, forms, and headings.
- Ensure keyboard access for ticker input and actions.
- Maintain readable contrast.
- Keep the dashboard usable at desktop and mobile widths.
- Prevent text overlap in panels, charts, and buttons.
- Use stable dimensions for charts, graph nodes, and metric tiles.

## Verification Checklist

Before finishing implementation:

1. Run `npm run lint` in `/frontend`.
2. Run `npm run build` in `/frontend`.
3. Start the frontend dev server.
4. Start the backend adapter server if implemented.
5. Open the app in a browser and verify:
   - page loads without console errors,
   - ticker submission calls the backend,
   - disconnected backend state is handled,
   - event stream or polling updates the UI,
   - report parsing renders a readable report,
   - charts render and resize,
   - mobile layout does not overlap.
6. If backend credentials are unavailable, verify with adapter fixtures or mocked responses, but keep mocks isolated and clearly labeled.

## Implementation Priorities

Do this in order:

1. Read local Next.js 16 docs from `node_modules/next/dist/docs/`.
2. Build typed frontend data models and API client.
3. Build the dashboard shell and ticker workflow.
4. Add backend health/session integration.
5. Add SSE or polling event updates.
6. Add market snapshot and basic chart.
7. Add agent event timeline and graph.
8. Add report parser and report UI.
9. Add news/signals/recommendation panels.
10. Add the minimal backend adapter only where necessary.
11. Verify lint, build, browser behavior, and responsive layout.

## Codex Prompt Under 300 Words

Use this prompt for the implementation pass:

```txt
Reference [AGENTS.md](http://agents.md) before making changes. Build the AlphaSign frontend as a real dashboard, not a landing page. Keep most edits inside /frontend. You may make minimal backend changes only to add the frontend adapter protocol described in AGENTS.md.

Implement: backend health/session connectivity, ticker input and suggestions, session start, live Band agent activity via SSE or polling, market snapshot data, news/signals/recommendation panels, clean report parsing from backend output, and advanced but restrained visualizations for price/signals/agent workflow. Use the requested blue palette as the primary scale with neutral and semantic accents so the UI does not become one-note.

Before coding, inspect the repo, read the local Next.js 16 docs in node_modules/next/dist/docs/, and preserve existing backend agent behavior. The backend adapter should expose stable frontend-safe endpoints for health, sessions, events, market data, and final report state. Do not put API secrets in the browser.

Use TypeScript types, a small API client, explicit loading/error/empty/completed states, responsive layouts, accessible controls, and chart/graph libraries only when they reduce complexity. Verify with npm run lint, npm run build, and browser testing. Report any backend credential or Band configuration blockers clearly and use isolated fixtures only when real credentials are unavailable.
```
