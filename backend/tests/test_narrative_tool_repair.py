import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from agents.narrative_analyst.agent_narrative_analyst import (
    _infer_tool_name_from_args,
    _repair_tool_calls_hook,
)
from langchain_core.messages import AIMessage


TOOL_NAMES = {
    "start_narrative_research",
    "incorporate_quant_findings",
    "thenvoi_send_message",
}


class NarrativeToolRepairTests(unittest.TestCase):
    def test_infers_each_known_tool_shape(self):
        cases = [
            ({"ticker": "AMZN"}, "start_narrative_research"),
            ({"quant_summary": "results"}, "incorporate_quant_findings"),
            ({"content": "report", "mentions": []}, "thenvoi_send_message"),
        ]
        for args, expected in cases:
            with self.subTest(args=args):
                self.assertEqual(
                    _infer_tool_name_from_args(
                        args,
                        TOOL_NAMES,
                        "thenvoi_send_message",
                    ),
                    expected,
                )

    def test_repair_hook_applies_inferred_name_and_id(self):
        pending = AIMessage(
            content="",
            id="pending",
            tool_calls=[
                {
                    "name": "",
                    "args": {"content": "report", "mentions": ["@signal_processing"]},
                    "id": "",
                }
            ],
        )

        result = _repair_tool_calls_hook(
            TOOL_NAMES,
            "thenvoi_send_message",
        )({"messages": [pending]})

        repaired = result["messages"][0].tool_calls[0]
        self.assertEqual(repaired["name"], "thenvoi_send_message")
        self.assertTrue(repaired["id"].startswith("autofixed-"))


if __name__ == "__main__":
    unittest.main()
