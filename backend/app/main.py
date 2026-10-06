from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging

from app.config import settings
from app.db.database import get_db, init_db
from app.models import Engagement, Outcome, TimelineEvent, Approval
from app.privacy import PrivacyPolicyEngine
from app.services import OutcomeService
from app.agents import UnderstandAgent, ChangeImpactAnalysis

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

privacy_engine = PrivacyPolicyEngine(
    use_cloud_dlp=settings.USE_CLOUD_DLP_API,
    gcp_project_id=settings.GCP_PROJECT_ID
)

understand_agent = UnderstandAgent(privacy_engine=privacy_engine)


class ChangeAnalysisRequest(BaseModel):
    raw_change_text: str
    session_id: Optional[str] = None


class ProposeOutcomeRequest(BaseModel):
    statement: str
    success_criteria: List[Dict[str, Any]]
    proposed_by: str = "understand_agent"
    reason: str


class ApprovalResponseRequest(BaseModel):
    action: str  # "APPROVE" | "REJECT"
    actor_id: str = "manager_user_1"
    outcome_id: Optional[str] = None


@app.on_event("startup")
def on_startup():
    init_db()
    logger.info("Database initialized successfully.")


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "privacy_guardrail": "enabled" if settings.PRIVACY_GUARDRAIL_ENABLED else "disabled"
    }


@app.get(f"{settings.API_V1_STR}/engagements", tags=["Engagements"])
async def list_engagements(db: Session = Depends(get_db)):
    """List all engagements."""
    engagements = db.query(Engagement).all()
    result = []
    for eng in engagements:
        current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
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
            "created_at": eng.created_at.isoformat()
        })
    return {
        "success": True,
        "data": result,
        "message": "Engagements retrieved successfully"
    }


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}", tags=["Engagements"])
async def get_engagement(engagement_id: str, db: Session = Depends(get_db)):
    """Get single engagement workspace detail."""
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
        
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    timeline = db.query(TimelineEvent).filter(TimelineEvent.engagement_id == engagement_id).order_by(TimelineEvent.created_at.desc()).all()
    approvals = db.query(Approval).filter(Approval.engagement_id == engagement_id).all()
    
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
                "status": current_outcome.status
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
            "pending_approvals_count": len([a for a in approvals if a.status == "PENDING"])
        }
    }


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/analyze-change", tags=["Intelligence"])
async def analyze_change_impact(engagement_id: str, payload: ChangeAnalysisRequest, db: Session = Depends(get_db)):
    """
    UNDERSTAND Agent endpoint: Runs pre-LLM privacy anonymization guardrail
    and analyzes scope/requirement impact.
    """
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
        return {
            "success": True,
            "data": analysis.model_dump(),
            "message": "Change impact analysis completed safely via AI Privacy Guardrail"
        }
    except Exception as e:
        logger.error(f"Error analyzing change: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/outcomes/history", tags=["Outcomes"])
async def get_outcome_history(engagement_id: str, db: Session = Depends(get_db)):
    """Fetch immutable outcome version history."""
    outcome_service = OutcomeService(db)
    history = outcome_service.get_outcome_history(engagement_id)
    return {
        "success": True,
        "data": [
            {
                "id": o.id,
                "version": o.version,
                "statement": o.statement,
                "success_criteria": o.success_criteria,
                "status": o.status,
                "created_by": o.created_by,
                "approved_by": o.approved_by,
                "created_at": o.created_at.isoformat()
            } for o in history
        ]
    }


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/approvals/respond", tags=["Approvals"])
async def respond_to_approval(engagement_id: str, payload: ApprovalResponseRequest, db: Session = Depends(get_db)):
    """
    Manager Approval Endpoint: Accepts or rejects outcome change recommendation,
    performing atomic Version 2 transition and updated DoD checklist activation.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    outcome_service = OutcomeService(db)

    if payload.action == "APPROVE":
        # 1. Propose and approve Version 2
        current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
        updated_criteria = list(current_outcome.success_criteria or [])
        if not any(c.get("id") == "sc-4" for c in updated_criteria):
            updated_criteria.append({
                "id": "sc-4",
                "title": "Enterprise SSO configuration & validation (Added v2)",
                "completed": False
            })

        new_v2 = outcome_service.propose_new_outcome_version(
            engagement_id=engagement_id,
            new_statement=current_outcome.statement,
            new_success_criteria=updated_criteria,
            proposed_by="understand_agent",
            reason="Manager approved Enterprise SSO scope expansion."
        )

        # 2. Activate Version 2
        updated_eng = outcome_service.approve_outcome_version(
            engagement_id=engagement_id,
            outcome_id=new_v2.id,
            approved_by=payload.actor_id
        )

        return {
            "success": True,
            "data": {
                "engagement_id": updated_eng.id,
                "new_version": new_v2.version,
                "status": updated_eng.status,
                "current_outcome_id": updated_eng.current_outcome_id
            },
            "message": "Outcome Version 2 approved and activated successfully."
        }
    else:
        eng.status = "HEALTHY"
        db.commit()
        return {
            "success": True,
            "data": {"engagement_id": engagement_id, "status": "HEALTHY"},
            "message": "Outcome change proposal rejected."
        }
