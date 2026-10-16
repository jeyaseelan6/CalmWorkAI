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
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

from app.db.database import get_db
from app.models import (
    Engagement, EngagementStatus, WorkCycleStep, Outcome, OutcomeStatus,
    TimelineEvent, Approval, ApprovalType, ApprovalStatus, DocumentModel
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

    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", "Sarah Chen" if user_role == "FDE" else "David Miller")
    actor_id = current_user.get("id", "usr-fde-001" if user_role == "FDE" else "usr-mgr-002")

    # 1. Create initial Outcome (v1)
    outcome = Outcome(
        id=outcome_id,
        engagement_id=engagement_id,
        version=1,
        statement=statement,
        success_criteria=criteria,
        status=OutcomeStatus.APPROVED,
        created_by=actor_name,
        approved_by=actor_name,
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
        created_by=actor_name,
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
        description=f"{user_role} {actor_name} initialized new engagement for {payload.customer_name}.",
        actor_type=user_role,
        actor_id=actor_id,
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
def record_worknote(
    engagement_id: str,
    payload: WorknotePayload,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER", "FDE"]))
):
    """Fast Context Capture Endpoint: Logs Manager or FDE worknote/observation into shared memory timeline."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    user_role = current_user.get("role", "FDE")
    actor_name = payload.actor_name if payload.actor_name and payload.actor_name != "Sarah Chen" else current_user.get("name", payload.actor_name or "Engineer")

    evt_id = f"evt-{uuid.uuid4().hex[:8]}"
    evt = TimelineEvent(
        id=evt_id,
        engagement_id=engagement_id,
        event_type=payload.event_type.upper(),
        title=payload.title,
        description=payload.description,
        actor_type=user_role,
        actor_id=actor_name,
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
            target_task = t
            break

    # If pending manager approval, block status transitions until approved
    if target_task and target_task.get("approval_status") == "PENDING_APPROVAL":
        new_status = payload.get("status")
        if new_status and str(new_status).upper() in ["COMPLETED", "DONE", "IN_PROGRESS"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task is pending manager approval. Newly created tasks must be approved by an Engineering Manager before becoming approved work."
            )

    # Apply updates to target task
    if target_task:
        for k, v in payload.items():
            target_task[k] = v

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
            "approval_status": "APPROVED",
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
    """
    Create routine tasks in the active work plan within approved scope.
    Manager creates tasks as approved work.
    FDE creates tasks submitted for Manager approval before becoming approved work.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    if not current_outcome:
        raise HTTPException(status_code=404, detail="Active outcome not found")

    from sqlalchemy.orm.attributes import flag_modified
    wp = dict(current_outcome.work_plan or {})
    if "milestones" not in wp or not wp["milestones"]:
        wp["milestones"] = [{"id": "m-1", "title": "Milestone 1", "sequence_order": 1}]
    if "tasks" not in wp or not isinstance(wp["tasks"], list):
        wp["tasks"] = []

    tasks = list(wp["tasks"])
    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", "Sarah Chen" if user_role == "FDE" else "David Miller")
    actor_id = current_user.get("id", "usr-fde-001" if user_role == "FDE" else "usr-mgr-002")
    task_appr_status = "APPROVED" if user_role == "MANAGER" else "PENDING_APPROVAL"

    # Check for batch tasks (e.g. from Plan Agent)
    batch_tasks = payload.get("tasks")
    if isinstance(batch_tasks, list) and len(batch_tasks) > 0:
        added_tasks = []
        default_ms = wp["milestones"][0].get("id", "m-1") if wp["milestones"] else "m-1"
        for idx, item in enumerate(batch_tasks):
            if not isinstance(item, dict):
                continue
            title = item.get("title") or item.get("name") or f"Task {len(tasks)+1}"
            task_id = item.get("id") or f"task-{len(tasks)+1}-{uuid.uuid4().hex[:4]}"
            # Deduplicate by task_id or title
            if any(t.get("id") == task_id or t.get("title") == title for t in tasks):
                continue
            new_item = {
                "id": task_id,
                "milestone_id": item.get("milestone_id") or default_ms,
                "title": title,
                "description": item.get("description", item.get("why_it_matters", "")),
                "status": item.get("status", "TODO"),
                "approval_status": task_appr_status,
                "sequence_order": item.get("sequence_order", len(tasks) + 1),
                "due_date": item.get("due_date"),
                "linked_goal_id": item.get("linked_goal_id") or task_id,
                "dependencies": item.get("dependencies", []),
                "estimated_days": item.get("estimated_days", 1)
            }
            tasks.append(new_item)
            added_tasks.append(new_item)

            if user_role != "MANAGER":
                db.add(Approval(
                    id=f"appr-task-{uuid.uuid4().hex[:8]}",
                    engagement_id=engagement_id,
                    type=ApprovalType.TASK_CREATION,
                    target_id=task_id,
                    status=ApprovalStatus.PENDING,
                    requested_by=f"FDE ({actor_name})",
                    decision_note=f"Task: {title}",
                    created_at=datetime.utcnow()
                ))

        wp["tasks"] = tasks
        current_outcome.work_plan = wp
        flag_modified(current_outcome, "work_plan")
        eng.updated_at = datetime.utcnow()

        if user_role == "MANAGER":
            db.add(TimelineEvent(
                id=f"evt-{uuid.uuid4().hex[:8]}",
                engagement_id=engagement_id,
                event_type="TASKS_INGESTED",
                title=f"Plan Agent Tasks Added & Approved ({len(added_tasks)} tasks)",
                description=f"Manager {actor_name} added and approved {len(added_tasks)} tasks generated by Plan Agent to work plan.",
                actor_type=user_role,
                actor_id=actor_id,
                created_at=datetime.utcnow()
            ))
            msg = f"{len(added_tasks)} tasks added to work plan and approved."
        else:
            db.add(TimelineEvent(
                id=f"evt-{uuid.uuid4().hex[:8]}",
                engagement_id=engagement_id,
                event_type="TASKS_SUBMITTED_FOR_APPROVAL",
                title=f"Plan Agent Tasks Submitted for Approval ({len(added_tasks)} tasks)",
                description=f"FDE {actor_name} added {len(added_tasks)} tasks generated by Plan Agent, submitted for Manager approval.",
                actor_type=user_role,
                actor_id=actor_id,
                created_at=datetime.utcnow()
            ))
            msg = f"{len(added_tasks)} tasks created and submitted for manager approval."

        db.commit()

        return {
            "success": True,
            "data": added_tasks,
            "tasks": tasks,
            "message": msg
        }

    # Single task creation (Manager or FDE manual add task)
    default_ms = wp["milestones"][0].get("id", "m-1") if wp["milestones"] else "m-1"
    task_id = payload.get("id") or f"task-{len(tasks)+1}-{uuid.uuid4().hex[:4]}"
    title = payload.get("title", "New Task")
    new_task = {
        "id": task_id,
        "milestone_id": payload.get("milestone_id") or default_ms,
        "title": title,
        "description": payload.get("description", payload.get("why_it_matters", "")),
        "status": payload.get("status", "TODO"),
        "approval_status": task_appr_status,
        "sequence_order": payload.get("sequence_order", len(tasks) + 1),
        "due_date": payload.get("due_date"),
        "linked_goal_id": payload.get("linked_goal_id"),
        "dependencies": payload.get("dependencies", []),
        "estimated_days": payload.get("estimated_days", 1)
    }
    tasks.append(new_task)
    wp["tasks"] = tasks
    current_outcome.work_plan = wp
    flag_modified(current_outcome, "work_plan")
    eng.updated_at = datetime.utcnow()

    if user_role == "MANAGER":
        db.add(TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="TASK_CREATED",
            title=f"Task Created & Approved: {new_task['title']}",
            description=f"Manager {actor_name} created approved routine task '{new_task['id']}'.",
            actor_type="MANAGER",
            actor_id=actor_id,
            created_at=datetime.utcnow()
        ))
        msg = "Work task created and approved."
    else:
        db.add(Approval(
            id=f"appr-task-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            type=ApprovalType.TASK_CREATION,
            target_id=task_id,
            status=ApprovalStatus.PENDING,
            requested_by=f"FDE ({actor_name})",
            decision_note=f"Task: {title}",
            created_at=datetime.utcnow()
        ))
        db.add(TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="TASK_SUBMITTED_FOR_APPROVAL",
            title=f"Task Submitted for Approval: {new_task['title']}",
            description=f"FDE {actor_name} created task '{new_task['title']}' and submitted for Manager approval.",
            actor_type="FDE",
            actor_id=actor_id,
            created_at=datetime.utcnow()
        ))
        msg = "Routine task created and submitted for manager approval."

    db.commit()

    return {
        "success": True,
        "data": new_task,
        "tasks": tasks,
        "message": msg
    }


