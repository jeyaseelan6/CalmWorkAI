"""
Specialized Agent Intelligence Endpoints (/api/v1/engagements/{engagement_id}/...).
Provides UNDERSTAND change analysis, MOVE next best action, and DELIVER executive updates.
Uses synchronous route definitions so FastAPI dispatches blocking DB I/O to threadpools.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, Optional
import uuid
import logging
from datetime import datetime
import json

from app.db.database import get_db
from app.models import (
    Engagement, Outcome, TimelineEvent,
    Approval, ApprovalType, ApprovalStatus
)
from app.auth import require_role
from app.api.deps import plan_agent, move_agent, deliver_agent, understand_agent
from app.api.schemas import (
    ChangeAnalysisRequest,
    GenerateCustomerUpdateRequest,
    SubmitCustomerUpdateRequest,
    ApprovalResponseRequest
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/engagements/{engagement_id}/analyze-change", tags=["Intelligence"])
def analyze_change_impact(engagement_id: str, payload: ChangeAnalysisRequest, db: Session = Depends(get_db)):
    """PLAN Agent: Evaluates requirement shifts and scope creep against Outcome Goals."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    statement = current_outcome.statement if current_outcome else ""
    criteria = current_outcome.success_criteria if current_outcome else []

    try:
        analysis = plan_agent.analyze_change(
            raw_change_text=payload.raw_change_text,
            current_outcome_statement=statement,
            current_success_criteria=criteria,
            session_id=payload.session_id or engagement_id
        )

        db.add(TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="CHANGE_DETECTED",
            title="Change Impact Analysis Generated",
            description=f"PLAN Agent evaluated requirement shift: '{payload.raw_change_text[:80]}...'",
            actor_type="PLAN_AGENT",
            actor_id="agent_plan",
            created_at=datetime.utcnow()
        ))
        db.commit()

        return {
            "success": True,
            "data": analysis.model_dump(),
            "message": "Change impact analysis completed safely via AI Privacy Guardrail"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing change: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
        )


_NEXT_ACTION_CACHE: Dict[str, Any] = {}


@router.get("/engagements/{engagement_id}/next-action", tags=["Intelligence"])
def get_next_best_action(engagement_id: str, db: Session = Depends(get_db)):
    """MOVE Agent: Evaluates next optimal action from current operational state (cached with 180s TTL)."""
    import time
    now_ts = time.time()
    cached = _NEXT_ACTION_CACHE.get(engagement_id)
    if cached and (now_ts - cached["ts"] < 180):
        return {
            "success": True,
            "data": cached["data"],
            "message": "MOVE Agent Next Best Action retrieved from cache."
        }

    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    version = current_outcome.version if current_outcome else 1
    approvals = db.query(Approval).filter(Approval.engagement_id == engagement_id, Approval.status == "PENDING").all()

    try:
        recommendation = move_agent.determine_next_action(
            engagement_id=engagement_id,
            customer_name=eng.customer_name,
            current_work_cycle=eng.current_work_cycle,
            status=eng.status,
            outcome_version=version,
            pending_approvals=len(approvals)
        )
        rec_data = recommendation.model_dump()
        _NEXT_ACTION_CACHE[engagement_id] = {"ts": now_ts, "data": rec_data}

        return {
            "success": True,
            "data": rec_data,
            "message": "MOVE Agent Next Best Action evaluated successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error determining next action: {str(e)}")
        return {
            "success": False,
            "data": None,
            "error": "ai_unavailable",
            "message": "AI agents are temporarily unavailable. Click 'Morning Brief' to retry when ready."
        }


