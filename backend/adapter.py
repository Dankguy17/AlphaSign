"""
backend/adapter.py

AlphaSign adapter — bridges Band agent messages to the Next.js frontend.

Exposes two endpoints on http://localhost:8765 (configurable via ADAPTER_PORT):

    GET  /stream          — Server-Sent Events stream.
                            Each agent message and the final report_ready event
                            are pushed here as JSON-encoded SSE data frames.
                            Frontend connects once and receives all live updates.

    GET  /messages        — Returns the full message history as JSON.
                            Useful for initial page load / reconnect.

    GET  /report          — Streams the PDF file when it's ready.
                            Returns 404 until the report has been generated.

    POST /reset           — Clears the in-memory queue and history.
                            Call this between sessions.

CORS is open (*) so the Next.js dev server (usually :3000) can connect freely.
Change ADAPTER_ALLOWED_ORIGIN in .env for production.

The adapter is started as a background asyncio task by main.py.
It can also be run standalone for testing:
    python adapter.py
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from aiohttp import web

logger = logging.getLogger("alphasign.adapter")

ADAPTER_PORT          = int(os.getenv("ADAPTER_PORT", "8765"))
ADAPTER_ALLOWED_ORIGIN = os.getenv("ADAPTER_ALLOWED_ORIGIN", "*")
PDF_OUTPUT_PATH       = Path(os.getenv("PDF_OUTPUT_PATH", "alphasign_report.pdf"))

# Maximum messages kept in memory (ring buffer — oldest dropped when full)
MAX_HISTORY = int(os.getenv("ADAPTER_MAX_HISTORY", "500"))


class AlphaSignAdapter:
    """
    In-process message bus.

    main.py calls adapter.enqueue(entry) from the agent callbacks.
    The HTTP server pushes those entries to connected SSE clients.
    """

    def __init__(self) -> None:
        self._history: deque[dict[str, Any]] = deque(maxlen=MAX_HISTORY)
        self._subscribers: list[asyncio.Queue[dict | None]] = []
        self._app = self._build_app()

    # ── Public API (called by main.py / SessionState) ─────────────────────

    def enqueue(self, entry: dict[str, Any]) -> None:
        """
        Push one entry into the history ring buffer and fan it out to all
        connected SSE subscribers. Safe to call from the asyncio event loop.
        """
        if "ts" not in entry:
            entry["ts"] = datetime.now(timezone.utc).isoformat()
        self._history.append(entry)

        for q in list(self._subscribers):
            try:
                q.put_nowait(entry)
            except asyncio.QueueFull:
                logger.warning("SSE subscriber queue full — dropping message")

    async def serve(self) -> None:
        """Run the aiohttp server. Awaited by main.py as a background task."""
        runner = web.AppRunner(self._app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", ADAPTER_PORT)
        await site.start()
        logger.info("AlphaSign adapter listening on http://0.0.0.0:%d", ADAPTER_PORT)
        # Run forever (cancelled by main.py on shutdown)
        try:
            await asyncio.Future()
        finally:
            await runner.cleanup()

    # ── HTTP application ──────────────────────────────────────────────────

    def _build_app(self) -> web.Application:
        app = web.Application()
        app.router.add_get("/stream",   self._handle_stream)
        app.router.add_get("/messages", self._handle_messages)
        app.router.add_get("/report",   self._handle_report)
        app.router.add_post("/reset",   self._handle_reset)
        app.on_response_prepare.append(self._add_cors)
        return app

    # ── CORS ──────────────────────────────────────────────────────────────

    @staticmethod
    async def _add_cors(request: web.Request, response: web.StreamResponse) -> None:
        response.headers["Access-Control-Allow-Origin"]  = ADAPTER_ALLOWED_ORIGIN
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"

    # ── Handlers ─────────────────────────────────────────────────────────

    async def _handle_stream(self, request: web.Request) -> web.StreamResponse:
        """
        Server-Sent Events endpoint.
        Sends all historical messages immediately on connect, then streams
        live updates as they arrive.
        """
        response = web.StreamResponse(
            status=200,
            headers={
                "Content-Type":  "text/event-stream",
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",   # disable nginx proxy buffering
            },
        )
        await response.prepare(request)

        # Send history replay so the client is caught up immediately
        for entry in list(self._history):
            await self._sse_send(response, entry)

        # Subscribe to live updates
        queue: asyncio.Queue[dict | None] = asyncio.Queue(maxsize=200)
        self._subscribers.append(queue)
        logger.debug("SSE client connected (%d total)", len(self._subscribers))

        try:
            while True:
                entry = await queue.get()
                if entry is None:
                    break   # None is the shutdown sentinel
                await self._sse_send(response, entry)
        except (ConnectionResetError, asyncio.CancelledError):
            pass
        finally:
            self._subscribers.remove(queue)
            logger.debug("SSE client disconnected (%d remaining)", len(self._subscribers))

        return response

    async def _handle_messages(self, request: web.Request) -> web.Response:
        """Return full message history as JSON array."""
        return web.json_response(list(self._history))

    async def _handle_report(self, request: web.Request) -> web.Response:
        """Stream the PDF report if it exists."""
        if not PDF_OUTPUT_PATH.exists():
            return web.Response(
                status=404,
                text=json.dumps({"error": "Report not yet generated"}),
                content_type="application/json",
            )
        pdf_bytes = PDF_OUTPUT_PATH.read_bytes()
        return web.Response(
            body=pdf_bytes,
            content_type="application/pdf",
            headers={
                "Content-Disposition": 'attachment; filename="alphasign_report.pdf"',
            },
        )

    async def _handle_reset(self, request: web.Request) -> web.Response:
        """Clear history and notify subscribers."""
        self._history.clear()
        reset_event = {"type": "reset", "ts": datetime.now(timezone.utc).isoformat()}
        for q in list(self._subscribers):
            try:
                q.put_nowait(reset_event)
            except asyncio.QueueFull:
                pass
        return web.json_response({"ok": True})

    # ── SSE helpers ───────────────────────────────────────────────────────

    @staticmethod
    async def _sse_send(response: web.StreamResponse, data: dict) -> None:
        payload = f"data: {json.dumps(data)}\n\n"
        await response.write(payload.encode())

    # ── Graceful shutdown ─────────────────────────────────────────────────

    def shutdown(self) -> None:
        """Signal all SSE clients to disconnect."""
        for q in list(self._subscribers):
            try:
                q.put_nowait(None)
            except asyncio.QueueFull:
                pass


# ── Standalone entry point ─────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    async def _standalone():
        adapter = AlphaSignAdapter()
        # Push a test message so the stream endpoint has something to show
        adapter.enqueue({
            "agent": "test",
            "text": "AlphaSign adapter running in standalone mode.",
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        await adapter.serve()

    asyncio.run(_standalone())
