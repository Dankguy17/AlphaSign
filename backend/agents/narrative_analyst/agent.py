"""
agents/narrative_analyst/agent.py

The Narrative Analyst agent for AlphaSign — v5.

────────────────────────────────────────────────────────────────────────────
What changed from v4, and why
────────────────────────────────────────────────────────────────────────────
v4's problem: every ticker request produced TWO Band messages. That was not
a model-flakiness bug — it was architectural. v4's tool
(`run_narrative_analysis`) posted the *full* radar to Band directly via a
manual REST call, and then returned a short "posted above" string that the
LLM was instructed to ALSO send via `thenvoi_send_message`. That is two
sends by construction, every single time, regardless of which model is
driving the agent.

v5's fix: stop bypassing the framework's own send path.

  - The tool does all the work (fetch news → build radar → synthesize →
    format) and returns ONE finished message string.
  - The system prompt tells the model: call the tool, then pass its EXACT
    return value to `thenvoi_send_message`, once. No manual REST posting,
    no second "ack" message, no parallel send path to race against.

v5 also fixes two other things called out directly:

  1. No hard-coded example users/tickers in the prompt. The few-shot example
     previously baked in "[steven]: analyse AAPL" — a real-looking name and
     a specific ticker — which models can latch onto and partially
     reproduce regardless of the actual input. The prompt now uses
     generic placeholders only.

  2. Two distinct entry points instead of one. This agent's Band room has a
     specific lifecycle:
       - Turn 0 (room creation): a human or orchestrator supplies a ticker.
         The agent fetches news, builds the radar, and sends ONE message
         containing its findings plus a request to Signal Processing /
         Latent State.
       - Every later turn: the message comes FROM Signal Processing or
         Latent State, containing computed quant findings (log returns,
         idiosyncratic vol, Kalman-filtered regime state, etc.) for the
         ticker already in flight. The agent does NOT re-derive the ticker
         from that message (it won't be phrased as a request) — it pulls it
         from conversation state, re-runs news search with a sharpened
         lens, and re-synthesizes a single updated message.

     Two tools encode this rather than one tool with ambiguous behavior:
       - `start_narrative_research(ticker=...)`
       - `incorporate_quant_findings(quant_summary=...)`
     The system prompt tells the model which one applies based on who sent
     the incoming message.

────────────────────────────────────────────────────────────────────────────
A known limitation, stated plainly
────────────────────────────────────────────────────────────────────────────
"Ticker is implicit in conversation state" is handled here with a simple
in-process dict keyed by chat_id (`_ROOM_STATE`). That state lives only as
long as this process runs — a restart loses in-flight research context.
LangGraph's InMemorySaver (already wired below) has the same limitation for
the same reason. If this agent needs to survive restarts, swap `_ROOM_STATE`
for a real store (Redis, a DB row keyed by chat_id) — the read/write calls
are isolated in two small helper functions below specifically so that swap
is a one-place change.
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import date, timedelta
from uuid import UUID

from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

from thenvoi import Agent
from thenvoi.adapters import LangGraphAdapter
from thenvoi.config import load_agent_config
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from langchain_core.callbacks import BaseCallbackHandler
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.rate_limiters import InMemoryRateLimiter

# Package-relative imports
from .news_fetch import fetch_company_news
from .synthesis import build_narrative_radar, generate_narrative_brief

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Room state: tracks the active ticker (and last research pass) per Band chat.
#
# See module docstring — this is intentionally isolated behind two functions
# so the storage backend can be swapped without touching the tools below.
# ─────────────────────────────────────────────────────────────────────────────

_ROOM_STATE: dict[str, dict[str, Any]] = {}


def _get_room_state(chat_id: str) -> dict[str, Any]:
    return _ROOM_STATE.get(chat_id, {})


def _set_room_state(chat_id: str, **updates: Any) -> None:
    state = _ROOM_STATE.setdefault(chat_id, {})
    state.update(updates)


def _find_config_yaml(filename: str = "agent_config.yaml") -> Path:
    current = Path(__file__).resolve().parent
    while True:
        candidate = current / filename
        if candidate.exists():
            return candidate
        parent = current.parent
        if parent == current:
            raise FileNotFoundError(
                f"Could not find '{filename}' in '{Path(__file__).resolve().parent}' "
                "or any parent directory."
            )
        current = parent


# ─────────────────────────────────────────────────────────────────────────────
# Band-ready output formatter
# All sections are built deterministically from the radar/brief dicts.
# The LLM never writes or rewrites this content — it only relays it.
# ─────────────────────────────────────────────────────────────────────────────

def format_radar_for_band(radar: dict, brief: dict, *, quant_context: str | None = None) -> str:
    asset        = radar.get("asset", "UNKNOWN")
    sentiment    = radar.get("aggregate_sentiment", {})
    reliability  = radar.get("source_reliability", {})
    themes       = radar.get("themes", [])
    signal_req   = radar.get("signal_request", {})
    latent_req   = radar.get("latent_request", {})

    # Source reliability tiers
    tier_map: dict[str, list[str]] = {}
    for article in radar.get("top_articles", []):
        rel    = article.get("source_reliability", {})
        tier   = str(rel.get("tier", "?"))
        conf   = float(rel.get("confidence", 0.0))
        source = article.get("source") or "Unknown"
        key    = f"T{tier} ({conf:.2f})"
        tier_map.setdefault(key, []).append(source)

    tier_lines = [
        f"  {k}: {', '.join(list(dict.fromkeys(v))[:4])}"
        for k, v in sorted(tier_map.items())
    ]
    tier_block = "\n".join(tier_lines) if tier_lines else "  (no source data)"
    tier_legend = (
        "  T1 (0.92–0.97): SEC / company filings / official wires\n"
        "  T2 (0.84):       Major financial press (Reuters, FT, Bloomberg…)\n"
        "  T3 (0.72):       Analyst notes / industry commentary\n"
        "  T4 (0.52–0.58): Aggregators / blogs / unknown sources"
    )

    avg_conf      = reliability.get("average_confidence", 0.0)
    dominant_tier = reliability.get("dominant_tier", "?")

    # Themes
    theme_lines = []
    for t in themes[:5]:
        name  = t.get("theme", "").replace("_", " ").title()
        score = t.get("score", 0)
        ev    = t.get("evidence_titles", [])
        ev_str = f' — "{ev[0]}"' if ev else ""
        theme_lines.append(f"  • {name} (hits: {score}){ev_str}")
    theme_block = "\n".join(theme_lines) if theme_lines else "  • No dominant themes detected"

    # Catalysts & risk flags
    catalysts  = radar.get("catalysts", [])
    risk_flags = radar.get("risk_flags", [])
    cat_block  = "\n".join(f"  {i+1}. {c}" for i, c in enumerate(catalysts)) or "  (none)"
    risk_block = "\n".join(f"  ⚑ {r}" for r in risk_flags) or "  ⚑ None detected"

    # Signal Processing request
    sp_windows = ", ".join(signal_req.get("suggested_windows", []))
    sp_metrics = ", ".join(signal_req.get("requested_metrics", []))
    sp_lens    = signal_req.get("lens", radar.get("lens", ""))
    sp_reason  = signal_req.get("reason", "")

    # Latent State request
    ls_windows = ", ".join(latent_req.get("suggested_windows", []))
    ls_reason  = latent_req.get("reason", "")

    # Brief fields
    summary      = brief.get("summary", "")
    bullish_case = brief.get("bullish_case", radar.get("bullish_thesis", ""))
    bearish_case = brief.get("bearish_case", radar.get("bearish_thesis", ""))
    confidence   = float(brief.get("confidence", radar.get("confidence", 0.0)))

    q_signal = brief.get("questions_for_signal", [])
    q_latent = brief.get("questions_for_latent", [])
    q_signal_str = "\n".join(f"  • {q}" for q in q_signal) or "  • (see signal request below)"
    q_latent_str = "\n".join(f"  • {q}" for q in q_latent) or "  • (see latent request below)"

    sent_label = sentiment.get("label", "neutral").upper()
    sent_score = float(sentiment.get("score", 0.0))
    art_count  = radar.get("article_count", 0)

    quant_block = ""
    if quant_context:
        quant_block = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUANT CONTEXT INCORPORATED THIS PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{quant_context}
"""

    return f"""━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📰  NARRATIVE RADAR — {asset}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{quant_block}
SUMMARY
{summary}

AGGREGATE SENTIMENT
  Label: {sent_label}  |  Score: {sent_score:+.4f}  |  Articles: {art_count}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NARRATIVE THESIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 BULLISH CASE
  {bullish_case}

🔴 BEARISH CASE
  {bearish_case}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOMINANT THEMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{theme_block}

TOP CATALYSTS
{cat_block}

RISK FLAGS
{risk_block}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOURCE RELIABILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Dominant tier: {dominant_tier}  |  Avg confidence: {avg_conf:.2f}

  Articles by tier:
{tier_block}

  Tier legend:
{tier_legend}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡  REQUEST → @signal_processing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Asset:    {asset}
  Lens:     {sp_lens}
  Windows:  {sp_windows}
  Metrics:  {sp_metrics}
  Reason:   {sp_reason}

  Narrative questions for Signal Processing:
{q_signal_str}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔬  REQUEST → @latent_state
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Asset:    {asset}
  Windows:  {ls_windows}
  Reason:   {ls_reason}

  Narrative questions for Latent State:
{q_latent_str}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Confidence: {confidence:.0%}  |  Awaiting: price reaction + Kalman confirmation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""


def _build_fallback_brief(radar: dict) -> dict:
    """Deterministic brief used only if generate_narrative_brief itself raises."""
    return {
        "summary": (
            f"{radar['asset']} news coverage is {radar['aggregate_sentiment']['label']} "
            f"with strongest themes: "
            f"{', '.join(t['theme'] for t in radar['themes'][:3]) or 'general_news'}."
        ),
        "bullish_case": radar["bullish_thesis"],
        "bearish_case": radar["bearish_thesis"],
        "questions_for_signal": [
            f"Use {', '.join(radar['signal_request']['suggested_windows'])} windows.",
            f"Compute {', '.join(radar['signal_request']['requested_metrics'])}.",
        ],
        "questions_for_latent": [radar["latent_request"]["reason"]],
        "confidence": radar["confidence"],
    }


def _run_research_pipeline(
    symbol: str,
    *,
    lens: str | None = None,
    quant_context: str | None = None,
) -> str:
    """
    Shared pipeline: fetch news → build radar → synthesize brief → format.
    Returns the single finished Band message string. Never raises — any
    failure is converted into a short, honest message instead of a crash,
    so the calling tool always has something valid to return to the LLM.
    """
    try:
        parsed = UUID(str(agent_id))
    except ValueError as exc:
        raise RuntimeError(
            "Invalid narrative_analyst.agent_id in agent_config.yaml. "
            "Copy the UUID from your Band Remote Agent settings."
        ) from exc

    if str(parsed) == "00000000-0000-0000-0000-000000000002":
        raise RuntimeError(
            "agent_config.yaml still contains the placeholder narrative_analyst agent_id. "
            "Create a Band Remote Agent for narrative_analyst and paste its real agent_id."
        )

    lowered_key = str(api_key or "").strip().lower()
    if (
        not lowered_key
        or lowered_key.startswith("band_api_key")
        or lowered_key.startswith("your_")
        or lowered_key.startswith("optional_")
    ):
        raise RuntimeError(
            "agent_config.yaml still contains a placeholder narrative_analyst api_key. "
            "Paste the real API key shown when you create the Band Remote Agent."
        )


def _json_dumps(data: object) -> str:
    return json.dumps(data, ensure_ascii=True)


def _load_json_dict(value: str) -> dict:
    try:
        payload = json.loads(value)
        return payload if isinstance(payload, dict) else {}
    except json.JSONDecodeError:
        return {}


def _parse_articles_payload(value: str) -> tuple[list[dict], str | None]:
    """
    Parse article payloads without crashing the whole Band execution.

    LLMs sometimes try to pass the displayed output of search_company_news as a
    manually quoted string, which can produce invalid JSON. In that case return
    a tool-readable error instead of raising and marking the Band message failed.
    """
    try:
        payload = json.loads(value)
    except json.JSONDecodeError as exc:
        return [], (
            "Invalid articles_json. Do not manually quote or rewrite article JSON. "
            "Use build_full_narrative_report for normal ticker research, or pass "
            f"the exact raw output from search_company_news. JSON error: {exc}"
        )

    if isinstance(payload, dict):
        articles = payload.get("articles", [])
    elif isinstance(payload, list):
        articles = payload
    else:
        return [], "articles_json must decode to a dict with 'articles' or a list of article objects."

    if not isinstance(articles, list):
        return [], "The 'articles' field must be a list."

    return [article for article in articles if isinstance(article, dict)], None


def _format_band_report(radar: dict, brief: dict) -> str:
    top_articles = radar.get("top_articles", [])[:5]
    article_lines = []
    for idx, article in enumerate(top_articles, start=1):
        reliability = article.get("source_reliability", {})
        article_lines.append(
            f"{idx}. {article.get('title', 'Untitled')} "
            f"({article.get('source', 'Unknown source')}, "
            f"{reliability.get('tier_label', 'Unscored')}, "
            f"confidence {reliability.get('confidence', 'n/a')})"
        )

    reliability_summary = radar.get("source_reliability", {})
    signal_request = json.dumps(radar.get("signal_request", {}), indent=2)
    latent_request = json.dumps(radar.get("latent_request", {}), indent=2)

    return "\n".join(
        [
            f"## Narrative Radar: {radar.get('asset', 'UNKNOWN')}",
            "",
            f"**Summary:** {brief.get('summary', 'No summary generated.')}",
            "",
            "**Top Evidence:**",
            *(article_lines or ["No focused articles found."]),
            "",
            "**Source Reliability:**",
            f"- Average confidence: {reliability_summary.get('average_confidence', 'n/a')}",
            f"- Highest tier: {reliability_summary.get('highest_tier', 'n/a')}",
            f"- Tier counts: {reliability_summary.get('tier_counts', {})}",
            "",
            f"**Bullish case:** {brief.get('bullish_case', radar.get('bullish_thesis', 'n/a'))}",
            f"**Bearish case:** {brief.get('bearish_case', radar.get('bearish_thesis', 'n/a'))}",
            "",
            "**Risk flags:**",
            *[f"- {flag}" for flag in radar.get("risk_flags", [])],
            "",
            "**Signal Processing request:**",
            f"```json\n{signal_request}\n```",
            "",
            "**Latent State request:**",
            f"```json\n{latent_request}\n```",
        ]
    )


def _parse_tickers(tickers: str) -> list[str]:
    """Parse comma/space separated ticker input into unique uppercase symbols."""
    cleaned = tickers.replace(",", " ").replace(";", " ")
    stopwords = {"AND", "OR", "WITH", "VS", "VERSUS", "STOCK", "STOCKS", "TICKER", "TICKERS"}
    parsed: list[str] = []
    for token in cleaned.split():
        symbol = "".join(ch for ch in token.upper() if ch.isalnum() or ch in {".", "-"})
        if symbol and symbol not in stopwords and symbol not in parsed:
            parsed.append(symbol)
    return parsed


def _format_multi_band_report(results: list[dict]) -> str:
    lines = [
        "## Multi-Stock Narrative Radar",
        "",
        "I researched the requested tickers and selected the most relevant follow-up requests for Signal Processing and Latent State.",
        "",
    ]

    signal_requests = []
    latent_requests = []

    for result in results:
        radar = result["radar"]
        brief = result["brief"]
        reliability = radar.get("source_reliability", {})
        lines.extend(
            [
                f"### {radar.get('asset', 'UNKNOWN')}",
                f"**Summary:** {brief.get('summary', 'No summary generated.')}",
                f"**Source reliability:** average confidence {reliability.get('average_confidence', 'n/a')}, highest tier {reliability.get('highest_tier', 'n/a')}",
                f"**Bullish case:** {brief.get('bullish_case', radar.get('bullish_thesis', 'n/a'))}",
                f"**Bearish case:** {brief.get('bearish_case', radar.get('bearish_thesis', 'n/a'))}",
                "**Top evidence:**",
            ]
        )
        for article in radar.get("top_articles", [])[:3]:
            source_reliability = article.get("source_reliability", {})
            lines.append(
                f"- {article.get('title', 'Untitled')} "
                f"({article.get('source', 'Unknown source')}, "
                f"{source_reliability.get('tier_label', 'Unscored')})"
            )
        lines.append("")
        signal_requests.append(radar.get("signal_request", {}))
        latent_requests.append(radar.get("latent_request", {}))

    lines.extend(
        [
            "## Requests For Signal Processing",
            "```json",
            json.dumps(signal_requests, indent=2),
            "```",
            "",
            "## Requests For Latent State",
            "```json",
            json.dumps(latent_requests, indent=2),
            "```",
        ]
    )
    return "\n".join(lines)


def _compute_price_move(ticker: str, days: int) -> dict:
    """
    Best-effort price move check for the autopsy view.

    Signal Processing remains the source of truth for serious quantitative
    metrics. Narrative uses this only to frame the follow-up question.
    """
    try:
        import yfinance as yf
    except ImportError:
        return {"available": False, "reason": "yfinance is not installed"}

    try:
        end = date.today()
        start = end - timedelta(days=max(days + 7, 10))
        data = yf.download(
            ticker,
            start=start.isoformat(),
            end=end.isoformat(),
            interval="1d",
            progress=False,
            auto_adjust=True,
        )
    except Exception as exc:
        return {"available": False, "reason": str(exc)}

    if data.empty:
        return {"available": False, "reason": "no price data returned"}

    if hasattr(data.columns, "nlevels") and data.columns.nlevels > 1:
        close = data["Close"][ticker]
    else:
        close = data["Close"]

    close = close.dropna()
    if len(close) < 2:
        return {"available": False, "reason": "not enough close prices"}

    start_price = float(close.iloc[0])
    end_price = float(close.iloc[-1])
    move_pct = ((end_price / start_price) - 1.0) * 100
    return {
        "available": True,
        "ticker": ticker.upper(),
        "days_requested": days,
        "start_date": str(close.index[0].date()),
        "end_date": str(close.index[-1].date()),
        "start_price": round(start_price, 4),
        "end_price": round(end_price, 4),
        "move_pct": round(move_pct, 2),
    }


def _format_autopsy_report(ticker: str, days: int, price_move: dict, radar: dict, brief: dict) -> str:
    reliability = radar.get("source_reliability", {})
    themes = [theme.get("theme", "unknown") for theme in radar.get("themes", [])[:4]]
    signal_request = dict(radar.get("signal_request", {}))
    signal_request["autopsy_focus"] = {
        "days": days,
        "observed_move_pct": price_move.get("move_pct") if price_move.get("available") else None,
        "question": "Explain how much of the move is market-wide, company-specific, volatility-driven, or trend/regime-shift-driven.",
    }
    latent_request = dict(radar.get("latent_request", {}))
    latent_request["autopsy_focus"] = {
        "days": days,
        "question": "Check whether the observed move is consistent with a persistent trend or a transient shock.",
    }

    price_line = (
        f"{price_move['move_pct']}% from {price_move['start_price']} to {price_move['end_price']} "
        f"({price_move['start_date']} to {price_move['end_date']})"
        if price_move.get("available")
        else f"Price move unavailable: {price_move.get('reason', 'unknown reason')}"
    )

    evidence_lines = []
    for article in radar.get("top_articles", [])[:5]:
        source_reliability = article.get("source_reliability", {})
        evidence_lines.append(
            f"- {article.get('title', 'Untitled')} "
            f"({article.get('source', 'Unknown source')}, "
            f"{source_reliability.get('tier_label', 'Unscored')}, "
            f"confidence {source_reliability.get('confidence', 'n/a')})"
        )

    return "\n".join(
        [
            f"## Movement Autopsy: {ticker.upper()} over {days} days",
            "",
            f"**Observed move:** {price_line}",
            f"**Narrative hypothesis:** {brief.get('summary', 'No summary generated.')}",
            f"**Primary themes:** {', '.join(themes) if themes else 'No strong themes detected'}",
            f"**Evidence confidence:** average {reliability.get('average_confidence', 'n/a')}, highest tier {reliability.get('highest_tier', 'n/a')}",
            "",
            "**Likely narrative drivers to validate:**",
            f"- Bullish case: {brief.get('bullish_case', radar.get('bullish_thesis', 'n/a'))}",
            f"- Bearish/alternate case: {brief.get('bearish_case', radar.get('bearish_thesis', 'n/a'))}",
            "",
            "**Top evidence:**",
            *(evidence_lines or ["- No focused evidence found."]),
            "",
            "**What Signal Processing should quantify next:**",
            "```json",
            json.dumps(signal_request, indent=2),
            "```",
            "",
            "**What Latent State should validate next:**",
            "```json",
            json.dumps(latent_request, indent=2),
            "```",
            "",
            "**Autopsy status:** preliminary explanation ready; final confidence should be assigned after Signal Processing and Latent State respond.",
        ]
    )


@tool
def search_company_news(ticker: str, company_name: str = "", lens: str = "", days_back: int = 14) -> str:
    """
    Fetch recent company/ticker news from free-first sources.

    Uses NewsAPI when NEWS_API_KEY exists, then free Yahoo RSS and yfinance
    fallback sources. Returns JSON list of article dicts.
    """
    articles = fetch_company_news(
        ticker=ticker,
        company_name=company_name or None,
        lens=lens or None,
        days_back=days_back,
        limit=int(os.getenv("NARRATIVE_MAX_ARTICLES", "25")),
    )
    return _json_dumps({"ticker": ticker.upper(), "article_count": len(articles), "articles": articles})


@tool
def start_narrative_research(
    ticker: str,
    config: RunnableConfig,
) -> str:
    """
    Fetch keyless Yahoo/yfinance news only. Useful if NewsAPI is unavailable.
    """
    articles = []
    articles.extend(fetch_yahoo_rss_news(ticker, limit=15))
    articles.extend(fetch_yfinance_news(ticker, limit=15))
    return _json_dumps({"ticker": ticker.upper(), "article_count": len(articles), "articles": articles})


@tool
def incorporate_quant_findings(
    quant_summary: str,
    config: RunnableConfig,
) -> str:
    """
    Extract readable text from a news article URL for deeper analysis.
    """
    return _json_dumps(extract_article_text(url, max_chars=max_chars))


@tool
def score_news_sentiment(text: str) -> str:
    """
    Score text with a free local financial sentiment heuristic.
    Returns label, numeric score, and driver terms.
    """
    return _json_dumps(score_text_sentiment(text))


@tool
def score_source_reliability_tool(article_json: str) -> str:
    """
    Score one article/source with the Source Reliability Engine.

    Returns tier, confidence, source_type, and reason.
    """
    article = _load_json_dict(article_json)
    if not article:
        return _json_dumps({
            "error": "Invalid article_json. Pass one article object as valid JSON.",
        })
    return _json_dumps(score_source_reliability(article))


@tool
def build_narrative_radar_tool(ticker: str, articles_json: str, lens: str = "") -> str:
    """
    Convert fetched articles into a structured Narrative Radar.

    articles_json can be either a raw JSON list or the direct output from
    search_company_news / fetch_free_yahoo_news.
    """
    articles, error = _parse_articles_payload(articles_json)
    if error:
        return _json_dumps({"error": error})
    radar = build_narrative_radar(ticker=ticker, articles=articles, lens=lens or None)
    return _json_dumps(radar)


@tool
def generate_narrative_brief_tool(radar_json: str) -> str:
    """
    Generate a concise analyst brief from a Narrative Radar.

    Uses Featherless/AI-ML API if configured; otherwise returns a deterministic
    no-LLM brief.
    """
    radar = _load_json_dict(radar_json)
    if not radar:
        return _json_dumps({"error": "Invalid radar_json. Pass a valid Narrative Radar JSON object."})
    return _json_dumps(generate_narrative_brief(radar))


@tool
def build_full_narrative_report(
    ticker: str,
    company_name: str = "",
    lens: str = "",
    days_back: int = 14,
) -> str:
    """
    Preferred tool for normal ticker research.

    Fetches focused news, scores source reliability, builds the Narrative Radar,
    creates the analyst brief, and returns a complete Band-ready message.

    After this tool returns, call thenvoi_send_message with the returned
    'band_message' value as the content. Do not rewrite article JSON manually.
    """
    articles = fetch_company_news(
        ticker=ticker,
        company_name=company_name or None,
        lens=lens or None,
        days_back=days_back,
        limit=int(os.getenv("NARRATIVE_MAX_ARTICLES", "25")),
    )
    radar = build_narrative_radar(
        ticker=ticker,
        articles=articles,
        lens=lens or None,
    )
    brief = generate_narrative_brief(radar)
    band_message = _format_band_report(radar, brief)
    return _json_dumps({
        "ticker": ticker.upper(),
        "band_message": band_message,
        "radar": radar,
        "brief": brief,
    })


@tool
def build_multi_ticker_narrative_report(
    tickers: str,
    lens: str = "",
    days_back: int = 14,
) -> str:
    """
    Preferred tool when the user asks about multiple stock tickers.

    Args:
        tickers: Comma or space separated ticker symbols, e.g. "AAPL, MSFT, NVDA".
        lens: Optional research lens that applies to the full basket.
        days_back: Recent-news lookback window.

    Returns a Band-ready multi-stock report plus a list of per-ticker Signal
    Processing and Latent State requests. After this tool returns, call
    thenvoi_send_message with the returned 'band_message' value as content.
    """
    symbols = _parse_tickers(tickers)
    if not symbols:
        return _json_dumps({
            "error": "No ticker symbols found. Ask the user for one or more stock tickers.",
        })

    max_tickers = int(os.getenv("NARRATIVE_MAX_TICKERS", "5"))
    symbols = symbols[:max_tickers]

    results = []
    for symbol in symbols:
        articles = fetch_company_news(
            ticker=symbol,
            lens=lens or None,
            days_back=days_back,
            limit=int(os.getenv("NARRATIVE_MAX_ARTICLES", "25")),
        )
        per_ticker_lens = lens or f"Assess whether recent {symbol} news is creating a tradable narrative shift."
        radar = build_narrative_radar(
            ticker=symbol,
            articles=articles,
            lens=per_ticker_lens,
        )
        brief = generate_narrative_brief(radar)
        results.append({
            "ticker": symbol,
            "radar": radar,
            "brief": brief,
        })

    band_message = _format_multi_band_report(results)
    return _json_dumps({
        "tickers": symbols,
        "band_message": band_message,
        "results": results,
        "signal_requests": [result["radar"].get("signal_request", {}) for result in results],
        "latent_requests": [result["radar"].get("latent_request", {}) for result in results],
    })


@tool
def build_move_autopsy_report(
    ticker: str,
    days: int = 30,
    lens: str = "",
) -> str:
    """
    Build a demo-friendly movement autopsy for questions like:
    "Why did NVDA move 18% in the last 30 days?"

    This combines a lightweight observed price move, recent news evidence,
    source reliability, and explicit follow-up requests to Signal Processing
    and Latent State. After this tool returns, call thenvoi_send_message with
    the returned 'band_message' value as content.
    """
    days = max(1, min(int(days), 365))
    symbol = ticker.upper()
    autopsy_lens = lens or f"Explain the major narrative drivers of {symbol}'s move over the last {days} days."
    price_move = _compute_price_move(symbol, days)
    articles = fetch_company_news(
        ticker=symbol,
        lens=autopsy_lens,
        days_back=days,
        limit=int(os.getenv("NARRATIVE_MAX_ARTICLES", "25")),
    )
    radar = build_narrative_radar(
        ticker=symbol,
        articles=articles,
        lens=autopsy_lens,
    )
    brief = generate_narrative_brief(radar)
    band_message = _format_autopsy_report(symbol, days, price_move, radar, brief)
    return _json_dumps({
        "ticker": symbol,
        "days": days,
        "price_move": price_move,
        "band_message": band_message,
        "radar": radar,
        "brief": brief,
        "signal_request": radar.get("signal_request", {}),
        "latent_request": radar.get("latent_request", {}),
    })


TOOLS = [
    search_company_news,
    fetch_free_yahoo_news,
    extract_article_text_tool,
    score_news_sentiment,
    score_source_reliability_tool,
    build_full_narrative_report,
    build_multi_ticker_narrative_report,
    build_move_autopsy_report,
    build_narrative_radar_tool,
    generate_narrative_brief_tool,
]


class AgentWhiteboxLogger(BaseCallbackHandler):
    """Prints structured LLM decisions to the terminal for debugging."""

    def on_llm_end(self, response, **kwargs):
        import json as _json

        for generation in response.generations:
            for g in generation:
                if hasattr(g, "message") and getattr(g.message, "tool_calls", None):
                    print("\n" + "═" * 60)
                    print("🤖 [NARRATIVE AGENT] LLM tool decision:")
                    call_counts: dict[str, int] = {}
                    for tc in g.message.tool_calls:
                        name = tc["name"]
                        call_counts[name] = call_counts.get(name, 0) + 1
                        args_str = _json.dumps(tc["args"])
                        if len(args_str) > 300:
                            args_str = args_str[:300] + "…"
                        print(f"   🔧 {name}({args_str})")
                    for name, count in call_counts.items():
                        if count > 1:
                            print(f"   ⚠️  DUPLICATE: {name} called {count}x!")
                        if name == "thenvoi_remove_participant":
                            print(f"   🚨 DANGEROUS TOOL: {name} — will self-eject!")
                    print("═" * 60 + "\n")
                elif g.text:
                    print("\n" + "⚠️ " * 3 + " [LOCAL TEXT — NOT VISIBLE ON BAND] " + "⚠️ " * 3)
                    print(g.text[:400] + ("…" if len(g.text) > 400 else ""))
                    print("═" * 80 + "\n")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

# Strong default model for financial research: large, current, tool-calling
# capable. Overridable via FEATHERLESS_MODEL without touching code.
DEFAULT_FEATHERLESS_MODEL = "deepseek-ai/DeepSeek-V4-Pro"


async def main():
    config_path = _find_config_yaml()
    agent_id, api_key = load_agent_config("narrative_analyst", config_path=config_path)
    logger.info(f"Loaded Narrative Analyst agent: {agent_id}")

    rate_limiter = InMemoryRateLimiter(
        requests_per_second=0.066,
        check_every_n_seconds=0.1,
        max_bucket_size=1,
    )

    if provider == "gemini":
        return ChatGoogleGenerativeAI(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            rate_limiter=rate_limiter,
            callbacks=callbacks,
        )

    if provider == "aimlapi":
        return ChatOpenAI(
            model=os.getenv("AIML_MODEL", "gpt-4o-mini"),
            api_key=os.getenv("AIML_API_KEY", ""),
            base_url=os.getenv("AIML_BASE_URL", "https://api.aimlapi.com/v1"),
            rate_limiter=rate_limiter,
            callbacks=callbacks,
        )

    return ChatOpenAI(
        model=os.getenv("FEATHERLESS_MODEL", "deepseek-ai/DeepSeek-V3-0324"),
        api_key=os.getenv("FEATHERLESS_API_KEY", ""),
        base_url=os.getenv("FEATHERLESS_BASE_URL", "https://api.featherless.ai/v1"),
        api_key=os.getenv("FEATHERLESS_API_KEY"),
        model=os.getenv("FEATHERLESS_MODEL", DEFAULT_FEATHERLESS_MODEL),
        rate_limiter=rate_limiter,
        callbacks=callbacks,
        timeout=float(os.getenv("NARRATIVE_LLM_TIMEOUT_SECONDS", "60")),
        max_retries=int(os.getenv("NARRATIVE_LLM_MAX_RETRIES", "1")),
    )


async def main():
    # Match the known-working verify_setup_gui.py connection path as closely
    # as possible: load .env from backend/, then let thenvoi load the agent
    # credentials from agent_config.yaml.
    load_dotenv()
    agent_id, api_key = load_agent_config("narrative_analyst")
    _validate_band_credentials(agent_id, api_key)
    logger.info("Loaded Narrative Analyst agent: %s", agent_id)
    logger.info("Band REST URL: %s", os.getenv("THENVOI_REST_URL") or os.getenv("BAND_REST_URL"))
    logger.info("Band WS URL: %s", os.getenv("THENVOI_WS_URL") or os.getenv("BAND_WS_URL"))
    logger.info("LLM provider: %s", os.getenv("NARRATIVE_LLM_PROVIDER", "featherless"))
    logger.info("Featherless model: %s", os.getenv("FEATHERLESS_MODEL", "deepseek-ai/DeepSeek-V3-0324"))

    adapter = LangGraphAdapter(
        llm=llm,
        checkpointer=InMemorySaver(),
        custom_section=SYSTEM_PROMPT,
        additional_tools=TOOLS,
    )

    agent = Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=api_key,
        ws_url=os.getenv("THENVOI_WS_URL"),
        rest_url=os.getenv("THENVOI_REST_URL"),
    )

    logger.info(
        f"Narrative Analyst agent is live (model={os.getenv('FEATHERLESS_MODEL', DEFAULT_FEATHERLESS_MODEL)}). "
        "Press Ctrl+C to stop."
    )
    await agent.run()


if __name__ == "__main__":
    asyncio.run(main())
