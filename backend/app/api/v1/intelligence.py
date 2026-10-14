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

from app.db.database import get_db
from app.models import (
    Engagement, Outcome, TimelineEvent,
    Approval, ApprovalType, ApprovalStatus
)
from app.auth import require_role
from app.api.deps import understand_agent, move_agent, deliver_agent
from app.api.schemas import (
    ChangeAnalysisRequest,
    GenerateCustomerUpdateRequest,
    ApprovalResponseRequest
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/engagements/{engagement_id}/analyze-change", tags=["Intelligence"])
def analyze_change_impact(engagement_id: str, payload: ChangeAnalysisRequest, db: Session = Depends(get_db)):
    """UNDERSTAND Agent: Evaluates requirement shifts and scope creep against Outcome Goals."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    statement = current_outcome.statement if current_outcome else ""
    criteria = current_outcome.success_criteria if current_outcome else []

    try:
        analysis = understand_agent.analyze_change(
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
            description=f"UNDERSTAND Agent evaluated requirement shift: '{payload.raw_change_text[:80]}...'",
            actor_type="UNDERSTAND_AGENT",
            actor_id="agent_understand",
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


@router.get("/engagements/{engagement_id}/next-action", tags=["Intelligence"])
def get_next_best_action(engagement_id: str, db: Session = Depends(get_db)):
    """MOVE Agent: Evaluates next optimal action from current operational state."""
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

        return {
            "success": True,
            "data": recommendation.model_dump(),
            "message": "MOVE Agent Next Best Action evaluated successfully."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error determining next action: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
        )


@router.post("/engagements/{engagement_id}/customer-updates/generate", tags=["Delivery"])
def generate_customer_update(engagement_id: str, payload: GenerateCustomerUpdateRequest, db: Session = Depends(get_db)):
    """DELIVER Agent: Translates engineering work into stakeholder updates and queues for Manager review."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

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
    if not existing_appr:
        new_appr = Approval(
            id=f"appr-cu-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            type=ApprovalType.CUSTOMER_UPDATE,
            target_id=engagement_id,
            status=ApprovalStatus.PENDING,
            requested_by="FDE (DELIVER Agent)",
            created_at=datetime.utcnow()
        )
        db.add(new_appr)
        db.commit()

    return {
        "success": True,
        "data": draft.model_dump(),
        "message": "DELIVER Agent customer update draft generated successfully. Pending Manager Approval."
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
