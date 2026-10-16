"""
Supervisor Natural Language Work Planning Endpoints (/api/v1/engagements/{engagement_id}/plan).
Manages plan drafting, real-time SSE streaming generation, within-scope FDE approvals,
and consequential manager governance.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import asyncio
import json
import uuid
import logging
from datetime import datetime

from app.db.database import get_db
from app.models import Engagement, Outcome, OutcomeStatus, TimelineEvent
from app.services import OutcomeService
from app.auth import require_role
from app.api.deps import supervisor_coordinator, know_agent, plan_agent
from app.api.schemas import (
    ProposeWorkPlanRequest,
    ApproveWorkPlanRequest,
    PlanReassessmentRequest
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Supervisor"])


@router.post("/engagements/{engagement_id}/plan/propose")
def propose_work_plan(
    engagement_id: str,
    payload: ProposeWorkPlanRequest,
    db: Session = Depends(get_db)
):
    """
    Supervisor Natural Language Work Planning Endpoint (Draft Generation):
    Generates a structured, editable work plan proposal from natural language description.
    Strictly read-only / draft generation: does NOT mutate authoritative state.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    if not payload.natural_language_description or not payload.natural_language_description.strip():
        raise HTTPException(status_code=400, detail="Natural language description cannot be empty.")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    statement = current_outcome.statement if current_outcome else ""
    criteria = current_outcome.success_criteria if current_outcome else []

    try:
        proposal = supervisor_coordinator.generate_natural_language_work_plan(
            engagement_id=engagement_id,
            customer_name=eng.customer_name,
            natural_language_description=payload.natural_language_description,
            current_outcome_statement=statement,
            current_success_criteria=criteria,
            session_id=payload.session_id or engagement_id
        )

        return {
            "success": True,
            "data": proposal.model_dump(),
            "message": "Structured work plan proposed successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating work plan proposal: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
        )


@router.post("/engagements/{engagement_id}/plan/propose/stream")
async def propose_work_plan_stream(
    engagement_id: str,
    payload: ProposeWorkPlanRequest,
    db: Session = Depends(get_db)
):
    """
    Supervisor Natural Language Work Planning Endpoint (Real-Time SSE Stream):
    Streams multi-agent execution events in real time.
    """
    eng = await asyncio.to_thread(lambda: db.query(Engagement).filter(Engagement.id == engagement_id).first())
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    if not payload.natural_language_description or not payload.natural_language_description.strip():
        raise HTTPException(status_code=400, detail="Natural language description cannot be empty.")

    current_outcome = await asyncio.to_thread(lambda: db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first())
    statement = current_outcome.statement if current_outcome else ""
    criteria = current_outcome.success_criteria if current_outcome else []
    customer_name = eng.customer_name
    session_id = payload.session_id or engagement_id
    nl_desc = payload.natural_language_description

    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def sync_progress_callback(event: Dict[str, Any]):
        loop.call_soon_threadsafe(queue.put_nowait, event)

    async def event_generator():
        async def run_worker():
            try:
                proposal = await asyncio.to_thread(
                    supervisor_coordinator.generate_natural_language_work_plan,
                    engagement_id=engagement_id,
                    customer_name=customer_name,
                    natural_language_description=nl_desc,
                    current_outcome_statement=statement,
                    current_success_criteria=criteria,
                    session_id=session_id,
                    progress_callback=sync_progress_callback
                )
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"type": "complete", "success": True, "data": proposal.model_dump()}
                )
            except HTTPException as he:
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    {"type": "error", "detail": he.detail}
                )
            except Exception as e:
                logger.error(f"Error during streamed plan proposal: {str(e)}")
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


