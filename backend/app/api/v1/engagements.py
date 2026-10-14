"""
Engagements Endpoints (/api/v1/engagements).
Manages customer engagements, routine tasks, goals, and shared memory timeline events.
Uses synchronous route definitions so FastAPI dispatches blocking DB I/O to threadpools.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
import uuid
import re
from datetime import datetime

from app.db.database import get_db
from app.models import (
    Engagement, EngagementStatus, WorkCycleStep, Outcome, OutcomeStatus,
    TimelineEvent, Approval, ApprovalStatus, DocumentModel
)
from app.auth import require_role
from app.api.deps import know_agent
from app.api.schemas import CreateEngagementRequest, WorknotePayload

router = APIRouter(prefix="/engagements", tags=["Engagements"])


@router.get("")
@router.get("/")
def list_engagements(db: Session = Depends(get_db)):
    """List all customer engagements with outcomes and pending approval counts."""
    engagements = db.query(Engagement).all()

    # Cloud DB Optimization: Batch fetch outcomes & pending approvals in 2 queries
    outcome_ids = [eng.current_outcome_id for eng in engagements if eng.current_outcome_id]
    outcomes = {o.id: o for o in db.query(Outcome).filter(Outcome.id.in_(outcome_ids)).all()} if outcome_ids else {}

    pending_counts = dict(
        db.query(Approval.engagement_id, func.count(Approval.id))
        .filter(Approval.status == ApprovalStatus.PENDING)
        .group_by(Approval.engagement_id)
        .all()
    )

    result = []
    for eng in engagements:
        current_outcome = outcomes.get(eng.current_outcome_id)
        pending_approvals = pending_counts.get(eng.id, 0)
        result.append({
            "id": eng.id,
            "customer_name": eng.customer_name,
            "name": eng.name,
            "description": eng.description,
            "status": eng.status,
            "progress": eng.progress,
            "current_work_cycle": eng.current_work_cycle,
            "current_outcome_id": eng.current_outcome_id,
            "current_outcome": current_outcome.statement if current_outcome else None,
            "version": current_outcome.version if current_outcome else 1,
            "success_criteria": current_outcome.success_criteria if current_outcome else [],
            "has_work_plan": bool(current_outcome and current_outcome.work_plan),
            "work_plan": current_outcome.work_plan if current_outcome else None,
            "pending_approvals_count": pending_approvals,
            "created_at": eng.created_at.isoformat() if eng.created_at else None
        })
    return {
        "success": True,
        "data": result,
        "message": "Engagements retrieved successfully"
    }


@router.post("")
@router.post("/")
def create_engagement(
    payload: CreateEngagementRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER"]))
):
    """Create a new customer engagement initiative (Manager role required)."""
    if not payload.customer_name.strip() or not payload.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer name and engagement name are required."
        )

    clean_slug = re.sub(r"[^a-zA-Z0-9]+", "-", payload.customer_name.lower()).strip("-")[:16] or "cust"
    engagement_id = f"eng-{clean_slug}-{uuid.uuid4().hex[:4]}"
    outcome_id = f"out-{clean_slug}-v1-{uuid.uuid4().hex[:4]}"

    criteria = []
    if payload.success_criteria:
        for idx, item in enumerate(payload.success_criteria):
            if item.strip():
                criteria.append({"id": f"sc-{idx+1}", "title": item.strip(), "completed": False})

    if not criteria:
        criteria = [
            {"id": "sc-1", "title": "Initial discovery and baseline architecture completed", "completed": False},
            {"id": "sc-2", "title": "Core integration pipeline operational", "completed": False},
            {"id": "sc-3", "title": "Production verification and signoff completed", "completed": False}
        ]

    statement = (
        payload.initial_outcome_statement.strip()
        if payload.initial_outcome_statement and payload.initial_outcome_statement.strip()
        else f"Successfully deliver {payload.name} for {payload.customer_name}."
    )

    # 1. Create initial Outcome (v1)
    outcome = Outcome(
        id=outcome_id,
        engagement_id=engagement_id,
        version=1,
        statement=statement,
        success_criteria=criteria,
        status=OutcomeStatus.APPROVED,
        created_by=current_user["name"],
        approved_by=current_user["name"],
        created_at=datetime.utcnow(),
        approved_at=datetime.utcnow()
    )
    db.add(outcome)

    # 2. Create Engagement
    eng = Engagement(
        id=engagement_id,
        customer_name=payload.customer_name.strip(),
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else f"Engagement initiative for {payload.customer_name}.",
        status=EngagementStatus.HEALTHY,
        current_work_cycle=WorkCycleStep.STEP_1_UNDERSTAND_BUSINESS_REALITY,
        progress=10,
        current_outcome_id=outcome_id,
        created_by=current_user["name"],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(eng)

    # 3. Create initial timeline event
    timeline_evt = TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="ENGAGEMENT_CREATED",
        title="Engagement Initialized",
        description=f"Manager {current_user['name']} initialized new engagement for {payload.customer_name}.",
        actor_type="MANAGER",
        actor_id=current_user["name"],
        created_at=datetime.utcnow()
    )
    db.add(timeline_evt)

    # 4. Ingest baseline documentation into KNOW Agent vector store
    doc_text = f"Customer: {payload.customer_name}\nEngagement: {payload.name}\nDescription: {payload.description or ''}\nOutcome Goal: {statement}"
    know_agent.ingest_document(
        engagement_id=engagement_id,
        title=f"{payload.customer_name} Architecture & Scope Baseline",
        raw_text=doc_text
    )

    db.commit()
    db.refresh(eng)

    return {
        "success": True,
        "data": {
            "id": eng.id,
            "customer_name": eng.customer_name,
            "name": eng.name,
            "description": eng.description,
            "status": eng.status,
            "progress": eng.progress,
            "current_work_cycle": eng.current_work_cycle,
            "current_outcome_id": outcome_id,
            "version": 1,
            "success_criteria": criteria,
            "pending_approvals_count": 0,
            "created_at": eng.created_at.isoformat()
        },
        "message": f"Engagement for {eng.customer_name} created successfully"
    }


@router.get("/{engagement_id}")
def get_engagement(engagement_id: str, db: Session = Depends(get_db)):
    """Retrieve complete 360-degree state of single engagement."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    timeline = db.query(TimelineEvent).filter(TimelineEvent.engagement_id == engagement_id).order_by(TimelineEvent.created_at.desc()).all()
    approvals = db.query(Approval).filter(Approval.engagement_id == engagement_id).all()
    documents = db.query(DocumentModel).filter(DocumentModel.engagement_id == engagement_id).all()

    return {
        "success": True,
        "data": {
            "engagement": {
                "id": eng.id,
                "customer_name": eng.customer_name,
                "name": eng.name,
                "description": eng.description,
                "status": eng.status,
                "progress": eng.progress,
                "current_work_cycle": eng.current_work_cycle,
                "current_outcome_id": eng.current_outcome_id,
                "created_at": eng.created_at.isoformat()
            },
            "outcome": {
                "id": current_outcome.id,
                "version": current_outcome.version,
                "statement": current_outcome.statement,
                "success_criteria": current_outcome.success_criteria,
                "status": current_outcome.status,
                "work_plan": current_outcome.work_plan
            } if current_outcome else None,
            "timeline": [
                {
                    "id": t.id,
                    "event_type": t.event_type,
                    "title": t.title,
                    "description": t.description,
                    "actor_type": t.actor_type,
                    "actor_id": t.actor_id,
                    "created_at": t.created_at.isoformat()
                } for t in timeline
            ],
            "documents_count": len(documents),
            "pending_approvals_count": len([a for a in approvals if a.status == "PENDING"])
        }
    }


