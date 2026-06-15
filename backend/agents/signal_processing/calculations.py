"""
agents/signal_processing/calculations.py

Pure math functions — no LLM, no Band, no I/O. Implements the formulas
from the AlphaSign proposal (Section 4: Mathematical Foundations):

  - Log return
  - Rolling volatility
  - Beta (OLS regression of asset returns vs. market returns)
  - Market-adjusted return (idiosyncratic return)
  - Idiosyncratic volatility

All functions take/return numpy arrays or pandas Series so they compose
cleanly and are independently testable:

    python -m agents.signal_processing.calculations
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats


def log_returns(prices: pd.Series) -> pd.Series:
    """
    R_t = ln(P_t / P_{t-1})

    Returns a Series one element shorter than `prices` (first day has
    no prior price to compare against).
    """
    return np.log(prices / prices.shift(1)).dropna()


def rolling_volatility(returns: pd.Series) -> float:
    """
    sigma = sqrt( (1 / (N-1)) * sum((R_t - R_bar)^2) )

    Standard deviation of log returns over the full series passed in.
    Callers control the "rolling window" by slicing `returns` to the
    desired range before calling this.
    """
    return float(returns.std(ddof=1))


def beta_and_market_adjusted_return(
    asset_returns: pd.Series, market_returns: pd.Series
) -> dict[str, float]:
    """
    Runs OLS regression of asset_returns on market_returns to estimate
    beta, then computes:

        R_adj = R_t - beta * R_market

    for the most recent day in the series (i.e. today's market-adjusted
    return). Also returns idiosyncratic volatility — the volatility of
    the full series of market-adjusted returns, which represents the
    asset's risk independent of the broader market.

    asset_returns and market_returns must be aligned (same dates) —
    callers should reindex/align before calling this.

    Returns:
        {
          "beta": float,
          "market_adjusted_return": float,   # most recent day
          "idiosyncratic_vol": float,         # std dev of R_adj series
          "r_value": float,                   # regression fit quality
        }
    """
    if len(asset_returns) != len(market_returns):
        raise ValueError(
            f"asset_returns ({len(asset_returns)}) and market_returns "
            f"({len(market_returns)}) must be the same length and aligned"
        )
    if len(asset_returns) < 2:
        raise ValueError("Need at least 2 return observations to run a regression")

    regression = stats.linregress(market_returns.values, asset_returns.values)
    beta = regression.slope

    # Market-adjusted return for the full series, then take the latest.
    adjusted_series = asset_returns.values - beta * market_returns.values
    market_adjusted_return = float(adjusted_series[-1])
    idiosyncratic_vol = float(np.std(adjusted_series, ddof=1))

    return {
        "beta": float(beta),
        "market_adjusted_return": market_adjusted_return,
        "idiosyncratic_vol": idiosyncratic_vol,
        "r_value": float(regression.rvalue),
    }


def compute_all(
    asset_prices: pd.Series, market_prices: pd.Series
) -> dict[str, float]:
    """
    Convenience wrapper: given aligned price series for an asset and
    the market index, compute every Signal Processing metric in one call.

    Returns:
        {
          "log_return": float,              # most recent day's log return
          "volatility": float,              # std dev of log returns over window
          "beta": float,
          "market_adjusted_return": float,  # most recent day
          "idiosyncratic_vol": float,
        }
    """
    asset_ret = log_returns(asset_prices)
    market_ret = log_returns(market_prices)

    # Align on shared dates (in case of any data gaps between the two series).
    aligned = pd.DataFrame({"asset": asset_ret, "market": market_ret}).dropna()
    if len(aligned) < 2:
        raise ValueError("Not enough overlapping data points between asset and market series")

    metrics = beta_and_market_adjusted_return(aligned["asset"], aligned["market"])

    return {
        "log_return": float(asset_ret.iloc[-1]),
        "volatility": rolling_volatility(asset_ret),
        "beta": metrics["beta"],
        "market_adjusted_return": metrics["market_adjusted_return"],
        "idiosyncratic_vol": metrics["idiosyncratic_vol"],
    }


if __name__ == "__main__":
    # Smoke test with synthetic data — no network required.
    rng = np.random.default_rng(42)
    dates = pd.date_range("2026-01-01", periods=120, freq="D")

    market_prices = pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, 120))), index=dates)
    asset_prices = pd.Series(50 * np.exp(np.cumsum(rng.normal(0, 0.015, 120))), index=dates)

    result = compute_all(asset_prices, market_prices)
    for k, v in result.items():
        print(f"{k:>22}: {v:.6f}")