@router.post("/engagements/{engagement_id}/customer-updates/generate", tags=["Delivery"])
def generate_customer_update(
    engagement_id: str,
    payload: GenerateCustomerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER", "FDE"]))
):
    """DELIVER Agent: Translates engineering work into stakeholder updates and queues for Manager review."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", "Sarah Chen" if user_role == "FDE" else "David Miller")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    statement = current_outcome.statement if current_outcome else ""
    criteria = current_outcome.success_criteria if current_outcome else []

    try:
        draft = deliver_agent.generate_customer_update(
            engagement_id=engagement_id,
            customer_name=eng.customer_name,
            engagement_name=eng.name,
            outcome_statement=statement,
            success_criteria=criteria,
            current_work_cycle=eng.current_work_cycle,
            raw_notes=payload.raw_notes,
            format_type=payload.format_type
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating customer update: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
        )

    existing_appr = db.query(Approval).filter(
        Approval.engagement_id == engagement_id,
        Approval.type == ApprovalType.CUSTOMER_UPDATE,
        Approval.status == ApprovalStatus.PENDING
    ).first()
    if existing_appr:
        existing_appr.decision_note = json.dumps(draft.model_dump())
    else:
        new_appr = Approval(
            id=f"appr-cu-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            type=ApprovalType.CUSTOMER_UPDATE,
            target_id=engagement_id,
            status=ApprovalStatus.PENDING,
            requested_by=f"{user_role} ({actor_name})",
            decision_note=json.dumps(draft.model_dump()),
            created_at=datetime.utcnow()
        )
        db.add(new_appr)
    db.commit()

    return {
        "success": True,
        "data": draft.model_dump(),
        "message": "DELIVER Agent customer update draft generated successfully. Ready for review or submission."
    }


@router.post("/engagements/{engagement_id}/customer-updates/submit", tags=["Delivery"])
def submit_customer_update(
    engagement_id: str,
    payload: SubmitCustomerUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER", "FDE"]))
):
    """FDE or Manager submits or re-submits a modified customer update report for Manager approval."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    user_role = current_user.get("role", "FDE")
    actor_name = current_user.get("name", "Sarah Chen" if user_role == "FDE" else "David Miller")

    # Invalidate any previously approved record so modified report must be approved anew
    old_approved = db.query(Approval).filter(
        Approval.engagement_id == engagement_id,
        Approval.type == ApprovalType.CUSTOMER_UPDATE,
        Approval.status == ApprovalStatus.APPROVED
    ).all()
    for o in old_approved:
        o.status = ApprovalStatus.SUPERSEDED

    # Ensure a pending approval exists for this engagement with the submitted draft payload
    draft_dict = {
        "engagement_id": engagement_id,
        "subject": payload.subject,
        "executive_summary": payload.executive_summary,
        "key_milestones_achieved": payload.key_milestones_achieved,
        "next_milestone_target": payload.next_milestone_target,
        "customer_action_items": payload.customer_action_items,
        "format_type": payload.format_type,
        "privacy_scrubbed": payload.privacy_scrubbed,
        "status": "PENDING_MANAGER_APPROVAL"
    }

    existing_pending = db.query(Approval).filter(
        Approval.engagement_id == engagement_id,
        Approval.type == ApprovalType.CUSTOMER_UPDATE,
        Approval.status == ApprovalStatus.PENDING
    ).first()

    if existing_pending:
        existing_pending.requested_by = f"{user_role} ({actor_name})"
        existing_pending.decision_note = json.dumps(draft_dict)
        existing_pending.created_at = datetime.utcnow()
        approval_id = existing_pending.id
    else:
        approval_id = f"appr-cu-{uuid.uuid4().hex[:8]}"
        new_appr = Approval(
            id=approval_id,
            engagement_id=engagement_id,
            type=ApprovalType.CUSTOMER_UPDATE,
            target_id=engagement_id,
            status=ApprovalStatus.PENDING,
            requested_by=f"{user_role} ({actor_name})",
            decision_note=json.dumps(draft_dict),
            created_at=datetime.utcnow()
        )
        db.add(new_appr)

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="CUSTOMER_UPDATE_SUBMITTED",
        title="Executive Customer Report Submitted for Approval",
        description=f"{user_role} ({actor_name}) submitted report '{payload.subject}' for Manager approval.",
        actor_type=user_role,
        actor_id=current_user.get("id", "usr-fde-001"),
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": {
            "engagement_id": engagement_id,
            "approval_id": approval_id,
            "status": "PENDING_MANAGER_APPROVAL",
            "subject": payload.subject,
            "executive_summary": payload.executive_summary,
            "key_milestones_achieved": payload.key_milestones_achieved,
            "next_milestone_target": payload.next_milestone_target,
            "customer_action_items": payload.customer_action_items,
            "format_type": payload.format_type,
            "privacy_scrubbed": payload.privacy_scrubbed,
            "submitted_by": f"{user_role} ({actor_name})",
            "submitted_at": datetime.utcnow().isoformat()
        },
        "message": "Customer update report submitted for Manager approval successfully."
    }


