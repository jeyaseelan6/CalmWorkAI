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
import re
from datetime import datetime

from app.db.database import get_db
from app.models import Engagement, Outcome, Approval, ApprovalType, ApprovalStatus, TimelineEvent, WorkspaceChatMessage
from app.api.deps import supervisor_coordinator, support_agent, storage_service
from app.api.schemas import UniversalSupervisorQueryPayload, SupportInvestigationRequest
from app.auth import get_current_user

from app.agents.invariants import IST_TZ
from datetime import timezone

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Supervisor"])


def format_ist_time(dt: datetime) -> str:
    """Formats datetime into IST standard 24h string."""
    if not dt:
        return ""
    dt_utc = dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    return dt_utc.astimezone(IST_TZ).strftime("%H:%M IST")


@router.get("/engagements/{engagement_id}/supervisor/messages")
def get_workspace_chat_messages(engagement_id: str, db: Session = Depends(get_db)):
    """
    Retrieves chronological chat history for 'Ask CalmWork AI' in this workspace.
    Initializes default localized welcome message if history is empty.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Workspace not found")

    messages = (
        db.query(WorkspaceChatMessage)
        .filter(WorkspaceChatMessage.engagement_id == engagement_id)
        .order_by(WorkspaceChatMessage.created_at.asc())
        .all()
    )

    if not messages:
        welcome_id = f"msg-welcome-{engagement_id}"
        welcome_msg = WorkspaceChatMessage(
            id=welcome_id,
            engagement_id=engagement_id,
            sender="SUPERVISOR",
            text=f"Hello! I am the CalmWork Supervisor for {eng.customer_name}. Ask about project status, scope changes, blockers, or attach error logs and screenshots for quick diagnosis.",
            intent="MULTI_AGENT",
            delegated_agent={
                "id": "MULTI_AGENT",
                "name": "CalmWork Supervisor",
                "role": "Multi-Agent Orchestration",
                "badge_label": "Universal Orchestrator",
                "color": "slate"
            },
            capabilities_used=["PLAN", "KNOW", "MOVE", "DELIVER", "SUPPORT"],
            suggested_followups=[
                "What changed today in scope & work plan?",
                "What should I do next? (Next action)",
                "What is the technical architecture & specs?",
                "Draft an executive customer update."
            ],
            created_at=datetime.utcnow()
        )
        db.add(welcome_msg)
        db.commit()
        db.refresh(welcome_msg)
        messages = [welcome_msg]

    serialized = []
    for m in messages:
        user_clean_text = re.sub(r"^\[Context:[^\]]*\]\s*", "", m.text or "").strip() if m.sender == "USER" else m.text
        serialized.append({
            "id": m.id,
            "sender": m.sender,
            "text": user_clean_text,
            "intent": m.intent or "MULTI_AGENT",
            "delegatedAgent": m.delegated_agent,
            "capabilitiesUsed": m.capabilities_used or [],
            "sources": m.sources or [],
            "suggestedFollowups": m.suggested_followups or [],
            "screenshotPreview": m.screenshot_preview,
            "supportResult": m.support_result,
            "customerUpdate": m.customer_update,
            "timestamp": format_ist_time(m.created_at)
        })

    return {
        "success": True,
        "data": serialized,
        "message": f"Retrieved {len(serialized)} messages for workspace {engagement_id}."
    }


@router.delete("/engagements/{engagement_id}/supervisor/messages")
def clear_workspace_chat_messages(engagement_id: str, db: Session = Depends(get_db)):
    """Clears conversation history for the given workspace and resets to initial greeting."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Workspace not found")

    db.query(WorkspaceChatMessage).filter(WorkspaceChatMessage.engagement_id == engagement_id).delete()
    db.commit()

    # Re-seed clean welcome message
    welcome_msg = WorkspaceChatMessage(
        id=f"msg-welcome-{engagement_id}",
        engagement_id=engagement_id,
        sender="SUPERVISOR",
        text=f"Hello! I am the CalmWork Supervisor for {eng.customer_name}. Ask about project status, scope changes, blockers, or attach error logs and screenshots for quick diagnosis.",
        intent="MULTI_AGENT",
        delegated_agent={
            "id": "MULTI_AGENT",
            "name": "CalmWork Supervisor",
            "role": "Multi-Agent Orchestration",
            "badge_label": "Universal Orchestrator",
            "color": "slate"
        },
        capabilities_used=["PLAN", "KNOW", "MOVE", "DELIVER", "SUPPORT"],
        suggested_followups=[
            "What changed today in scope & work plan?",
            "What should I do next? (Next action)",
            "What is the technical architecture & specs?",
            "Draft an executive customer update."
        ],
        created_at=datetime.utcnow()
    )
    db.add(welcome_msg)
    db.commit()

    return {
        "success": True,
        "message": f"Conversation history cleared for workspace {engagement_id}."
    }


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
    Receives user query, orchestrates multi-agent reasoning, persists user query and response to PostgreSQL.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    # 1. Persist Clean User Query to PostgreSQL
    clean_user_text = re.sub(r"^\[Context:[^\]]*\]\s*", "", payload.query or "").strip()
    user_msg_id = f"msg-usr-{uuid.uuid4().hex[:8]}"
    db.add(WorkspaceChatMessage(
        id=user_msg_id,
        engagement_id=engagement_id,
        sender="USER",
        text=clean_user_text,
        created_at=datetime.utcnow()
    ))
    db.commit()

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

    # 2. Persist Supervisor Response to PostgreSQL
    agent_meta = response.delegated_agent.model_dump() if response.delegated_agent else None
    sources_list = [s.model_dump() for s in response.sources] if response.sources else []

    sup_msg_id = f"msg-sup-{uuid.uuid4().hex[:8]}"
    cu_payload = response.customer_update.model_dump() if response.customer_update else None
    db.add(WorkspaceChatMessage(
        id=sup_msg_id,
        engagement_id=engagement_id,
        sender="SUPERVISOR",
        text=response.answer,
        intent=response.intent_detected,
        delegated_agent=agent_meta,
        capabilities_used=response.capabilities_used,
        sources=sources_list,
        suggested_followups=response.suggested_followups,
        customer_update=cu_payload,
        created_at=datetime.utcnow()
    ))

    # If DELIVER agent generated a customer update draft in chat, sync to pending approval
    if cu_payload:
        existing_appr = db.query(Approval).filter(
            Approval.engagement_id == engagement_id,
            Approval.type == ApprovalType.CUSTOMER_UPDATE,
            Approval.status == ApprovalStatus.PENDING
        ).first()
        if existing_appr:
            existing_appr.decision_note = json.dumps(cu_payload)
        else:
            new_appr = Approval(
                id=f"appr-cu-{uuid.uuid4().hex[:8]}",
                engagement_id=engagement_id,
                type=ApprovalType.CUSTOMER_UPDATE,
                target_id=engagement_id,
                status=ApprovalStatus.PENDING,
                requested_by="FDE (DELIVER Agent)",
                decision_note=json.dumps(cu_payload),
                created_at=datetime.utcnow()
            )
            db.add(new_appr)

    db.commit()

    return {
        "success": True,
        "data": response.model_dump(),
        "message": "Supervisor universal query processed and saved to database successfully."
    }


