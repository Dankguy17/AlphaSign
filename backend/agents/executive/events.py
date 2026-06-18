"""Frontend-facing event utilities for executive deliberations."""

from __future__ import annotations

import asyncio
from collections import defaultdict
from collections.abc import AsyncIterator
from typing import Protocol

from .schemas import AgentPromptEvent


class EventSink(Protocol):
    async def publish(self, event: AgentPromptEvent) -> None:
        """Publish a workflow event."""


class InMemoryEventBus:
    """Small async event store used by the API adapter and tests.

    It keeps the full event history per session for polling and also exposes a
    subscription stream for live graph UIs.
    """

    def __init__(self) -> None:
        self._events: dict[str, list[AgentPromptEvent]] = defaultdict(list)
        self._subscribers: dict[str, set[asyncio.Queue[AgentPromptEvent | None]]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def publish(self, event: AgentPromptEvent) -> None:
        async with self._lock:
            self._events[event.session_id].append(event)
            subscribers = list(self._subscribers[event.session_id])

        for queue in subscribers:
            queue.put_nowait(event)

    async def list_events(self, session_id: str) -> list[AgentPromptEvent]:
        async with self._lock:
            return list(self._events.get(session_id, []))

    async def close_session(self, session_id: str) -> None:
        async with self._lock:
            subscribers = list(self._subscribers.get(session_id, set()))
            self._subscribers.pop(session_id, None)

        for queue in subscribers:
            queue.put_nowait(None)

    async def subscribe(self, session_id: str) -> AsyncIterator[AgentPromptEvent]:
        queue: asyncio.Queue[AgentPromptEvent | None] = asyncio.Queue()
        async with self._lock:
            self._subscribers[session_id].add(queue)
            existing = list(self._events.get(session_id, []))

        try:
            for event in existing:
                yield event

            while True:
                event = await queue.get()
                if event is None:
                    break
                yield event
        finally:
            async with self._lock:
                self._subscribers.get(session_id, set()).discard(queue)
