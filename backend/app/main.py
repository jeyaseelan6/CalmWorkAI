from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.config import settings
from app.db.database import get_db, init_db
from app.models import Engagement, Outcome, TimelineEvent, Approval
from app.privacy import PrivacyPolicyEngine
import logging

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
            "current_outcome": current_outcome.statement if current_outcome else None,
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
