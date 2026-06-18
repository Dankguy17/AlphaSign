"""
Known-working-style GUI smoke test for the Narrative Analyst Band connection.

This intentionally mirrors verify_setup_gui.py, but uses the narrative_analyst
block from agent_config.yaml. Use this to answer one question:

    Can this Band Remote Agent receive and respond to a chat message at all?

Run from backend/:
    python scripts/verify_narrative_gui.py

Then add/mention @narrative_analyst in a Band chat.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.checkpoint.memory import InMemorySaver
from thenvoi import Agent
from thenvoi.adapters import LangGraphAdapter
from thenvoi.config import load_agent_config


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def verify_setup() -> None:
    load_dotenv()

    agent_id, api_key = load_agent_config("narrative_analyst")
    logger.info("Loaded narrative_analyst agent: %s", agent_id)
    logger.info("REST URL: %s", os.getenv("THENVOI_REST_URL"))
    logger.info("WS URL: %s", os.getenv("THENVOI_WS_URL"))

    adapter = LangGraphAdapter(
        llm=ChatGoogleGenerativeAI(model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash")),
        checkpointer=InMemorySaver(),
        custom_section=(
            "You are a minimal connectivity test for the narrative_analyst Band "
            "agent. When mentioned, reply briefly that the narrative analyst is "
            "connected and ready."
        ),
    )

    agent = Agent.create(
        adapter=adapter,
        agent_id=agent_id,
        api_key=api_key,
        ws_url=os.getenv("THENVOI_WS_URL"),
        rest_url=os.getenv("THENVOI_REST_URL"),
    )

    logger.info("Narrative GUI smoke-test agent is live. Press Ctrl+C to stop.")
    await agent.run()


if __name__ == "__main__":
    asyncio.run(verify_setup())
