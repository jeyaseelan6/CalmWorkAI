"""
Supervisor Intelligence & Executive Briefing Endpoints (/api/v1/engagements/{engagement_id}/supervisor).
Provides universal natural language query ('Ask CalmWork'), sequential Morning Brief,
and real-time SSE execution telemetry streaming.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict, Any
import asyncio
import json
import uuid
import logging
from datetime import datetime

from app.db.database import get_db
from app.models import Engagement, Outcome, Approval, TimelineEvent
from app.api.deps import supervisor_coordinator, support_agent
from app.api.schemas import UniversalSupervisorQueryPayload, SupportInvestigationRequest
from app.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Supervisor"])


@router.get("/engagements/{engagement_id}/supervisor/summary")
def get_supervisor_summary(engagement_id: str, db: Session = Depends(get_db)):
    """Generates 360-degree multi-agent operational summary."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    statement = current_outcome.statement if current_outcome else ""
    criteria = current_outcome.success_criteria if current_outcome else []
    version = current_outcome.version if current_outcome else 1
    approvals = db.query(Approval).filter(Approval.engagement_id == engagement_id, Approval.status == "PENDING").all()

    summary = supervisor_coordinator.orchestrate_engagement(
        engagement_id=engagement_id,
        customer_name=eng.customer_name,
        engagement_name=eng.name,
        current_work_cycle=eng.current_work_cycle,
        status=eng.status,
        outcome_statement=statement,
        success_criteria=criteria,
        version=version,
        pending_approvals=len(approvals)
    )

    return {
        "success": True,
        "data": summary.model_dump(),
        "message": "Supervisor 360-degree multi-agent summary generated successfully."
    }


