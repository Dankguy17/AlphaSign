"""Executable entrypoints for the Executive agent.

Run the API adapter:
    uvicorn agents.executive.api:app --reload

Run one local session:
    python -m agents.executive.agent AAPL MSFT --max-deliberations 2
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from .events import InMemoryEventBus
from .orchestrator import ExecutiveAgent
from .schemas import ExecutiveRunRequest


async def run_once(tickers: list[str], max_deliberations: int, instruction: str | None) -> None:
    event_bus = InMemoryEventBus()
    executive = ExecutiveAgent(event_sink=event_bus, output_dir=Path("artifacts/executive_reports"))
    report = await executive.run(
        ExecutiveRunRequest(
            tickers=tickers,
            max_deliberations=max_deliberations,
            user_instruction=instruction,
        )
    )
    print(f"Executive report created: {report.pdf_path}")
    print(report.executive_summary)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the AlphaSign Executive agent locally.")
    parser.add_argument("tickers", nargs="+", help="Ticker symbols selected by the user")
    parser.add_argument("--max-deliberations", type=int, default=2)
    parser.add_argument("--instruction", default=None)
    args = parser.parse_args()

    asyncio.run(run_once(args.tickers, args.max_deliberations, args.instruction))


if __name__ == "__main__":
    main()
