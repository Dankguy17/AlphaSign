"""Executive agent request/response models.

These models are intentionally local to the executive package so the frontend
adapter can evolve without changing the packet contract used by specialist
agents in ``shared.schemas``.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


SpecialistAgent = Literal["narrative_analyst", "signal_processing", "latent_state"]
WorkflowAgent = Literal["executive", "narrative_analyst", "signal_processing", "latent_state"]


class ExecutiveRunRequest(BaseModel):
    """Payload submitted by the GUI after the user selects ticker(s)."""

    tickers: list[str] = Field(..., min_length=1)
    max_deliberations: int = Field(default=2, ge=1, le=8)
    user_instruction: str | None = None

    @field_validator("tickers")
    @classmethod
    def normalize_tickers(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for ticker in value:
            clean = ticker.strip().upper()
            if not clean:
                continue
            if clean not in seen:
                normalized.append(clean)
                seen.add(clean)
        if not normalized:
            raise ValueError("At least one non-empty ticker is required")
        return normalized


class AgentPromptEvent(BaseModel):
    """A graph/display event emitted whenever one agent prompts another."""

    session_id: str
    round: int
    from_agent: WorkflowAgent
    to_agent: WorkflowAgent
    ticker: str | None = None
    kind: Literal["status", "prompt", "response", "summary", "report"] = "prompt"
    text: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = Field(default_factory=dict)


class NarrativeTurn(BaseModel):
    ticker: str
    round: int
    research_summary: str
    signal_request: str
    updated_focus: str


class SignalTurn(BaseModel):
    ticker: str
    round: int
    window: str
    metrics: dict[str, Any]
    price_payload: dict[str, Any]
    response_to_narrative: str
    latent_request: str


class LatentTurn(BaseModel):
    ticker: str
    round: int
    kalman: dict[str, Any]
    summary: str


class DeliberationRound(BaseModel):
    ticker: str
    round: int
    narrative: NarrativeTurn
    signal: SignalTurn
    latent: LatentTurn


class AgentSummary(BaseModel):
    agent: SpecialistAgent
    ticker: str
    summary: str
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)


class ExecutiveReport(BaseModel):
    session_id: str = Field(default_factory=lambda: uuid4().hex)
    tickers: list[str]
    max_deliberations: int
    rounds: list[DeliberationRound]
    agent_summaries: list[AgentSummary]
    executive_summary: str
    pdf_path: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def pdf_file(self) -> Path:
        return Path(self.pdf_path)


class ExecutiveSessionStatus(BaseModel):
    session_id: str
    status: Literal["queued", "running", "complete", "failed"]
    tickers: list[str]
    max_deliberations: int
    report_path: str | None = None
    error: str | None = None