@router.post("/engagements/{engagement_id}/customer-updates/approve", tags=["Delivery"])
def approve_customer_update(
    engagement_id: str,
    payload: Optional[ApprovalResponseRequest] = None,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER"]))
):
    """Manager approves executive customer update draft for external client delivery."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    manager_name = current_user.get("name", "David Miller")
    decision_note = payload.decision_note if payload and payload.decision_note else "Manager approved executive summary for client delivery."

    pending_apprs = db.query(Approval).filter(
        Approval.engagement_id == engagement_id,
        Approval.type == ApprovalType.CUSTOMER_UPDATE,
        Approval.status == ApprovalStatus.PENDING
    ).all()

    for appr in pending_apprs:
        appr.status = ApprovalStatus.APPROVED
        appr.reviewed_by = manager_name
        if appr.decision_note:
            try:
                d = json.loads(appr.decision_note)
                if isinstance(d, dict) and "subject" in d:
                    d["status"] = "APPROVED"
                    d["approved_by"] = manager_name
                    appr.decision_note = json.dumps(d)
            except Exception:
                appr.decision_note = decision_note
        else:
            appr.decision_note = decision_note
        appr.reviewed_at = datetime.utcnow()

    if not pending_apprs:
        approved_record = Approval(
            id=f"appr-cu-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            type=ApprovalType.CUSTOMER_UPDATE,
            target_id=engagement_id,
            status=ApprovalStatus.APPROVED,
            requested_by="FDE (DELIVER Agent)",
            reviewed_by=manager_name,
            decision_note=decision_note,
            reviewed_at=datetime.utcnow(),
            created_at=datetime.utcnow()
        )
        db.add(approved_record)

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="CUSTOMER_UPDATE_APPROVED",
        title="Executive Customer Update Approved",
        description=f"Manager ({manager_name}) approved executive customer update. Release authorized for FDE or Manager client distribution.",
        actor_type="MANAGER",
        actor_id=current_user.get("id", "usr-mgr-002"),
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": {
            "engagement_id": engagement_id,
            "status": "APPROVED",
            "approved": True,
            "approved_by": manager_name,
            "approved_at": datetime.utcnow().isoformat()
        },
        "message": "Executive customer update approved successfully. Download and release authorized for FDE and Manager."
    }


@router.get("/engagements/{engagement_id}/customer-updates/draft", tags=["Delivery"])
def get_customer_update_draft(
    engagement_id: str,
    db: Session = Depends(get_db)
):
    """Retrieve the latest saved or approved customer update draft for this workspace."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    latest_appr = db.query(Approval).filter(
        Approval.engagement_id == engagement_id,
        Approval.type == ApprovalType.CUSTOMER_UPDATE
    ).order_by(Approval.created_at.desc()).first()

    if latest_appr and latest_appr.decision_note:
        try:
            parsed = json.loads(latest_appr.decision_note)
            if isinstance(parsed, dict) and "subject" in parsed:
                return {
                    "success": True,
                    "data": parsed,
                    "message": "Latest customer update draft retrieved."
                }
        except Exception:
            pass

    return {
        "success": False,
        "data": None,
        "message": "No customer update draft found for this workspace."
    }


@router.get("/engagements/{engagement_id}/customer-updates/status", tags=["Delivery"])
def get_customer_update_approval_status(engagement_id: str, db: Session = Depends(get_db)):
    """Retrieve customer update approval status."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    latest_approval = db.query(Approval).filter(
        Approval.engagement_id == engagement_id,
        Approval.type == ApprovalType.CUSTOMER_UPDATE
    ).order_by(Approval.created_at.desc()).first()

    is_approved = (latest_approval.status == ApprovalStatus.APPROVED) if latest_approval else False

    return {
        "success": True,
        "data": {
            "engagement_id": engagement_id,
            "approved": is_approved,
            "status": latest_approval.status if latest_approval else "NO_DRAFT",
            "reviewed_by": latest_approval.reviewed_by if latest_approval else None,
            "reviewed_at": latest_approval.reviewed_at.isoformat() if latest_approval and latest_approval.reviewed_at else None
        },
        "message": "Customer update approval status retrieved."
    }


@router.get("/engagements/{engagement_id}/customer-updates/pdf-status", tags=["Delivery"])
def verify_customer_update_pdf_export_authorization(
    engagement_id: str,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER", "FDE"]))
):
    """
    Enforces strict Manager Approval Gating for Deliver Agent Executive Customer Update PDF export.
    Returns 403 Forbidden until an Engineering Manager has authorized the report release.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    latest_approval = db.query(Approval).filter(
        Approval.engagement_id == engagement_id,
        Approval.type == ApprovalType.CUSTOMER_UPDATE
    ).order_by(Approval.created_at.desc()).first()

    if not latest_approval or latest_approval.status != ApprovalStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager approval required: The DELIVER agent report cannot be downloaded or viewed as PDF until approved by an Engineering Manager."
        )

    return {
        "success": True,
        "data": {
            "engagement_id": engagement_id,
            "pdf_authorized": True,
            "status": "APPROVED",
            "approved_by": latest_approval.reviewed_by or "Engineering Manager",
            "approved_at": latest_approval.reviewed_at.isoformat() if latest_approval.reviewed_at else None
        },
        "message": "DELIVER agent executive report release authorized for PDF download by Engineering Manager."
    }