@router.delete("/{engagement_id}/tasks/{task_id}")
def delete_routine_task(
    engagement_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["FDE", "MANAGER"]))
):
    """
    Delete / remove a task from the active work plan.
    Both FDE and Manager have the authority to decide to remove or keep tasks.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    if not current_outcome:
        raise HTTPException(status_code=404, detail="Active outcome not found")

    from sqlalchemy.orm.attributes import flag_modified
    wp = dict(current_outcome.work_plan or {})
    tasks = list(wp.get("tasks", []))
    target_task = None
    remaining_tasks = []

    for t in tasks:
        if isinstance(t, dict) and (t.get("id") == task_id or t.get("linked_goal_id") == task_id):
            target_task = t
        else:
            remaining_tasks.append(t)

    wp["tasks"] = remaining_tasks
    current_outcome.work_plan = wp
    flag_modified(current_outcome, "work_plan")
    eng.updated_at = datetime.utcnow()

    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", "Sarah Chen" if user_role == "FDE" else "David Miller")
    actor_id = current_user.get("id", "usr-fde-001" if user_role == "FDE" else "usr-mgr-002")
    task_title = target_task.get("title", task_id) if target_task else task_id

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="TASK_REMOVED",
        title=f"Task Removed: {task_title}",
        description=f"{user_role} ({actor_name}) removed task '{task_title}' from the work plan.",
        actor_type=user_role,
        actor_id=actor_id,
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": {"task_id": task_id, "title": task_title},
        "tasks": remaining_tasks,
        "message": f"Task '{task_title}' removed successfully from work plan."
    }


@router.delete("/{engagement_id}")
def delete_engagement(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER"]))
):
    """
    Permanently delete a customer engagement and all related assets (Outcomes,
    Approvals, Documents, Timeline events, Work tasks, and Vector Store semantic chunks).
    Strictly restricted to users with the MANAGER role.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Engagement '{engagement_id}' not found."
        )

    customer_name = eng.customer_name
    engagement_name = eng.name

    # 1. Break cyclic references by clearing current_outcome_id first
    eng.current_outcome_id = None
    db.flush()

    # 2. Delete all related Approvals
    approvals_deleted = db.query(Approval).filter(Approval.engagement_id == engagement_id).delete(synchronize_session=False)

    # 3. Delete all related Outcomes (which store work plans, tasks, success criteria)
    outcomes_deleted = db.query(Outcome).filter(Outcome.engagement_id == engagement_id).delete(synchronize_session=False)

    # 4. Delete all related Document metadata & contents
    documents_deleted = db.query(DocumentModel).filter(DocumentModel.engagement_id == engagement_id).delete(synchronize_session=False)

    # 5. Delete all related Timeline Events
    events_deleted = db.query(TimelineEvent).filter(TimelineEvent.engagement_id == engagement_id).delete(synchronize_session=False)

    # 6. Delete the Engagement record itself
    db.delete(eng)
    db.commit()

    # 7. Purge Vector Store tenant memory for this engagement
    try:
        if hasattr(know_agent, "vector_store") and hasattr(know_agent.vector_store, "delete_engagement_chunks"):
            know_agent.vector_store.delete_engagement_chunks(engagement_id)
    except Exception as e:
        logger.warning(f"Error purging vector store for deleted engagement {engagement_id}: {e}")

    return {
        "success": True,
        "message": f"Engagement '{customer_name}' ({engagement_name}) and all related assets were permanently deleted.",
        "data": {
            "engagement_id": engagement_id,
            "customer_name": customer_name,
            "deleted_counts": {
                "approvals": approvals_deleted,
                "outcomes": outcomes_deleted,
                "documents": documents_deleted,
                "timeline_events": events_deleted
            }
        }
    }


