"""Standalone chart data server for the AlphaSign frontend.

Serves yfinance price data + a lightweight Kalman filter (numpy-only, no
additional deps) for a given ticker and window. Run alongside the executive
API on a separate port:

    # Terminal 1 — main executive API
    uvicorn agents.executive.api:app --port 8000 --reload

    # Terminal 2 — chart server
    uvicorn chart_server:app --port 8001 --reload

The frontend (frontend/src/lib/api.ts) calls:
    GET http://localhost:8001/chart/{ticker}?window=6M

Response shape:
    {
      "ticker": "AAPL",
      "window": "6M",
      "prices": [{"date": "YYYY-MM-DD", "close": 123.45}, ...],
      "kalman": {
        "filtered_level": 123.45,
        "kalman_trend_slope": 0.12,
        "structural_regime_shift": false,
        "predicted_next_value": 123.57,
        "noise_variance": 0.001234,
        "latest_innovation_z": 1.23
      }
    }

This file is intentionally standalone — it does NOT import from agents.executive
or shared.schemas so it can be run from any branch.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta

import numpy as np
import yfinance as yf
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logger = logging.getLogger(__name__)

app = FastAPI(title="AlphaSign Chart Server", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

_WINDOW_TO_DAYS: dict[str, int] = {
    "1M": 30,
    "3M": 90,
    "4M": 120,
    "6M": 180,
    "1Y": 365,
    "2Y": 730,
}


@app.get("/chart/{ticker}")
def get_chart_data(ticker: str, window: str = "6M"):
    """Return daily close prices and Kalman state for the requested ticker/window."""
    days = _WINDOW_TO_DAYS.get(window.upper(), 180)
    end_dt = datetime.utcnow()
    start_dt = end_dt - timedelta(days=days)

    try:
        df = yf.download(
            ticker.upper(),
            start=start_dt.strftime("%Y-%m-%d"),
            end=end_dt.strftime("%Y-%m-%d"),
            progress=False,
            auto_adjust=True,
        )
    except Exception as exc:
        logger.error("yfinance error for %s: %s", ticker, exc)
        raise HTTPException(status_code=502, detail=f"yfinance error: {exc}") from exc

    if df.empty:
        raise HTTPException(status_code=404, detail=f"No price data found for {ticker!r}")

    closes = df["Close"]
    # yfinance 1.4+ returns MultiIndex columns even for single tickers;
    # df["Close"] is then a DataFrame with one column rather than a Series.
    if hasattr(closes, "columns"):
        closes = closes.iloc[:, 0]
    closes = closes.dropna()

    if len(closes) < 5:
        raise HTTPException(status_code=422, detail=f"Too few data points for {ticker!r}")

    prices = [
        {"date": d.strftime("%Y-%m-%d"), "close": round(float(v), 4)}
        for d, v in closes.items()
    ]

    kalman = _kalman_local_level(closes.to_numpy(dtype=float))

    return {
        "ticker": ticker.upper(),
        "window": window.upper(),
        "prices": prices,
        "kalman": kalman,
    }


def _kalman_local_level(observations: np.ndarray) -> dict:
    """Scalar local-level Kalman filter — numpy only, no pykalman required.

    Uses a fixed process/observation noise ratio estimated from the data.
    Returns summary statistics compatible with the KalmanPrediction schema
    in agents.latent_state.calculations.
    """
    n = len(observations)
    if n < 5:
        return {}

    diffs = np.diff(observations)
    q = max(float(np.var(diffs)), 1e-6)       # process noise (level variance)
    r = max(float(np.var(observations)) * 0.1, 1e-4)  # observation noise

    # Forward pass
    x = float(observations[0])
    p = float(np.var(observations))

    filtered: list[float] = []
    innovations: list[float] = []

    for obs in observations:
        # Predict
        p_pred = p + q
        # Update
        k = p_pred / (p_pred + r)
        innov = float(obs) - x
        x = x + k * innov
        p = (1.0 - k) * p_pred
        filtered.append(x)
        innovations.append(innov)

    filtered_arr = np.array(filtered)
    slopes = np.diff(filtered_arr)

    # Trend slope: average of last 10 increments (or all if shorter)
    tail = slopes[-min(10, len(slopes)):]
    trend_slope = float(np.mean(tail))

    # Innovation z-score for regime detection
    innov_std = float(np.std(innovations)) or 1.0
    latest_z = innovations[-1] / innov_std

    return {
        "filtered_level": round(float(filtered[-1]), 4),
        "kalman_trend_slope": round(trend_slope, 6),
        "structural_regime_shift": abs(latest_z) > 2.5,
        "predicted_next_value": round(float(filtered[-1]) + trend_slope, 4),
        "noise_variance": round(r, 6),
        "latest_innovation_z": round(float(latest_z), 4),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("chart_server:app", host="0.0.0.0", port=8001, reload=True)
