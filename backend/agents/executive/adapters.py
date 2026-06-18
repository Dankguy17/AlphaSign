"""Specialist-agent adapters used by the executive orchestrator."""

from __future__ import annotations

from typing import Any, Protocol

from .schemas import AgentSummary, LatentTurn, NarrativeTurn, SignalTurn


class NarrativeAnalystAdapter(Protocol):
    async def research(self, ticker: str, round_number: int, instruction: str, context: str | None) -> NarrativeTurn:
        """Research a ticker and produce the next request for signal processing."""

    async def summarize(self, ticker: str, rounds: list[Any]) -> AgentSummary:
        """Return the final narrative summary for the report."""


class SignalProcessingAdapter(Protocol):
    async def analyze(self, narrative: NarrativeTurn, context: str | None) -> SignalTurn:
        """Run price calculations requested by the narrative analyst."""

    async def summarize(self, ticker: str, rounds: list[Any]) -> AgentSummary:
        """Return the final signal-processing summary for the report."""


class LatentSpaceAdapter(Protocol):
    async def analyze(self, signal: SignalTurn, context: str | None) -> LatentTurn:
        """Run latent-state calculations over the signal agent's fetched data."""

    async def summarize(self, ticker: str, rounds: list[Any]) -> AgentSummary:
        """Return the final latent-space summary for the report."""


class LocalNarrativeAnalystAdapter:
    """MVP adapter for the not-yet-merged Narrative/News Analyst agent."""

    async def research(self, ticker: str, round_number: int, instruction: str, context: str | None) -> NarrativeTurn:
        if context:
            focus = (
                f"Update the research focus for {ticker} using the latest quantitative and latent-state feedback. "
                "Prioritize whether new price behavior confirms or weakens the original market narrative."
            )
        else:
            focus = (
                f"Research recent company, sector, and macro narratives for {ticker}. "
                "Identify catalysts, downside risks, and the historical window most likely to validate them."
            )

        research_summary = (
            f"{ticker}: local narrative adapter prepared a research brief for round {round_number}. "
            f"Instruction: {instruction.strip() or 'perform general equity risk research'}. "
            f"{'Context received: ' + context if context else 'No prior specialist context has been received yet.'}"
        )
        signal_request = (
            f"For {ticker}, test whether recent price action supports the narrative focus: {focus} "
            "Compute return, realized volatility, beta, market-adjusted return, and idiosyncratic volatility. "
            "Choose a window appropriate to the catalyst horizon."
        )

        return NarrativeTurn(
            ticker=ticker,
            round=round_number,
            research_summary=research_summary,
            signal_request=signal_request,
            updated_focus=focus,
        )

    async def summarize(self, ticker: str, rounds: list[Any]) -> AgentSummary:
        latest = rounds[-1].narrative if rounds else None
        body = latest.research_summary if latest else f"No narrative rounds completed for {ticker}."
        return AgentSummary(
            agent="narrative_analyst",
            ticker=ticker,
            summary=(
                f"The narrative analyst framed {ticker} around observable catalysts and refined the research "
                f"focus over {len(rounds)} deliberation round(s). {body}"
            ),
            confidence=0.62,
        )


