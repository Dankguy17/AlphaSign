"""
agents/latent_state/calculations.py

Pure Kalman-filter utilities for the Latent Space agent. These functions do
not call Band, LLMs, yfinance, or FRED directly; they operate on time-series
payloads passed in by upstream agents.

Supported payload shapes include the Signal Processing agent's tool outputs:
  {"ticker": "AAPL", "prices": [{"date": "...", "close": 123.45}, ...]}
  {"series_id": "DGS10", "data": [{"date": "...", "value": 4.21}, ...]}

Run a local smoke test with:
    python -m agents.latent_state.calculations
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class KalmanPrediction:
    """Serializable output from a one-step Kalman forecast."""

    series_name: str
    start: str
    end: str
    observations: int
    latest_observation: float
    filtered_level: float
    kalman_trend_slope: float
    predicted_next_value: float
    predicted_next_change: float
    predicted_next_return: float | None
    prediction_variance: float
    noise_variance: float
    latest_innovation_z: float
    structural_regime_shift: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "series_name": self.series_name,
            "start": self.start,
            "end": self.end,
            "observations": self.observations,
            "latest_observation": self.latest_observation,
            "filtered_level": self.filtered_level,
            "kalman_trend_slope": self.kalman_trend_slope,
            "predicted_next_value": self.predicted_next_value,
            "predicted_next_change": self.predicted_next_change,
            "predicted_next_return": self.predicted_next_return,
            "prediction_variance": self.prediction_variance,
            "noise_variance": self.noise_variance,
            "latest_innovation_z": self.latest_innovation_z,
            "structural_regime_shift": self.structural_regime_shift,
        }


def series_from_payload(payload: dict[str, Any] | list[dict[str, Any]], value_key: str | None = None) -> tuple[str, pd.Series]:
    """
    Convert yfinance/FRED-style JSON payloads into a numeric pandas Series.

    Args:
        payload: Either a list of dated observations or a dict containing
                 "prices" or "data" observations.
        value_key: Optional explicit value field. If omitted, this function
                   uses "close" for price payloads and "value" for FRED data.
    """
    series_name = "series"
    rows: list[dict[str, Any]]

    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        series_name = str(
            payload.get("ticker")
            or payload.get("series_id")
            or payload.get("asset")
            or payload.get("series_name")
            or "series"
        )
        if isinstance(payload.get("prices"), list):
            rows = payload["prices"]
            value_key = value_key or "close"
        elif isinstance(payload.get("data"), list):
            rows = payload["data"]
            value_key = value_key or "value"
        elif isinstance(payload.get("observations"), list):
            rows = payload["observations"]
        else:
            raise ValueError("Payload must contain a 'prices', 'data', or 'observations' list")
    else:
        raise TypeError("Payload must be a dict or a list of observations")

    if not rows:
        raise ValueError("No observations found in payload")

    value_key = value_key or _infer_value_key(rows[0])
    frame = pd.DataFrame(rows)
    if "date" not in frame.columns:
        raise ValueError("Each observation must include a 'date' field")
    if value_key not in frame.columns:
        raise ValueError(f"Value key '{value_key}' not found in observations")

    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame[value_key] = pd.to_numeric(frame[value_key], errors="coerce")
    frame = frame.dropna(subset=["date", value_key]).sort_values("date")

    if frame.empty:
        raise ValueError("No valid dated numeric observations found in payload")

    series = pd.Series(frame[value_key].to_numpy(dtype=float), index=frame["date"], name=series_name)
    return series_name, series


def run_kalman_prediction(
    observations: pd.Series,
    series_name: str = "series",
    observation_noise: float | None = None,
    process_noise_scale: float = 0.01,
    regime_shift_z_threshold: float = 2.5,
) -> KalmanPrediction:
    """
    Run a local-level + trend Kalman filter and return the one-step forecast.

    State vector:
        [latent_level, latent_trend]

    Transition:
        level_t = level_{t-1} + trend_{t-1}
        trend_t = trend_{t-1}

    Observation:
        y_t = level_t + observation_noise
    """
    series = observations.dropna().astype(float).sort_index()
    if len(series) < 3:
        raise ValueError("Need at least 3 observations for a Kalman prediction")

    values = series.to_numpy(dtype=float)
    diffs = np.diff(values)
    diff_var = float(np.var(diffs, ddof=1)) if len(diffs) > 1 else 0.0
    level_var = float(np.var(values, ddof=1)) if len(values) > 1 else 0.0
    base_variance = max(diff_var, level_var * 0.001, 1e-9)

    r = float(observation_noise) if observation_noise is not None else base_variance
    q_level = max(base_variance * process_noise_scale, 1e-9)
    q_trend = max(q_level * 0.1, 1e-10)

    transition = np.array([[1.0, 1.0], [0.0, 1.0]])
    observation = np.array([[1.0, 0.0]])
    process_cov = np.array([[q_level, 0.0], [0.0, q_trend]])
    obs_cov = np.array([[r]])
    identity = np.eye(2)

    initial_trend = float(np.median(diffs[: min(len(diffs), 5)]))
    state = np.array([values[0], initial_trend], dtype=float)
    covariance = np.eye(2) * max(base_variance, 1e-6)

    latest_innovation_z = 0.0
    for value in values:
        predicted_state = transition @ state
        predicted_covariance = transition @ covariance @ transition.T + process_cov

        innovation = np.array([[value]]) - observation @ predicted_state.reshape(2, 1)
        innovation_variance = observation @ predicted_covariance @ observation.T + obs_cov
        innovation_std = float(np.sqrt(max(innovation_variance.item(), 1e-12)))
        latest_innovation_z = float(innovation.item() / innovation_std)

        kalman_gain = predicted_covariance @ observation.T @ np.linalg.inv(innovation_variance)
        state = predicted_state + (kalman_gain @ innovation).reshape(2)
        covariance = (identity - kalman_gain @ observation) @ predicted_covariance

    next_state = transition @ state
    next_covariance = transition @ covariance @ transition.T + process_cov
    prediction_variance = float((observation @ next_covariance @ observation.T + obs_cov).item())

    latest = float(values[-1])
    predicted_next_value = float((observation @ next_state.reshape(2, 1)).item())
    predicted_next_change = predicted_next_value - latest
    predicted_next_return = predicted_next_change / latest if latest != 0 else None

    return KalmanPrediction(
        series_name=series_name,
        start=str(series.index.min().date()),
        end=str(series.index.max().date()),
        observations=int(len(series)),
        latest_observation=latest,
        filtered_level=float(state[0]),
        kalman_trend_slope=float(state[1]),
        predicted_next_value=predicted_next_value,
        predicted_next_change=float(predicted_next_change),
        predicted_next_return=float(predicted_next_return) if predicted_next_return is not None else None,
        prediction_variance=prediction_variance,
        noise_variance=r,
        latest_innovation_z=latest_innovation_z,
        structural_regime_shift=abs(latest_innovation_z) >= regime_shift_z_threshold,
    )


def prediction_from_payload(payload: dict[str, Any] | list[dict[str, Any]], value_key: str | None = None) -> dict[str, Any]:
    """Parse a payload and return a serializable Kalman prediction dict."""
    series_name, series = series_from_payload(payload, value_key=value_key)
    return run_kalman_prediction(series, series_name=series_name).as_dict()


def predictions_from_bundle(bundle: dict[str, Any]) -> dict[str, Any]:
    """
    Compute predictions for every supported series inside a bundle.

    The bundle can either be:
      {"series": [{"name": "AAPL", "payload": {...}}, ...]}
    or a dict whose values are individual yfinance/FRED payloads.
    """
    predictions: list[dict[str, Any]] = []

    if isinstance(bundle.get("series"), list):
        candidates = bundle["series"]
        for item in candidates:
            payload = item.get("payload", item)
            value_key = item.get("value_key")
            prediction = prediction_from_payload(payload, value_key=value_key)
            if item.get("name"):
                prediction["series_name"] = str(item["name"])
            predictions.append(prediction)
    else:
        for name, payload in bundle.items():
            if not isinstance(payload, (dict, list)):
                continue
            try:
                prediction = prediction_from_payload(payload)
                prediction["series_name"] = str(name)
                predictions.append(prediction)
            except (TypeError, ValueError, KeyError):
                continue

    if not predictions:
        raise ValueError("No supported series payloads found in bundle")

    return {"series_count": len(predictions), "predictions": predictions}


def _infer_value_key(row: dict[str, Any]) -> str:
    for key in ("close", "value", "adj_close", "price"):
        if key in row:
            return key
    raise ValueError("Could not infer value key; expected one of close, value, adj_close, price")


if __name__ == "__main__":
    rng = np.random.default_rng(42)
    dates = pd.date_range("2026-01-01", periods=90, freq="D")
    trend = np.linspace(100.0, 112.0, len(dates))
    noise = rng.normal(0.0, 0.8, len(dates))
    sample_payload = {
        "ticker": "SAMPLE",
        "prices": [
            {"date": str(date.date()), "close": float(value)}
            for date, value in zip(dates, trend + noise)
        ],
    }
    print(prediction_from_payload(sample_payload))
