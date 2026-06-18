"""Universal adapter — forwards Band room messages into InMemoryEventBus.

Two usage modes:

1. Direct emit (any specialist agent calls this):

       from agents.executive.band_adapter import emit_agent_event
       await emit_agent_event(bus, session_id, "signal_processing", "narrative_analyst", text)

2. BandStreamAdapter — mount on a Band WebSocket and auto-forward:

       adapter = BandStreamAdapter(bus, session_id, agent_id_map)
       # In your Band on_message handler:
       await adapter.forward_message(sender_id=msg.sender_id, text=msg.text, ticker="AAPL")

This module imports only from the executive package (events, schemas) and from
the Python standard library. It does NOT import from Band, yfinance, or any
specialist agent — so it can be added to any branch without side effects.
"""

from __future__ import annotations

import logging
import re
from typing import Any

from .events import InMemoryEventBus
from .schemas import AgentPromptEvent, WorkflowAgent

logger = logging.getLogger(__name__)

# Matches @mention of any known agent role in a Band message body
_MENTION_RE = re.compile(
    r"@(executive|narrative_analyst|signal_processing|latent_state)\b",
    re.IGNORECASE,
)

# Keyword → kind heuristics (checked in order)
_KIND_HINTS: list[tuple[str, str]] = [
    ("request:", "prompt"),
    ("analysis request", "prompt"),
    ("please compute", "prompt"),
    ("summary:", "summary"),
    ("final summary", "summary"),
    ("findings:", "response"),
    ("result:", "response"),
    ("kalman", "response"),
]


def _infer_kind(text: str) -> str:
    lower = text.lower()
    for hint, kind in _KIND_HINTS:
        if hint in lower:
            return kind
    return "response"


async def emit_agent_event(
    bus: InMemoryEventBus,
    session_id: str,
    from_agent: WorkflowAgent,
    to_agent: WorkflowAgent,
    text: str,
    kind: str = "response",
    ticker: str | None = None,
    metadata: dict[str, Any] | None = None,
    round_number: int = 1,
) -> None:
    """Push one event into the shared bus.

    Any specialist agent can call this directly to make its output visible
    in the frontend SSE stream without going through the orchestrator.

    Args:
        bus: The InMemoryEventBus from agents.executive.events.
        session_id: Active session ID (from ExecutiveRunRequest flow).
        from_agent: The agent emitting this event.
        to_agent: The agent this message is addressed to.
        text: Human-readable message body.
        kind: "prompt" | "response" | "summary" | "status" | "report".
        ticker: Optional ticker symbol if this event is ticker-specific.
        metadata: Arbitrary structured data (metrics, price payloads, etc.).
        round_number: Current deliberation round (default 1).
    """
    await bus.publish(
        AgentPromptEvent(
            session_id=session_id,
            round=round_number,
            from_agent=from_agent,
            to_agent=to_agent,
            ticker=ticker,
            kind=kind,
            text=text,
            metadata=metadata or {},
        )
    )
    logger.debug("emit_agent_event: %s → %s [%s] session=%s", from_agent, to_agent, kind, session_id[:8])


class BandStreamAdapter:
    """Parses incoming Band room messages and forwards them as AgentPromptEvents.

    Designed for the case where specialist agents run as live Band bots (rather
    than local adapters) and you want their conversational output mirrored into
    the frontend SSE stream in real time.

    The adapter resolves sender UUID → WorkflowAgent role using agent_id_map
    (which should match agent_config.yaml), extracts the @mention target from
    the message body, and infers event kind from heuristic keywords.

    Example setup in api.py (when USE_BAND=true):
        from agents.executive.band_adapter import BandStreamAdapter
        from shared.config import load_agent_config

        cfg = load_agent_config()
        agent_id_map = {
            str(cfg["narrative_analyst"]["agent_id"]): "narrative_analyst",
            str(cfg["signal_processing"]["agent_id"]): "signal_processing",
            str(cfg["latent_state"]["agent_id"]): "latent_state",
        }
        adapter = BandStreamAdapter(event_bus, session_id, agent_id_map)

        @band_agent.on_message
        async def handle(msg):
            await adapter.forward_message(
                sender_id=str(msg.sender_id),
                text=msg.text,
                ticker=_extract_ticker(msg.text),
            )
    """

    def __init__(
        self,
        bus: InMemoryEventBus,
        session_id: str,
        agent_id_map: dict[str, WorkflowAgent],
    ) -> None:
        self.bus = bus
        self.session_id = session_id
        self.agent_id_map = agent_id_map

    def _resolve_sender(self, agent_id: str) -> WorkflowAgent:
        return self.agent_id_map.get(agent_id, "executive")

    def _extract_recipient(self, text: str) -> WorkflowAgent:
        match = _MENTION_RE.search(text)
        if match:
            return match.group(1).lower()  # type: ignore[return-value]
        return "executive"

    async def forward_message(
        self,
        sender_id: str,
        text: str,
        ticker: str | None = None,
        round_number: int = 1,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Forward one Band room message into the event bus.

        Call this from your Band @agent.on_message callback. The method
        resolves from/to agents automatically and infers the event kind.

        Args:
            sender_id: Band agent UUID string (matched against agent_id_map).
            text: Raw Band message text.
            ticker: Ticker symbol if known (e.g. extracted from message context).
            round_number: Current deliberation round.
            metadata: Extra structured payload to attach to the event.
        """
        from_agent = self._resolve_sender(sender_id)
        to_agent = self._extract_recipient(text)
        kind = _infer_kind(text)

        await emit_agent_event(
            bus=self.bus,
            session_id=self.session_id,
            from_agent=from_agent,
            to_agent=to_agent,
            text=text,
            kind=kind,
            ticker=ticker,
            metadata=metadata,
            round_number=round_number,
        )