@router.post("/{engagement_id}/timeline/worknotes", tags=["Timeline"])
def record_worknote(engagement_id: str, payload: WorknotePayload, db: Session = Depends(get_db)):
    """Fast Context Capture Endpoint: Logs FDE worknote/observation into shared memory timeline."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    evt_id = f"evt-{uuid.uuid4().hex[:8]}"
    evt = TimelineEvent(
        id=evt_id,
        engagement_id=engagement_id,
        event_type=payload.event_type.upper(),
        title=payload.title,
        description=payload.description,
        actor_type="FDE",
        actor_id=payload.actor_name,
        created_at=datetime.utcnow()
    )
    db.add(evt)
    db.commit()

    return {
        "success": True,
        "data": {
            "id": evt.id,
            "engagement_id": evt.engagement_id,
            "event_type": evt.event_type,
            "title": evt.title,
            "description": evt.description,
            "actor_id": evt.actor_id,
            "created_at": evt.created_at.isoformat()
        },
        "message": "Worknote recorded into shared memory timeline successfully."
    }


@router.patch("/{engagement_id}/goals/{goal_id}/toggle")
@router.patch("/{engagement_id}/dod/{goal_id}/toggle")
def toggle_outcome_goal(engagement_id: str, goal_id: str, db: Session = Depends(get_db)):
    """Toggle completion status of an Outcome Goal criterion in active outcome."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    if not current_outcome:
        raise HTTPException(status_code=404, detail="Outcome not found")

    from sqlalchemy.orm.attributes import flag_modified
    criteria = list(current_outcome.success_criteria or [])
    updated = False
    new_completed_val = False
    for item in criteria:
        if isinstance(item, dict) and item.get("id") == goal_id:
            item["completed"] = not item.get("completed", False)
            new_completed_val = item["completed"]
            updated = True
            break

    if updated:
        current_outcome.success_criteria = criteria
        flag_modified(current_outcome, "success_criteria")

        if current_outcome.work_plan and isinstance(current_outcome.work_plan, dict):
            wp = dict(current_outcome.work_plan)
            dods = wp.get("definition_of_done", [])
            for d in dods:
                if isinstance(d, dict) and d.get("id") == goal_id:
                    d["completed"] = new_completed_val
                    break
            wp["definition_of_done"] = dods

            # Also sync any linked routine tasks
            tasks = list(wp.get("tasks", []))
            for t in tasks:
                if isinstance(t, dict) and (t.get("linked_goal_id") == goal_id or t.get("id") == goal_id):
                    t["status"] = "COMPLETED" if new_completed_val else "TODO"
            wp["tasks"] = tasks
            current_outcome.work_plan = wp
            flag_modified(current_outcome, "work_plan")

        completed_count = sum(1 for c in criteria if isinstance(c, dict) and c.get("completed"))
        eng.progress = int((completed_count / len(criteria)) * 100) if criteria else eng.progress
        db.commit()

    return {
        "success": True,
        "data": {
            "success_criteria": current_outcome.success_criteria,
            "progress": eng.progress
        },
        "message": "Outcome Goal criterion toggled successfully."
    }