from app.skills.morning_brief import morning_brief_skill


@router.get("/engagements/{engagement_id}/supervisor/brief/latest")
def get_latest_daily_work_brief(
    engagement_id: str,
    db: Session = Depends(get_db)
):
    """
    Retrieves the most recent persisted Morning Brief for an engagement.
    Enables zero-latency morning dashboard rendering from database without calling LLM.
    """
    latest = morning_brief_skill.get_latest_brief(engagement_id=engagement_id, db=db)
    if not latest:
        return {
            "success": True,
            "data": None,
            "has_brief": False,
            "message": "No previously generated morning brief found for this engagement."
        }
    return {
        "success": True,
        "data": latest,
        "has_brief": True,
        "generated_at": latest.get("persisted_at") or latest.get("timestamp"),
        "message": "Latest morning brief retrieved successfully."
    }


@router.post("/engagements/{engagement_id}/supervisor/brief")
def get_daily_work_brief(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Proactive Intelligence Mode: Generates a sequential Morning Brief via Morning Brief Skill.
    Persists provenance and complete briefing artifact in shared timeline.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    user_name = current_user.get("name", "Engineer")
    brief = morning_brief_skill.execute_and_persist(
        engagement_id=engagement_id,
        db=db,
        trigger_source=f"ON_DEMAND ({user_name})"
    )

    data = brief.model_dump()
    data["persisted_at"] = datetime.utcnow().isoformat()

    return {
        "success": True,
        "data": data,
        "generated_at": data["persisted_at"],
        "message": "Sequential Morning Brief generated via Morning Brief Skill and persisted."
    }



@router.post("/engagements/{engagement_id}/supervisor/brief/stream")
async def get_daily_work_brief_stream(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Proactive Intelligence Mode (Real-Time SSE Stream):
    Streams sequential Morning Brief Skill execution events in real time and persists to database.
    """
    eng = await asyncio.to_thread(lambda: db.query(Engagement).filter(Engagement.id == engagement_id).first())
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    user_name = current_user.get("name", "Engineer")
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def sync_progress_callback(event: Dict[str, Any]):
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def event_generator():
        async def run_worker():
            try:
                brief = await asyncio.to_thread(
                    morning_brief_skill.execute_and_persist,
                    engagement_id=engagement_id,
                    db=db,
                    trigger_source=f"ON_DEMAND ({user_name})",
                    progress_callback=sync_progress_callback
                )
                brief_dict = brief.model_dump()
                brief_dict["persisted_at"] = datetime.utcnow().isoformat()

                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {
                        "type": "complete",
                        "success": True,
                        "data": brief_dict,
                        "generated_at": brief_dict["persisted_at"]
                    }
                )
            except Exception as e:
                logger.error(f"Error during streamed Morning Brief Skill: {str(e)}")
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {
                        "type": "error",
                        "detail": f"Failed to execute Morning Brief Skill: {str(e)}"
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

    uploaded_image_url = None
    if payload.screenshot_base64:
        fn = (payload.screenshot_metadata or {}).get("filename") if payload.screenshot_metadata else "screenshot.png"
        uploaded_image_url = storage_service.upload_chat_image(
            engagement_id=engagement_id,
            image_data=payload.screenshot_base64,
            filename=fn
        )

    result = support_agent.investigate_incident(
        engagement_id=engagement_id,
        customer_name=eng.customer_name,
        issue_description=payload.issue_description,
        error_logs=payload.error_logs,
        screenshot_metadata=payload.screenshot_metadata,
        screenshot_base64=payload.screenshot_base64,
        image_url=uploaded_image_url,
        session_id=payload.session_id
    )

    timeline_meta: Dict[str, Any] = {
        "incident_id": result.incident_id,
        "severity": result.severity
    }
    if uploaded_image_url:
        timeline_meta["image_url"] = uploaded_image_url

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="INCIDENT_INVESTIGATED",
        title=f"Support Incident Triage ({result.severity})",
        description=f"SUPPORT Agent diagnosed issue: '{result.summary[:80]}...'",
        actor_type="SUPPORT_AGENT",
        actor_id="agent_support",
        metadata_json=timeline_meta,
        created_at=datetime.utcnow()
    ))

    # Persist User Screenshot Diagnostic Request
    user_query_text = payload.issue_description or "Analyze attached screenshot for production incident diagnostic."
    user_msg_id = f"msg-usr-{uuid.uuid4().hex[:8]}"
    db.add(WorkspaceChatMessage(
        id=user_msg_id,
        engagement_id=engagement_id,
        sender="USER",
        text=user_query_text,
        screenshot_preview=payload.screenshot_base64[:200] if payload.screenshot_base64 else None,
        created_at=datetime.utcnow()
    ))

    # Persist SUPPORT Agent Diagnostic Response
    sup_msg_id = f"msg-sup-{uuid.uuid4().hex[:8]}"
    db.add(WorkspaceChatMessage(
        id=sup_msg_id,
        engagement_id=engagement_id,
        sender="SUPERVISOR",
        text=f"Diagnosed {result.severity} incident ({result.incident_id}): {result.summary}",
        intent="SUPPORT",
        delegated_agent={
            "id": "SUPPORT",
            "name": "SUPPORT Agent",
            "role": "Production Support & Visual Diagnostics",
            "badge_label": "Incident & Diagnostic Specialist",
            "color": "emerald"
        },
        capabilities_used=["SUPPORT"],
        support_result=result.model_dump(),
        suggested_followups=[
            "Explain root cause hypothesis",
            "Show recommended triage steps",
            "Draft customer incident update"
        ],
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": result.model_dump(),
        "message": f"Support incident triaged with {result.severity} severity."
    }