@router.post("/engagements/{engagement_id}/plan/approve")
def approve_work_plan(
    engagement_id: str,
    payload: ApproveWorkPlanRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER", "FDE"]))
):
    """
    Work Plan Approval and Persistence Endpoint:
    - Allows FDEs to approve within approved scope.
    - Preserves MANAGER approval requirement for consequential changes.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    plan_dict = payload.plan
    if not isinstance(plan_dict, dict) or not plan_dict:
        raise HTTPException(status_code=400, detail="Invalid plan payload: must be a non-empty object.")

    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", payload.actor_id or ("Sarah Chen" if user_role == "FDE" else "David Miller"))
    actor_id = current_user.get("id", "usr-fde-001" if user_role == "FDE" else "usr-mgr-002")
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()

    # Idempotency check: if current outcome already has the identical plan
    if current_outcome and current_outcome.work_plan == plan_dict:
        return {
            "success": True,
            "data": {
                "engagement_id": engagement_id,
                "version": current_outcome.version,
                "outcome_id": current_outcome.id,
                "work_plan": current_outcome.work_plan
            },
            "message": "Work plan is already approved and active (idempotent request)."
        }

    has_existing_plan = bool(current_outcome and current_outcome.work_plan is not None)
    current_statement = (current_outcome.statement if current_outcome else eng.name).strip()
    proposed_objective = (plan_dict.get("engagement_objective") or "").strip()

    is_explicit_consequential = bool(
        plan_dict.get("is_consequential_change")
        or plan_dict.get("scope_expansion")
        or plan_dict.get("requires_manager_approval")
    )
    target_version = plan_dict.get("version")
    is_version_upgrade = bool(
        target_version and current_outcome and int(target_version) > current_outcome.version
    )
    statement_changed = bool(
        has_existing_plan
        and proposed_objective
        and current_statement
        and proposed_objective != current_statement
    )
    note_lower = (payload.decision_note or "").lower()
    is_scope_expansion_note = bool(
        "scope" in note_lower and any(w in note_lower for w in ["expand", "revision", "new scope", "contract", "cdc pipeline"])
    )

    is_consequential = bool(
        is_explicit_consequential
        or is_version_upgrade
        or (has_existing_plan and statement_changed)
        or is_scope_expansion_note
    )

    if is_consequential and user_role != "MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager approval required for consequential changes to approved outcomes, engagement scope, and delivery commitments."
        )

    outcome_service = OutcomeService(db)

    dod_items = plan_dict.get("outcome_goals") or plan_dict.get("definition_of_done", [])
    updated_criteria = []
    if isinstance(dod_items, list):
        for idx, item in enumerate(dod_items):
            if isinstance(item, dict):
                updated_criteria.append(item)
            elif isinstance(item, str) and item.strip():
                updated_criteria.append({"id": f"sc-{idx+1}", "title": item.strip(), "completed": False})

    if not updated_criteria and plan_dict.get("outcomes"):
        for idx, o in enumerate(plan_dict.get("outcomes", [])):
            if isinstance(o, str) and o.strip():
                updated_criteria.append({"id": f"sc-{idx+1}", "title": o.strip(), "completed": False})

    if not updated_criteria and current_outcome:
        updated_criteria = current_outcome.success_criteria or []

    new_statement = proposed_objective if (user_role == "MANAGER" and proposed_objective) else current_statement

    # Task preservation: Plan Agent's tasks are added to the task list on approval without replacing existing tasks
    existing_wp = current_outcome.work_plan if (current_outcome and current_outcome.work_plan) else {}
    existing_tasks = list(existing_wp.get("tasks", [])) if isinstance(existing_wp, dict) else []
    incoming_tasks = plan_dict.get("tasks", []) or plan_dict.get("work_items", [])

    existing_ids = {t.get("id") for t in existing_tasks if isinstance(t, dict)}
    existing_titles = {t.get("title", "").strip().lower() for t in existing_tasks if isinstance(t, dict)}

    merged_tasks = list(existing_tasks)
    for inc in incoming_tasks:
        if isinstance(inc, dict):
            inc_id = inc.get("id")
            inc_title = inc.get("title", "").strip().lower()
            if inc_id not in existing_ids and inc_title not in existing_titles:
                merged_inc = dict(inc)
                merged_inc["approval_status"] = "APPROVED"
                merged_tasks.append(merged_inc)
                if inc_id:
                    existing_ids.add(inc_id)
                if inc_title:
                    existing_titles.add(inc_title)

    plan_dict["tasks"] = merged_tasks

    try:
        if is_consequential and user_role == "MANAGER":
            new_version_outcome = outcome_service.propose_new_outcome_version(
                engagement_id=engagement_id,
                new_statement=proposed_objective or current_statement,
                new_success_criteria=updated_criteria,
                proposed_by=actor_name,
                reason=payload.decision_note or "Manager updated and approved revised work plan with consequential scope changes."
            )
            new_version_outcome.work_plan = plan_dict
            db.commit()

            outcome_service.approve_outcome_version(
                engagement_id=engagement_id,
                outcome_id=new_version_outcome.id,
                approved_by=actor_name
            )
            active_outcome = new_version_outcome
            event_type = "WORK_PLAN_APPROVED"
            event_title = f"Work Plan Approved (v{active_outcome.version})"
            event_desc = f"Manager {actor_name} approved revised work plan with consequential scope changes."
        elif has_existing_plan:
            current_outcome.work_plan = plan_dict
            if updated_criteria:
                current_outcome.success_criteria = updated_criteria
            eng.updated_at = datetime.utcnow()
            active_outcome = current_outcome
            db.commit()

            event_type = "WORK_PLAN_UPDATED"
            event_title = f"Work Plan Updated (v{active_outcome.version})"
            event_desc = (
                f"FDE {actor_name} updated routine tasks and milestones within approved scope."
                if user_role == "FDE"
                else f"Manager {actor_name} updated work plan tasks."
            )
        else:
            if not current_outcome:
                outcome_id = f"out-{engagement_id[:8]}-v1-{uuid.uuid4().hex[:4]}"
                current_outcome = Outcome(
                    id=outcome_id,
                    engagement_id=engagement_id,
                    version=1,
                    statement=new_statement,
                    success_criteria=updated_criteria,
                    work_plan=plan_dict,
                    status=OutcomeStatus.APPROVED,
                    created_by=actor_name,
                    approved_by=actor_name,
                    created_at=datetime.utcnow(),
                    approved_at=datetime.utcnow()
                )
                db.add(current_outcome)
                eng.current_outcome_id = outcome_id
            else:
                if user_role == "MANAGER" and proposed_objective:
                    current_outcome.statement = proposed_objective
                current_outcome.success_criteria = updated_criteria
                current_outcome.work_plan = plan_dict
                current_outcome.approved_by = actor_name
                current_outcome.approved_at = datetime.utcnow()

            eng.updated_at = datetime.utcnow()
            active_outcome = current_outcome
            db.commit()

            event_type = "WORK_PLAN_APPROVED"
            event_title = f"Work Plan Approved (v{active_outcome.version})"
            milestones_count = len(plan_dict.get("milestones", []))
            tasks_count = len(plan_dict.get("tasks", [])) or sum(
                len(m.get("deliverables", []))
                for m in plan_dict.get("milestones", [])
                if isinstance(m, dict)
            )
            event_desc = (
                f"FDE {actor_name} approved and activated structured work plan with {milestones_count} milestones and {tasks_count} tasks within approved engagement scope."
                if user_role == "FDE"
                else f"Manager {actor_name} approved structured work plan with {milestones_count} milestones and {tasks_count} tasks."
            )

        evt = TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type=event_type,
            title=event_title,
            description=event_desc,
            actor_type=user_role,
            actor_id=actor_id,
            created_at=datetime.utcnow()
        )
        db.add(evt)
        db.commit()

        # Ingest full approved work plan into KNOW Agent vector store
        try:
            plan_doc_lines = [
                f"# Approved Work Plan: {eng.name} ({eng.customer_name})",
                f"Version: {active_outcome.version}",
                f"Approved By: {actor_name} ({user_role})",
                f"Objective: {active_outcome.statement}\n",
                "## Outcomes:"
            ]
            for out in plan_dict.get("outcomes", []):
                plan_doc_lines.append(f"- {out}")

            plan_doc_lines.append("\n## Outcome Goals:")
            for dod in updated_criteria:
                t = dod.get("title") if isinstance(dod, dict) else str(dod)
                plan_doc_lines.append(f"- [ ] {t}")

            plan_doc_lines.append("\n## Milestones & Work Packages:")
            for m in plan_dict.get("milestones", []):
                m_title = m.get("title") if isinstance(m, dict) else str(m)
                plan_doc_lines.append(f"### Milestone: {m_title}")
                if isinstance(m, dict):
                    for deliv in m.get("deliverables", []):
                        plan_doc_lines.append(f"  - Deliverable: {deliv}")
                    for dep in m.get("dependencies", []):
                        plan_doc_lines.append(f"  - Prerequisite Dependency: {dep}")

            if plan_dict.get("tasks"):
                plan_doc_lines.append("\n## Concrete Tasks:")
                for t in plan_dict.get("tasks", []):
                    t_title = t.get("title", "")
                    t_desc = t.get("description", "")
                    plan_doc_lines.append(f"- {t_title}: {t_desc}")

            if plan_dict.get("risks"):
                plan_doc_lines.append("\n## Risks:")
                for r in plan_dict.get("risks", []):
                    plan_doc_lines.append(f"- {r}")

            fa = plan_dict.get("facts_and_assumptions", {})
            if isinstance(fa, dict):
                if fa.get("confirmed_facts"):
                    plan_doc_lines.append("\n## Confirmed Facts:")
                    for cf in fa.get("confirmed_facts", []):
                        plan_doc_lines.append(f"- {cf}")
                if fa.get("inferred_assumptions"):
                    plan_doc_lines.append("\n## Inferred Assumptions:")
                    for ia in fa.get("inferred_assumptions", []):
                        plan_doc_lines.append(f"- {ia}")
                if fa.get("unresolved_questions_or_gaps"):
                    plan_doc_lines.append("\n## Unresolved Questions & Missing Facts:")
                    for uq in fa.get("unresolved_questions_or_gaps", []):
                        plan_doc_lines.append(f"- {uq}")

            plan_doc_text = "\n".join(plan_doc_lines)
            know_agent.ingest_document(
                engagement_id=engagement_id,
                title=f"{eng.customer_name} Approved Work Plan v{active_outcome.version}",
                raw_text=plan_doc_text
            )
            logger.info(f"Ingested approved work plan v{active_outcome.version} into KNOW Agent vector store for {engagement_id}.")
        except Exception as vec_err:
            logger.warning(f"Could not ingest approved plan into vector store: {vec_err}")

        return {
            "success": True,
            "data": {
                "engagement_id": engagement_id,
                "version": active_outcome.version,
                "outcome_id": active_outcome.id,
                "work_plan": active_outcome.work_plan,
                "statement": active_outcome.statement,
                "success_criteria": active_outcome.success_criteria
            },
            "message": f"Work Plan approved and activated as authoritative state (v{active_outcome.version})."
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist approved work plan: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to persist approved work plan: {str(e)}")


@router.get("/engagements/{engagement_id}/plan")
def get_work_plan(engagement_id: str, db: Session = Depends(get_db)):
    """Retrieve active approved work plan for an engagement."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    return {
        "success": True,
        "data": {
            "engagement_id": engagement_id,
            "version": current_outcome.version if current_outcome else 1,
            "has_plan": bool(current_outcome and current_outcome.work_plan),
            "plan": current_outcome.work_plan if current_outcome else None
        },
        "message": "Work plan retrieved successfully."
    }


@router.post("/engagements/{engagement_id}/plan/reassess")
def reassess_work_plan(
    engagement_id: str,
    payload: PlanReassessmentRequest,
    db: Session = Depends(get_db)
):
    """
    PLAN Agent: Iteratively reassesses an existing work plan when new evidence or worknotes arrive.
    Detects scope drift, evaluates outcome health, and flags if manager approval is required.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    plan_dict = current_outcome.work_plan if current_outcome and current_outcome.work_plan else {}

    result = plan_agent.reassess_plan_with_evidence(
        engagement_id=engagement_id,
        customer_name=eng.customer_name,
        current_work_plan=plan_dict,
        new_evidence_items=payload.new_evidence_items,
        worknotes=payload.worknotes,
        session_id=payload.session_id
    )

    return {
        "success": True,
        "data": result.model_dump(),
        "message": "Work plan reassessed against new evidence."
    }