@router.post("/engagements/{engagement_id}/supervisor/query")
def query_universal_supervisor(engagement_id: str, payload: UniversalSupervisorQueryPayload, db: Session = Depends(get_db)):
    """
    Universal Conversational Interface ('Ask CalmWork'):
    Receives user query, orchestrates multi-agent reasoning, enforces privacy and anti-hallucination policies.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    statement = current_outcome.statement if current_outcome else ""
    criteria = current_outcome.success_criteria if current_outcome else []
    version = current_outcome.version if current_outcome else 1
    approvals = db.query(Approval).filter(Approval.engagement_id == engagement_id, Approval.status == "PENDING").all()
    timeline = db.query(TimelineEvent).filter(TimelineEvent.engagement_id == engagement_id).order_by(TimelineEvent.created_at.desc()).limit(50).all()
    work_plan = current_outcome.work_plan if current_outcome else None

    response = supervisor_coordinator.query_supervisor(
        engagement_id=engagement_id,
        customer_name=eng.customer_name,
        raw_query=payload.query,
        current_work_cycle=eng.current_work_cycle,
        status=eng.status,
        outcome_statement=statement,
        success_criteria=criteria,
        version=version,
        pending_approvals=len(approvals),
        timeline_events=timeline,
        approved_work_plan=work_plan,
        pending_approvals_list=approvals,
        engagement_progress=eng.progress
    )

    return {
        "success": True,
        "data": response.model_dump(),
        "message": "Supervisor universal query processed successfully."
    }


@router.post("/engagements/{engagement_id}/supervisor/brief")
def get_daily_work_brief(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Proactive Intelligence Mode: Generates a sequential Morning Brief (PLAN -> KNOW -> MOVE -> Supervisor Plan).
    Persists provenance in shared timeline without invoking DELIVER.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    statement = current_outcome.statement if current_outcome else ""
    version = current_outcome.version if current_outcome else 1
    criteria = current_outcome.success_criteria if current_outcome else []
    approvals = db.query(Approval).filter(Approval.engagement_id == engagement_id, Approval.status == "PENDING").all()
    timeline = db.query(TimelineEvent).filter(TimelineEvent.engagement_id == engagement_id).order_by(TimelineEvent.created_at.desc()).all()

    brief = supervisor_coordinator.generate_daily_work_brief(
        engagement_id=engagement_id,
        customer_name=eng.customer_name,
        status=eng.status,
        outcome_statement=statement,
        version=version,
        pending_approvals=len(approvals),
        current_work_cycle=eng.current_work_cycle,
        timeline_events=timeline,
        success_criteria=criteria,
        approved_work_plan=current_outcome.work_plan if current_outcome else None
    )

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="MORNING_BRIEF_GENERATED",
        title=f"Morning Brief Generated (v{version})",
        description=f"Supervisor synthesized sequential Morning Brief (PLAN → KNOW → MOVE). Proposed Plan: {brief.proposed_work_plan.recommended_first_action}. DELIVER excluded.",
        actor_type="SUPERVISOR",
        actor_id="supervisor_coordinator",
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": brief.model_dump(),
        "message": "Sequential Morning Brief generated and provenance persisted in shared memory."
    }


@router.post("/engagements/{engagement_id}/supervisor/brief/stream")
async def get_daily_work_brief_stream(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Proactive Intelligence Mode (Real-Time SSE Stream):
    Streams sequential multi-agent execution events in real time.
    """
    eng = await asyncio.to_thread(lambda: db.query(Engagement).filter(Engagement.id == engagement_id).first())
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = await asyncio.to_thread(lambda: db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first())
    statement = current_outcome.statement if current_outcome else ""
    version = current_outcome.version if current_outcome else 1
    criteria = current_outcome.success_criteria if current_outcome else []
    approvals = await asyncio.to_thread(lambda: db.query(Approval).filter(Approval.engagement_id == engagement_id, Approval.status == "PENDING").all())
    timeline = await asyncio.to_thread(lambda: db.query(TimelineEvent).filter(TimelineEvent.engagement_id == engagement_id).order_by(TimelineEvent.created_at.desc()).all())

    customer_name = eng.customer_name
    status_val = eng.status
    pending_approvals_count = len(approvals)
    current_work_cycle = eng.current_work_cycle
    work_plan = current_outcome.work_plan if current_outcome else None

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def sync_progress_callback(event: Dict[str, Any]):
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def event_generator():
        async def run_worker():
            try:
                brief = await asyncio.to_thread(
                    supervisor_coordinator.generate_daily_work_brief,
                    engagement_id=engagement_id,
                    customer_name=customer_name,
                    status=status_val,
                    outcome_statement=statement,
                    version=version,
                    pending_approvals=pending_approvals_count,
                    current_work_cycle=current_work_cycle,
                    timeline_events=timeline,
                    success_criteria=criteria,
                    approved_work_plan=work_plan,
                    progress_callback=sync_progress_callback
                )
                def persist_timeline_event():
                    db.add(TimelineEvent(
                        id=f"evt-{uuid.uuid4().hex[:8]}",
                        engagement_id=engagement_id,
                        event_type="MORNING_BRIEF_GENERATED",
                        title=f"Morning Brief Generated (v{version})",
                        description=f"Supervisor synthesized sequential Morning Brief (PLAN → KNOW → MOVE). Proposed Plan: {brief.proposed_work_plan.recommended_first_action}. DELIVER excluded.",
                        actor_type="SUPERVISOR",
                        actor_id="supervisor_coordinator",
                        created_at=datetime.utcnow()
                    ))
                    db.commit()
                await asyncio.to_thread(persist_timeline_event)

                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"type": "complete", "success": True, "data": brief.model_dump()}
                )
            except Exception as e:
                logger.error(f"Error during streamed daily work brief: {str(e)}")
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {
                        "type": "error",
                        "detail": "AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
                    }
                )
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        worker_task = asyncio.create_task(run_worker())

        try:
            yield ": connected\n\n"
            await asyncio.sleep(0)

            while True:
                item = await queue.get()
                if item is None:
                    break
                yield f"data: {json.dumps(item)}\n\n"
                await asyncio.sleep(0)
        finally:
            if not worker_task.done():
                worker_task.cancel()

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/engagements/{engagement_id}/support/investigate", tags=["Support"])
def investigate_support_incident(
    engagement_id: str,
    payload: SupportInvestigationRequest,
    db: Session = Depends(get_db)
):
    """
    SUPPORT Agent: Production Support & Screenshot Intelligence endpoint.
    Triages production incidents, diagnoses visual screenshots, and formulates runbook-grounded root cause analysis.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    result = support_agent.investigate_incident(
        engagement_id=engagement_id,
        customer_name=eng.customer_name,
        issue_description=payload.issue_description,
        error_logs=payload.error_logs,
        screenshot_metadata=payload.screenshot_metadata,
        screenshot_base64=payload.screenshot_base64,
        session_id=payload.session_id
    )

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="INCIDENT_INVESTIGATED",
        title=f"Support Incident Triage ({result.severity})",
        description=f"SUPPORT Agent diagnosed issue: '{result.summary[:80]}...'",
        actor_type="SUPPORT_AGENT",
        actor_id="agent_support",
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": result.model_dump(),
        "message": f"Support incident triaged with {result.severity} severity."
    }
