"""Executive agent orchestration loop."""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from uuid import uuid4

from .adapters import (
    LatentSpaceAdapter,
    LocalLatentSpaceAdapter,
    LocalNarrativeAnalystAdapter,
    LocalSignalProcessingAdapter,
    NarrativeAnalystAdapter,
    SignalProcessingAdapter,
)
from .events import EventSink
from .pdf import ReportSection, write_pdf_report
from .schemas import (
    AgentPromptEvent,
    AgentSummary,
    DeliberationRound,
    ExecutiveReport,
    ExecutiveRunRequest,
)


class ExecutiveAgent:
    """Coordinates deliberations and produces the final downloadable report."""

    def __init__(
        self,
        event_sink: EventSink,
        narrative: NarrativeAnalystAdapter | None = None,
        signal: SignalProcessingAdapter | None = None,
        latent: LatentSpaceAdapter | None = None,
        output_dir: Path | str = "artifacts/executive_reports",
    ) -> None:
        self.event_sink = event_sink
        self.narrative = narrative or LocalNarrativeAnalystAdapter()
        self.signal = signal or LocalSignalProcessingAdapter()
        self.latent = latent or LocalLatentSpaceAdapter()
        self.output_dir = Path(output_dir)

    async def run(self, request: ExecutiveRunRequest, session_id: str | None = None) -> ExecutiveReport:
        session_id = session_id or uuid4().hex
        rounds: list[DeliberationRound] = []

        await self._emit(
            session_id=session_id,
            round_number=0,
            from_agent="executive",
            to_agent="narrative_analyst",
            kind="prompt",
            text=(
                "Executive Agent received GUI submission for "
                f"{', '.join(request.tickers)}. Begin narrative/news research and prepare signal requests."
            ),
            metadata={"tickers": request.tickers, "max_deliberations": request.max_deliberations},
        )

        context_by_ticker: dict[str, str | None] = {ticker: None for ticker in request.tickers}
        instruction = request.user_instruction or "Research the selected ticker(s) and identify actionable market-risk signals."

        for round_number in range(1, request.max_deliberations + 1):
            for ticker in request.tickers:
                context = context_by_ticker[ticker]

                narrative_turn = await self.narrative.research(ticker, round_number, instruction, context)
                await self._emit(
                    session_id,
                    round_number,
                    "narrative_analyst",
                    "signal_processing",
                    narrative_turn.signal_request,
                    kind="prompt",
                    ticker=ticker,
                    metadata={"research_summary": narrative_turn.research_summary},
                )

                signal_turn = await self.signal.analyze(narrative_turn, context)
                await self._emit(
                    session_id,
                    round_number,
                    "signal_processing",
                    "narrative_analyst",
                    signal_turn.response_to_narrative,
                    kind="response",
                    ticker=ticker,
                    metadata={"window": signal_turn.window, "metrics": signal_turn.metrics},
                )
                await self._emit(
                    session_id,
                    round_number,
                    "signal_processing",
                    "latent_state",
                    signal_turn.latent_request,
                    kind="prompt",
                    ticker=ticker,
                    metadata={"window": signal_turn.window, "price_points": len(signal_turn.price_payload.get("prices", []))},
                )

                latent_turn = await self.latent.analyze(signal_turn, signal_turn.latent_request)
                await self._emit(
                    session_id,
                    round_number,
                    "latent_state",
                    "narrative_analyst",
                    latent_turn.summary,
                    kind="response",
                    ticker=ticker,
                    metadata={"kalman": latent_turn.kalman},
                )

                rounds.append(
                    DeliberationRound(
                        ticker=ticker,
                        round=round_number,
                        narrative=narrative_turn,
                        signal=signal_turn,
                        latent=latent_turn,
                    )
                )
                context_by_ticker[ticker] = "\n".join(
                    [
                        narrative_turn.research_summary,
                        signal_turn.response_to_narrative,
                        latent_turn.summary,
                    ]
                )

        grouped_rounds: dict[str, list[DeliberationRound]] = defaultdict(list)
        for item in rounds:
            grouped_rounds[item.ticker].append(item)

        agent_summaries: list[AgentSummary] = []
        await self._emit(
            session_id,
            request.max_deliberations,
            "executive",
            "narrative_analyst",
            "Executive Agent requests final narrative summaries for the report.",
            kind="summary",
        )
        await self._emit(
            session_id,
            request.max_deliberations,
            "executive",
            "signal_processing",
            "Executive Agent requests final signal-processing summaries for the report.",
            kind="summary",
        )
        await self._emit(
            session_id,
            request.max_deliberations,
            "executive",
            "latent_state",
            "Executive Agent requests final latent-space summaries for the report.",
            kind="summary",
        )

        for ticker in request.tickers:
            ticker_rounds = grouped_rounds[ticker]
            agent_summaries.extend(
                [
                    await self.narrative.summarize(ticker, ticker_rounds),
                    await self.signal.summarize(ticker, ticker_rounds),
                    await self.latent.summarize(ticker, ticker_rounds),
                ]
            )

        executive_summary = self._synthesize(request.tickers, agent_summaries, rounds)
        pdf_path = self._write_report(session_id, request, executive_summary, agent_summaries, rounds)

        await self._emit(
            session_id,
            request.max_deliberations,
            "executive",
            "executive",
            f"Executive Agent combined all summaries into a professional PDF report: {pdf_path}",
            kind="report",
            metadata={"report_path": str(pdf_path)},
        )

        return ExecutiveReport(
            session_id=session_id,
            tickers=request.tickers,
            max_deliberations=request.max_deliberations,
            rounds=rounds,
            agent_summaries=agent_summaries,
            executive_summary=executive_summary,
            pdf_path=str(pdf_path),
        )

    async def _emit(
        self,
        session_id: str,
        round_number: int,
        from_agent: str,
        to_agent: str,
        text: str,
        *,
        kind: str = "prompt",
        ticker: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        await self.event_sink.publish(
            AgentPromptEvent(
                session_id=session_id,
                round=round_number,
                from_agent=from_agent,  # type: ignore[arg-type]
                to_agent=to_agent,  # type: ignore[arg-type]
                ticker=ticker,
                kind=kind,  # type: ignore[arg-type]
                text=text,
                metadata=metadata or {},
            )
        )

    def _synthesize(
        self,
        tickers: list[str],
        agent_summaries: list[AgentSummary],
        rounds: list[DeliberationRound],
    ) -> str:
        lines = [
            f"Executive synthesis for {', '.join(tickers)} after {len(rounds)} specialist deliberation(s)."
        ]
        for ticker in tickers:
            ticker_summaries = [summary for summary in agent_summaries if summary.ticker == ticker]
            latest_rounds = [item for item in rounds if item.ticker == ticker]
            latest = latest_rounds[-1] if latest_rounds else None
            if latest:
                lines.append(
                    f"{ticker}: latest signal window {latest.signal.window}; "
                    f"beta {latest.signal.metrics.get('beta')}; "
                    f"market-adjusted return {latest.signal.metrics.get('market_adjusted_return')}; "
                    f"Kalman slope {latest.latent.kalman.get('kalman_trend_slope')}; "
                    f"regime shift flag {latest.latent.kalman.get('structural_regime_shift')}."
                )
            for summary in ticker_summaries:
                lines.append(f"{summary.agent}: {summary.summary}")
        return "\n".join(lines)

    def _write_report(
        self,
        session_id: str,
        request: ExecutiveRunRequest,
        executive_summary: str,
        agent_summaries: list[AgentSummary],
        rounds: list[DeliberationRound],
    ) -> Path:
        sections = [
            ReportSection("Executive Summary", executive_summary),
            ReportSection("Workflow", self._workflow_section(request)),
            ReportSection("Agent Summaries", self._summary_section(agent_summaries)),
            ReportSection("Deliberation Detail", self._rounds_section(rounds)),
        ]
        return write_pdf_report(
            self.output_dir / f"{session_id}.pdf",
            title="AlphaSign Executive Report",
            subtitle=f"Tickers: {', '.join(request.tickers)} | Deliberations: {request.max_deliberations}",
            sections=sections,
        )

    @staticmethod
    def _workflow_section(request: ExecutiveRunRequest) -> str:
        return (
            "The Executive Agent accepted the GUI ticker submission, routed the research request to the "
            "Narrative/News Analyst, forwarded quantitative prompts to Signal Processing, requested Kalman "
            "latent-state trend analysis, repeated the loop up to the configured deliberation threshold, and "
            "then requested final summaries from all specialist agents."
            f"\nUser instruction: {request.user_instruction or 'None supplied'}"
        )

    @staticmethod
    def _summary_section(agent_summaries: list[AgentSummary]) -> str:
        return "\n".join(
            f"{summary.ticker} | {summary.agent} | confidence={summary.confidence}: {summary.summary}"
            for summary in agent_summaries
        )

    @staticmethod
    def _rounds_section(rounds: list[DeliberationRound]) -> str:
        lines: list[str] = []
        for item in rounds:
            lines.extend(
                [
                    f"{item.ticker} round {item.round}",
                    f"Narrative request: {item.narrative.signal_request}",
                    f"Signal response: {item.signal.response_to_narrative}",
                    f"Latent response: {item.latent.summary}",
                    "",
                ]
            )
        return "\n".join(lines)
