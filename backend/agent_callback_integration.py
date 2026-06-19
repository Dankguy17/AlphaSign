"""
backend/agent_callback_integration.py

This file is DOCUMENTATION + a ready-to-paste shim, not a runnable module.

─────────────────────────────────────────────────────────────────────────────
HOW THE CALLBACK WORKS
─────────────────────────────────────────────────────────────────────────────

All three agent main() functions already accept:

    async def main(on_final_response: Callable[[str, str, str], None] | None = None)

main.py passes `session.record` as that callable. Its signature is:

    def record(agent_name: str, room_id: str, text: str) -> None

Each agent fires it differently:

  Narrative Analyst  — via FinalResponseCallback(BaseCallbackHandler), which
                       intercepts the LLM's plain-text output before it is
                       handed to thenvoi_send_message.

  Signal Processing  — via ReliableDeliveryLangGraphAdapter.on_message(), which
                       calls self._on_final_response(...) just before
                       tools.send_message(final_text, mentions).

  Latent State       — via SingleDeliveryLangGraphAdapter.on_message(), same
                       pattern as Signal Processing.

No changes are required to the existing agent files. They already wire the
callback through correctly. The only wiring needed is in main.py (done).

─────────────────────────────────────────────────────────────────────────────
BIDIRECTIONAL ROUTING RULES (per agent system prompts)
─────────────────────────────────────────────────────────────────────────────

Turn flow:

    User/Orchestrator
        │
        ▼
    Narrative Analyst  ──→  @signal_processing  (always)
        ▲
        │
    Latent State       ──→  @narrative_analyst  (always, closing the loop)
        ▲
        │
    Signal Processing  ──→  @latent_state       (always)

Backward clarification (per requirement #1):
  Any agent CAN reply back to the prior sender instead of forwarding, if it
  needs clarification. This is handled entirely in Band by @mentioning the
  prior agent. The system prompts already permit this:

    Narrative Analyst SYSTEM_PROMPT:
      "If the incoming message was FROM Signal Processing or Latent State,
       @mention @signal_processing again in your reply (continuing the loop)
       OR ask @signal_processing for clarification if you need more data."

    Signal Processing sends to @latent_state by default.
    Latent State sends to @narrative_analyst by default.

  The agents decide which direction to route based on whether they have enough
  information. No code change is needed — this is a prompt-level behaviour.

─────────────────────────────────────────────────────────────────────────────
WHAT TO PASTE IF YOU WANT AN EXPLICIT CALLBACK SHIM IN AN AGENT FILE
─────────────────────────────────────────────────────────────────────────────

If you ever need to wire a callback into a NEW agent that does NOT yet have
an on_final_response parameter, paste this pattern into its main() function:

    # --- PASTE START ---
    from langchain_core.callbacks import BaseCallbackHandler
    from typing import Callable

    class _FinalResponseShim(BaseCallbackHandler):
        def __init__(self, cb: Callable[[str, str, str], None], agent_name: str):
            super().__init__()
            self._cb = cb
            self._agent_name = agent_name
            self._room_id = ""

        def set_room_id(self, room_id: str) -> None:
            self._room_id = room_id

        def on_llm_end(self, response, **kwargs):
            for generation in response.generations:
                for g in generation:
                    if getattr(getattr(g, "message", None), "tool_calls", None):
                        continue
                    text = getattr(g, "text", None) or ""
                    if not text:
                        text = getattr(getattr(g, "message", None), "content", "") or ""
                    text = text.strip()
                    if text and self._cb:
                        try:
                            self._cb(self._agent_name, self._room_id, text)
                        except Exception as exc:
                            import logging
                            logging.getLogger(__name__).warning(
                                "on_final_response shim raised: %s", exc
                            )

    # Wire it:
    shim = _FinalResponseShim(on_final_response, "your_agent_name")
    callbacks = [AgentWhiteboxLogger(), shim]
    # Pass callbacks to ChatOpenAI(callbacks=callbacks, ...)
    # --- PASTE END ---

─────────────────────────────────────────────────────────────────────────────
FRONTEND INTEGRATION (Next.js side)
─────────────────────────────────────────────────────────────────────────────

The adapter exposes http://localhost:8765 with these endpoints:

  GET  /stream     → SSE stream of all agent messages as JSON events
  GET  /messages   → Full history as JSON array (for initial load / reconnect)
  GET  /report     → Download the PDF when ready (404 until generated)
  POST /reset      → Clear history between sessions

Each SSE event is a JSON object with one of these shapes:

  Agent message:
    {
      "agent":   "narrative_analyst" | "signal_processing" | "latent_state",
      "room_id": "<band-room-uuid>",
      "text":    "<full agent response text>",
      "ts":      "<ISO 8601 UTC timestamp>"
    }

  Report ready:
    {
      "type": "report_ready",
      "path": "alphasign_report.pdf",
      "ts":   "<ISO 8601 UTC timestamp>"
    }

  Reset event:
    {
      "type": "reset",
      "ts":   "<ISO 8601 UTC timestamp>"
    }

Example Next.js hook (paste into your component):

    // hooks/useAlphaSignStream.ts
    import { useEffect, useState } from "react";

    export function useAlphaSignStream() {
      const [messages, setMessages] = useState<any[]>([]);
      const [reportReady, setReportReady] = useState(false);

      useEffect(() => {
        const es = new EventSource("http://localhost:8765/stream");

        es.onmessage = (e) => {
          const data = JSON.parse(e.data);
          if (data.type === "report_ready") {
            setReportReady(true);
          } else if (data.type === "reset") {
            setMessages([]);
            setReportReady(false);
          } else if (data.agent) {
            setMessages((prev) => [...prev, data]);
          }
        };

        return () => es.close();
      }, []);

      return { messages, reportReady };
    }

    // Download button:
    // <a href="http://localhost:8765/report" download="alphasign_report.pdf">
    //   Download Report
    // </a>
"""