class LocalSignalProcessingAdapter:
    """Adapter that reuses the completed signal-processing math locally."""

    async def analyze(self, narrative: NarrativeTurn, context: str | None) -> SignalTurn:
        from agents.signal_processing.calculations import compute_all
        from agents.signal_processing.data_fetch import fetch_market_series, fetch_price_series

        window = _choose_window(narrative.signal_request, context)
        asset_df = fetch_price_series(narrative.ticker, window)
        market_df = fetch_market_series(window)
        metrics = compute_all(asset_df["close"], market_df["close"])
        rounded_metrics = {key: round(float(value), 6) for key, value in metrics.items()}
        price_payload = _price_payload(narrative.ticker, window, asset_df)

        response = (
            f"Signal Processing analyzed {narrative.ticker} over {window}. "
            f"Latest log return is {rounded_metrics['log_return']}, volatility is {rounded_metrics['volatility']}, "
            f"beta is {rounded_metrics['beta']}, and market-adjusted return is "
            f"{rounded_metrics['market_adjusted_return']}. These metrics address the narrative request: "
            f"{narrative.signal_request}"
        )
        latent_request = (
            f"Latent Space: use the {window} price series fetched for {narrative.ticker} to estimate the hidden "
            "trend, one-step forecast, noise variance, and possible structural regime shift. "
            f"Interpret the Kalman results against this narrative context: {narrative.updated_focus}"
        )

        return SignalTurn(
            ticker=narrative.ticker,
            round=narrative.round,
            window=window,
            metrics=rounded_metrics,
            price_payload=price_payload,
            response_to_narrative=response,
            latent_request=latent_request,
        )

    async def summarize(self, ticker: str, rounds: list[Any]) -> AgentSummary:
        if not rounds:
            return AgentSummary(agent="signal_processing", ticker=ticker, summary="No signal rounds completed.", confidence=0.0)

        latest = rounds[-1].signal
        metrics = latest.metrics
        summary = (
            f"Across {len(rounds)} deliberation round(s), Signal Processing most recently used a {latest.window} "
            f"window for {ticker}. Latest metrics: log_return={metrics.get('log_return')}, "
            f"volatility={metrics.get('volatility')}, beta={metrics.get('beta')}, "
            f"market_adjusted_return={metrics.get('market_adjusted_return')}, "
            f"idiosyncratic_vol={metrics.get('idiosyncratic_vol')}."
        )
        return AgentSummary(agent="signal_processing", ticker=ticker, summary=summary, confidence=0.74)


class LocalLatentSpaceAdapter:
    """Adapter that reuses the merged latent-state Kalman utilities locally."""

    async def analyze(self, signal: SignalTurn, context: str | None) -> LatentTurn:
        from agents.latent_state.calculations import prediction_from_payload

        kalman = prediction_from_payload(signal.price_payload)
        summary = (
            f"Latent Space computed a Kalman trend for {signal.ticker} over {signal.window}. "
            f"The filtered trend slope is {kalman.get('kalman_trend_slope')}, predicted next return is "
            f"{kalman.get('predicted_next_return')}, noise variance is {kalman.get('noise_variance')}, and "
            f"structural_regime_shift={kalman.get('structural_regime_shift')}. "
            f"Context: {signal.latent_request}"
        )
        return LatentTurn(ticker=signal.ticker, round=signal.round, kalman=kalman, summary=summary)

    async def summarize(self, ticker: str, rounds: list[Any]) -> AgentSummary:
        if not rounds:
            return AgentSummary(agent="latent_state", ticker=ticker, summary="No latent-state rounds completed.", confidence=0.0)

        latest = rounds[-1].latent
        kalman = latest.kalman
        summary = (
            f"Latent Space found a latest Kalman trend slope of {kalman.get('kalman_trend_slope')} for {ticker}, "
            f"with predicted_next_return={kalman.get('predicted_next_return')}, "
            f"latest_innovation_z={kalman.get('latest_innovation_z')}, and "
            f"structural_regime_shift={kalman.get('structural_regime_shift')}."
        )
        return AgentSummary(agent="latent_state", ticker=ticker, summary=summary, confidence=0.7)


def _choose_window(prompt: str, context: str | None) -> str:
    text = f"{prompt} {context or ''}".lower()
    if any(token in text for token in ("multi-year", "structural", "macro", "rate", "inflation")):
        return "1Y"
    if any(token in text for token in ("quarter", "earnings", "medium", "sector")):
        return "6M"
    if any(token in text for token in ("shock", "launch", "short", "recent")):
        return "3M"
    return "6M"


def _price_payload(ticker: str, window: str, asset_df: Any) -> dict[str, Any]:
    prices = [
        {"date": str(index.date()), "close": round(float(value), 4)}
        for index, value in asset_df["close"].items()
    ]
    return {
        "ticker": ticker,
        "window": window,
        "start": str(asset_df.attrs["start"]),
        "end": str(asset_df.attrs["end"]),
        "prices": prices,
    }
