"""
agents/signal_processing/data_fetch.py

Pure data-retrieval functions — no LLM, no Band, no opinions.
Wraps yfinance (price data) and FRED (macro series).

These functions return pandas Series/DataFrames so calculations.py
can work with them directly. Keep this file import-light and testable
in isolation:

    python -m agents.signal_processing.data_fetch AAPL
"""

from __future__ import annotations

import os
from datetime import date, timedelta

import pandas as pd
import yfinance as yf

# Window labels -> approximate calendar-day lookback.
# "Approximate" because trading days != calendar days, but yfinance
# accepts calendar-day periods and we trim to the data that exists.
WINDOW_DAYS: dict[str, int] = {
    "1M": 30,
    "3M": 90,
    "4M": 120,
    "6M": 182,
    "1Y": 365,
    "2Y": 730,
}

MARKET_INDEX_TICKER = "^GSPC"  # S&P 500 index


def fetch_price_series(ticker: str, window_label: str = "6M") -> pd.DataFrame:
    """
    Fetch daily OHLCV data for `ticker` over the given window.

    Returns a DataFrame indexed by date with a single 'close' column
    (adjusted close), plus 'start'/'end' dates as DataFrame attrs for
    convenience when building a TimeWindow downstream.

    Raises ValueError if the window_label is unrecognized, or if no
    data is returned (e.g. invalid ticker, network issue).
    """
    if window_label not in WINDOW_DAYS:
        raise ValueError(
            f"Unknown window_label '{window_label}'. "
            f"Expected one of: {list(WINDOW_DAYS)}"
        )

    days = WINDOW_DAYS[window_label]
    end = date.today()
    start = end - timedelta(days=days)

    raw = yf.download(
        ticker,
        start=start.isoformat(),
        end=end.isoformat(),
        interval="1d",
        progress=False,
        auto_adjust=True,  # adjusted close becomes 'Close'
    )

    if raw.empty:
        raise ValueError(f"No price data returned for ticker '{ticker}'")

    # yf.download() returns a MultiIndex (field, ticker) for single-ticker
    # requests in recent versions. Flatten to a simple 'close' column.
    if isinstance(raw.columns, pd.MultiIndex):
        close = raw["Close"][ticker]
    else:
        close = raw["Close"]

    df = pd.DataFrame({"close": close}).dropna()
    df.attrs["start"] = df.index.min().date()
    df.attrs["end"] = df.index.max().date()
    df.attrs["window_label"] = window_label
    df.attrs["ticker"] = ticker
    return df


def fetch_market_series(window_label: str = "6M") -> pd.DataFrame:
    """Fetch the S&P 500 close series over the same window, for beta calc."""
    return fetch_price_series(MARKET_INDEX_TICKER, window_label)


def fetch_fred_series(series_id: str, window_label: str = "6M") -> pd.Series:
    """
    Fetch a FRED macroeconomic series (e.g. 'DGS10' for 10-year Treasury
    yield, 'CPIAUCSL' for CPI) over the given window.

    Requires FRED_API_KEY in the environment. Returns an empty Series
    (with a logged reason via ValueError) if the key is missing — callers
    should treat FRED data as optional context, not a hard dependency.
    """
    api_key = os.getenv("FRED_API_KEY")
    if not api_key or api_key.startswith("your_"):
        raise ValueError("FRED_API_KEY not set — FRED data unavailable")

    from fredapi import Fred

    if window_label not in WINDOW_DAYS:
        raise ValueError(
            f"Unknown window_label '{window_label}'. "
            f"Expected one of: {list(WINDOW_DAYS)}"
        )

    days = WINDOW_DAYS[window_label]
    end = date.today()
    start = end - timedelta(days=days)

    fred = Fred(api_key=api_key)
    series = fred.get_series(series_id, observation_start=start, observation_end=end)
    return series.dropna()


if __name__ == "__main__":
    import sys

    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    window = sys.argv[2] if len(sys.argv) > 2 else "6M"

    print(f"Fetching {ticker} over {window}...")
    prices = fetch_price_series(ticker, window)
    print(prices.tail())
    print(f"Window: {prices.attrs['start']} -> {prices.attrs['end']}")

    print(f"\nFetching S&P 500 over {window}...")
    market = fetch_market_series(window)
    print(market.tail())
