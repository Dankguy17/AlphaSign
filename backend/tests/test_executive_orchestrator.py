from __future__ import annotations

import asyncio
import tempfile
import unittest
from pathlib import Path

from agents.executive.events import InMemoryEventBus
from agents.executive.orchestrator import ExecutiveAgent
from agents.executive.schemas import (
    AgentSummary,
    ExecutiveRunRequest,
    LatentTurn,
    NarrativeTurn,
    SignalTurn,
)


class FakeNarrative:
    async def research(self, ticker: str, round_number: int, instruction: str, context: str | None) -> NarrativeTurn:
        return NarrativeTurn(
            ticker=ticker,
            round=round_number,
            research_summary=f"{ticker} narrative round {round_number}",
            signal_request=f"Analyze {ticker} for round {round_number}",
            updated_focus=f"{ticker} focus {round_number}",
        )

    async def summarize(self, ticker: str, rounds: list) -> AgentSummary:
        return AgentSummary(agent="narrative_analyst", ticker=ticker, summary=f"{ticker} narrative summary", confidence=0.8)


class FakeSignal:
    async def analyze(self, narrative: NarrativeTurn, context: str | None) -> SignalTurn:
        return SignalTurn(
            ticker=narrative.ticker,
            round=narrative.round,
            window="3M",
            metrics={
                "log_return": 0.01,
                "volatility": 0.02,
                "beta": 1.1,
                "market_adjusted_return": 0.003,
                "idiosyncratic_vol": 0.015,
            },
            price_payload={"ticker": narrative.ticker, "prices": [{"date": "2026-01-01", "close": 100.0}]},
            response_to_narrative=f"{narrative.ticker} signal response {narrative.round}",
            latent_request=f"{narrative.ticker} latent request {narrative.round}",
        )

    async def summarize(self, ticker: str, rounds: list) -> AgentSummary:
        return AgentSummary(agent="signal_processing", ticker=ticker, summary=f"{ticker} signal summary", confidence=0.7)


class FakeLatent:
    async def analyze(self, signal: SignalTurn, context: str | None) -> LatentTurn:
        return LatentTurn(
            ticker=signal.ticker,
            round=signal.round,
            kalman={"kalman_trend_slope": 0.4, "structural_regime_shift": False},
            summary=f"{signal.ticker} latent response {signal.round}",
        )

    async def summarize(self, ticker: str, rounds: list) -> AgentSummary:
        return AgentSummary(agent="latent_state", ticker=ticker, summary=f"{ticker} latent summary", confidence=0.6)


class ExecutiveOrchestratorTest(unittest.TestCase):
    def test_executive_runs_deliberations_and_writes_pdf(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            asyncio.run(self._run_executive_assertions(Path(temp_dir)))

    async def _run_executive_assertions(self, output_dir: Path):
        event_bus = InMemoryEventBus()
        executive = ExecutiveAgent(
            event_sink=event_bus,
            narrative=FakeNarrative(),
            signal=FakeSignal(),
            latent=FakeLatent(),
            output_dir=output_dir,
        )

        report = await executive.run(
            ExecutiveRunRequest(tickers=["aapl", "MSFT", "AAPL"], max_deliberations=2),
            session_id="test-session",
        )

        events = await event_bus.list_events("test-session")

        self.assertEqual(report.tickers, ["AAPL", "MSFT"])
        self.assertEqual(len(report.rounds), 4)
        self.assertEqual(len(report.agent_summaries), 6)
        self.assertTrue(report.pdf_file.exists())
        self.assertTrue(report.pdf_file.read_bytes().startswith(b"%PDF-1.4"))
        self.assertTrue(
            any(event.from_agent == "signal_processing" and event.to_agent == "latent_state" for event in events)
        )
        self.assertTrue(any(event.kind == "report" for event in events))


if __name__ == "__main__":
    unittest.main()