@router.patch("/{engagement_id}/tasks/{task_id}")
def update_routine_task(
    engagement_id: str,
    task_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["FDE", "MANAGER"]))
):
    """Update a routine task within the active work plan."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    if not current_outcome:
        raise HTTPException(status_code=404, detail="Outcome not found")

    from sqlalchemy.orm.attributes import flag_modified
    wp = dict(current_outcome.work_plan or {})
    tasks = list(wp.get("tasks", []))
    target_task = None
    for t in tasks:
        if isinstance(t, dict) and t.get("id") == task_id:
            for k, v in payload.items():
                t[k] = v
            target_task = t
            break

    # If not yet in wp["tasks"], create or match corresponding success criterion
    if not target_task:
        crit_match = None
        for c in (current_outcome.success_criteria or []):
            if isinstance(c, dict) and c.get("id") == task_id:
                crit_match = c
                break
        target_task = {
            "id": task_id,
            "title": (crit_match.get("title") if crit_match else payload.get("title", task_id)),
            "status": payload.get("status", "IN_PROGRESS"),
            "linked_goal_id": task_id if crit_match else payload.get("linked_goal_id"),
            "due_date": payload.get("due_date")
        }
        for k, v in payload.items():
            target_task[k] = v
        tasks.append(target_task)

    wp["tasks"] = tasks
    current_outcome.work_plan = wp
    flag_modified(current_outcome, "work_plan")

    # If status or due_date changed, synchronize linked Outcome Goal criterion
    new_status = str(payload.get("status", "")).upper()
    new_due_date = payload.get("due_date")
    linked_id = target_task.get("linked_goal_id") or task_id
    criteria = list(current_outcome.success_criteria or [])
    crit_updated = False

    for c in criteria:
        if isinstance(c, dict) and (c.get("id") == linked_id or c.get("id") == task_id):
            if new_status:
                c["completed"] = (new_status in ["COMPLETED", "DONE"])
                crit_updated = True
            if new_due_date:
                c["due_date"] = new_due_date
                crit_updated = True
            break

    if crit_updated:
        current_outcome.success_criteria = criteria
        flag_modified(current_outcome, "success_criteria")
        completed_count = sum(1 for c in criteria if isinstance(c, dict) and c.get("completed"))
        eng.progress = int((completed_count / len(criteria)) * 100) if criteria else eng.progress

    eng.updated_at = datetime.utcnow()

    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", "Sarah Chen" if user_role == "FDE" else "David Miller")
    actor_id = current_user.get("id", "usr-fde-001" if user_role == "FDE" else "usr-mgr-002")

    is_completed = (new_status in ["COMPLETED", "DONE"])
    task_title = target_task.get("title") or task_id

    if is_completed:
        db.add(TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="WORKNOTE_LOGGED",
            title=f"Worknote: {task_title} completed",
            description=f"Worknote: {user_role} {actor_name} marked task '{task_title}' as completed.",
            actor_type=user_role,
            actor_id=actor_id,
            created_at=datetime.utcnow()
        ))
    elif new_due_date and not new_status:
        db.add(TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="TASK_UPDATED",
            title=f"Due Date Rescheduled: {task_title}",
            description=f"{user_role} {actor_name} updated due date for '{task_title}' to {new_due_date}.",
            actor_type=user_role,
            actor_id=actor_id,
            created_at=datetime.utcnow()
        ))
    else:
        db.add(TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="TASK_UPDATED",
            title=f"Task Updated: {task_title}",
            description=f"{user_role} {actor_name} updated task '{task_id}' to status '{target_task.get('status')}'.",
            actor_type=user_role,
            actor_id=actor_id,
            created_at=datetime.utcnow()
        ))
    db.commit()

    return {
        "success": True,
        "data": target_task,
        "progress": eng.progress,
        "message": "Routine task updated successfully."
    }


@router.post("/{engagement_id}/tasks")
def create_routine_task(
    engagement_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["FDE", "MANAGER"]))
):
    """Create a routine task in the active work plan within approved scope."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    if not current_outcome or not current_outcome.work_plan:
        raise HTTPException(status_code=400, detail="Active work plan must be established before adding tasks")

    from sqlalchemy.orm.attributes import flag_modified
    wp = dict(current_outcome.work_plan)
    tasks = list(wp.get("tasks", []))

    new_task = {
        "id": payload.get("id") or f"task-{len(tasks)+1}-{uuid.uuid4().hex[:4]}",
        "milestone_id": payload.get("milestone_id") or (wp.get("milestones", [{}])[0].get("id") if wp.get("milestones") else "m-1"),
        "title": payload.get("title", "New Task"),
        "description": payload.get("description", ""),
        "status": payload.get("status", "NOT_STARTED"),
        "dependencies": payload.get("dependencies", []),
        "estimated_days": payload.get("estimated_days", 1)
    }
    tasks.append(new_task)
    wp["tasks"] = tasks
    current_outcome.work_plan = wp
    flag_modified(current_outcome, "work_plan")
    eng.updated_at = datetime.utcnow()

    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", "Sarah Chen" if user_role == "FDE" else "David Miller")
    actor_id = current_user.get("id", "usr-fde-001" if user_role == "FDE" else "usr-mgr-002")
    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="TASK_CREATED",
        title=f"Task Created: {new_task['title']}",
        description=f"{user_role} {actor_name} created routine task '{new_task['id']}' within approved scope.",
        actor_type=user_role,
        actor_id=actor_id,
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": new_task,
        "message": "Routine task created successfully."
    }
