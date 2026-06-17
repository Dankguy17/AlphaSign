"""
Local test script for the Narrative Analyst agent.

No Band required. No API key required for the default sample test.

From backend/:
    python scripts/test_narrative_agent_local.py
    python scripts/test_narrative_agent_local.py --live MSFT
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from agents.narrative_analyst.news_fetch import fetch_company_news
from agents.narrative_analyst.synthesis import build_narrative_radar, generate_narrative_brief


SAMPLE_ARTICLES = [
    {
        "ticker": "MSFT",
        "title": "Microsoft shares rise after cloud revenue beats estimates",
        "description": "Analysts point to AI demand and stronger margins.",
        "source": "Sample Wire",
        "published_at": "2026-06-16T12:00:00Z",
        "url": "https://example.com/msft-cloud",
    },
    {
        "ticker": "MSFT",
        "title": "Regulators widen antitrust probe into cloud software contracts",
        "description": "Investors weigh legal risk against AI growth.",
        "source": "Sample Markets",
        "published_at": "2026-06-15T12:00:00Z",
        "url": "https://example.com/msft-probe",
    },
    {
        "ticker": "MSFT",
        "title": "Analyst upgrades Microsoft on artificial intelligence growth",
        "description": "The note raises the price target after data center demand improves.",
        "source": "Sample Research",
        "published_at": "2026-06-14T12:00:00Z",
        "url": "https://example.com/msft-upgrade",
    },
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", help="Fetch live news for a ticker, for example MSFT")
    parser.add_argument("--no-llm", action="store_true", help="Skip LLM synthesis even if keys are configured")
    args = parser.parse_args()

    ticker = (args.live or "MSFT").upper()
    articles = fetch_company_news(ticker, limit=12) if args.live else SAMPLE_ARTICLES

    radar = build_narrative_radar(ticker, articles)
    brief = generate_narrative_brief(radar, use_llm=False if args.no_llm else None)

    print("\n=== Narrative Radar ===")
    print(json.dumps(radar, indent=2))
    print("\n=== Narrative Brief ===")
    print(json.dumps(brief, indent=2))
    print("\n=== Signal Request JSON ===")
    print(json.dumps(radar["signal_request"], indent=2))
    print("\n=== Latent Request JSON ===")
    print(json.dumps(radar["latent_request"], indent=2))


if __name__ == "__main__":
    main()
