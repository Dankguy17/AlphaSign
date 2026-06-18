"""FastAPI adapter for GUI-driven executive sessions."""

from __future__ import annotations

import asyncio
from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .events import InMemoryEventBus
from .orchestrator import ExecutiveAgent
from .schemas import AgentPromptEvent, ExecutiveReport, ExecutiveRunRequest, ExecutiveSessionStatus


event_bus = InMemoryEventBus()
sessions: dict[str, ExecutiveSessionStatus] = {}
reports: dict[str, ExecutiveReport] = {}

app = FastAPI(title="AlphaSign Executive Agent API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/executive/sessions", response_model=ExecutiveSessionStatus)
async def create_executive_session(
    request: ExecutiveRunRequest,
    background_tasks: BackgroundTasks,
) -> ExecutiveSessionStatus:
    """Start an executive workflow from selected GUI tickers."""

    session_id = uuid4().hex
    status = ExecutiveSessionStatus(
        session_id=session_id,
        status="queued",
        tickers=request.tickers,
        max_deliberations=request.max_deliberations,
    )
    sessions[session_id] = status
    background_tasks.add_task(_run_session, session_id, request)
    return status


@app.get("/executive/sessions/{session_id}", response_model=ExecutiveSessionStatus)
async def get_executive_session(session_id: str) -> ExecutiveSessionStatus:
    status = sessions.get(session_id)
    if not status:
        raise HTTPException(status_code=404, detail="Unknown executive session")
    return status


@app.get("/executive/sessions/{session_id}/events")
async def list_executive_events(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Unknown executive session")
    return await event_bus.list_events(session_id)


@app.get("/executive/sessions/{session_id}/events/stream")
async def stream_executive_events(session_id: str):
    """Server-sent event stream for live graph UIs."""

    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Unknown executive session")

    async def event_stream():
        async for event in event_bus.subscribe(session_id):
            yield f"event: executive_prompt\ndata: {event.model_dump_json()}\n\n"
            status = sessions.get(session_id)
            if status and status.status in {"complete", "failed"}:
                await asyncio.sleep(0)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/executive/sessions/{session_id}/report")
async def download_executive_report(session_id: str) -> FileResponse:
    report = reports.get(session_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report is not ready")

    path = Path(report.pdf_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Report file is missing")

    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"alphasign-executive-report-{session_id}.pdf",
    )


async def _run_session(session_id: str, request: ExecutiveRunRequest) -> None:
    sessions[session_id] = sessions[session_id].model_copy(update={"status": "running"})
    try:
        executive = ExecutiveAgent(event_sink=event_bus, output_dir=Path("artifacts/executive_reports"))
        report = await executive.run(request, session_id=session_id)
        reports[session_id] = report
        sessions[session_id] = sessions[session_id].model_copy(
            update={"status": "complete", "report_path": report.pdf_path}
        )
    except Exception as exc:
        sessions[session_id] = sessions[session_id].model_copy(update={"status": "failed", "error": str(exc)})
        await event_bus.publish(
            AgentPromptEvent(
                session_id=session_id,
                round=0,
                from_agent="executive",
                to_agent="executive",
                kind="status",
                text=f"Executive session failed: {exc}",
                metadata={"error": str(exc)},
            )
        )
    finally:
        await event_bus.close_session(session_id)
