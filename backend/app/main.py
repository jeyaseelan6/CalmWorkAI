from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import uuid
from datetime import datetime

from app.config import settings
from app.db.database import get_db, init_db
from app.models import (
    Engagement, Outcome, TimelineEvent, Approval, ApprovalType, ApprovalStatus,
    DocumentModel, DocumentCategory, DocumentStatus
)
from app.privacy import PrivacyPolicyEngine
from app.services import OutcomeService
from app.agents import (
    UnderstandAgent, ChangeImpactAnalysis,
    KnowAgent, GroundedAnswer,
    MoveAgent, NextBestActionRecommendation,
    DeliverAgent, CustomerUpdateDraft
)
from app.supervisor import SupervisorCoordinator, SupervisorSummary, EngagementEvent

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

from app.auth import create_access_token, verify_password, DEMO_USERS, get_current_user, require_role

privacy_engine = PrivacyPolicyEngine(
    use_cloud_dlp=settings.USE_CLOUD_DLP_API,
    gcp_project_id=settings.GCP_PROJECT_ID
)

understand_agent = UnderstandAgent(privacy_engine=privacy_engine)
know_agent = KnowAgent(privacy_engine=privacy_engine)
move_agent = MoveAgent(privacy_engine=privacy_engine)
deliver_agent = DeliverAgent(privacy_engine=privacy_engine)
supervisor_coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post(f"{settings.API_V1_STR}/auth/login", tags=["Authentication"])
async def login(payload: LoginRequest):
    user = DEMO_USERS.get(payload.email.lower())
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    token = create_access_token({"sub": user["email"], "role": user["role"]})
    return {
        "success": True,
        "data": {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "email": user["email"],
                "name": user["name"],
                "role": user["role"],
                "title": user["title"]
            }
        },
        "message": f"Successfully authenticated as {user['name']} ({user['role']})"
    }


@app.get(f"{settings.API_V1_STR}/auth/me", tags=["Authentication"])
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    return {
        "success": True,
        "data": {
            "id": current_user["id"],
            "email": current_user["email"],
            "name": current_user["name"],
            "role": current_user["role"],
            "title": current_user["title"]
        }
    }


class ChangeAnalysisRequest(BaseModel):
    raw_change_text: str
    session_id: Optional[str] = None


class ApprovalResponseRequest(BaseModel):
    action: str  # "APPROVE" | "REJECT"
    actor_id: str = "manager_user_1"
    decision_note: Optional[str] = None


class IngestDocumentRequest(BaseModel):
    title: str
    category: str = "Technical Documentation"
    content: str


class KnowledgeQueryRequest(BaseModel):
    question: str
    top_k: int = 3


class GenerateCustomerUpdateRequest(BaseModel):
    raw_notes: Optional[str] = None
    format_type: str = "EXECUTIVE_SUMMARY"


@app.on_event("startup")
def on_startup():
    init_db()
    # Seed default sample documentation
    know_agent.ingest_document(
        engagement_id="eng-acme-001",
        title="Acme Corp Enterprise Security & SSO Mandate",
        raw_text=(
            "Acme Corp enterprise security team requires all customer onboarding microservices "
            "to authenticate via Enterprise Single Sign-On (SSO) using SAML 2.0 / OAuth2 OIDC before production cutover."
        )
    )
    know_agent.ingest_document(
        engagement_id="eng-globex-002",
        title="Globex Legacy Data Migration CDC Specs",
        raw_text=(
            "Globex Corp legacy data migration pipeline utilizes Debezium Change Data Capture (CDC) stream "
            "replicating 50M records from on-prem PostgreSQL to GCP Cloud SQL with zero downtime and a maximum 15 min cutover window."
        )
    )
    logger.info("Database initialized and sample engagement documentation ingested into KNOW Agent vector store.")


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
    engagements = db.query(Engagement).all()
    result = []
    for eng in engagements:
        current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
        pending_approvals = db.query(Approval).filter(Approval.engagement_id == eng.id, Approval.status == ApprovalStatus.PENDING).count()
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
            "pending_approvals_count": pending_approvals,
            "created_at": eng.created_at.isoformat()
        })
    return {
        "success": True,
        "data": result,
        "message": "Engagements retrieved successfully"
    }


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}", tags=["Engagements"])
async def get_engagement(engagement_id: str, db: Session = Depends(get_db)):
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
            "documents_count": len(documents),
            "pending_approvals_count": len([a for a in approvals if a.status == "PENDING"])
        }
    }


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/analyze-change", tags=["Intelligence"])
async def analyze_change_impact(engagement_id: str, payload: ChangeAnalysisRequest, db: Session = Depends(get_db)):
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

        # Log timeline detection event (does not mutate outcome state silently)
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
    except Exception as e:
        logger.error(f"Error analyzing change: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get(f"{settings.API_V1_STR}/approvals", tags=["Approvals"])
async def list_pending_approvals(db: Session = Depends(get_db)):
    """List all pending manager approvals with Recommendation, Why, Evidence, Impact, Confidence."""
    approvals = db.query(Approval).filter(Approval.status == ApprovalStatus.PENDING).all()
    result = []
    for appr in approvals:
        eng = db.query(Engagement).filter(Engagement.id == appr.engagement_id).first()
        result.append({
            "id": appr.id,
            "engagement_id": appr.engagement_id,
            "customer_name": eng.customer_name if eng else "Customer",
            "type": appr.type,
            "recommendation": f"Upgrade Definition of Done criteria and outcome for {eng.customer_name if eng else 'customer'}." if appr.type == ApprovalType.OUTCOME_CHANGE else "Approve consequential action.",
            "why": "Customer requirement changed, gating production validation step.",
            "evidence": [f"Requirement input received", f"Current outcome DoD affected"],
            "impact": "Updates DoD checklist and allows production rollout.",
            "confidence": "High",
            "status": appr.status,
            "requested_by": appr.requested_by,
            "created_at": appr.created_at.isoformat()
        })
    return {
        "success": True,
        "data": result,
        "message": "Pending approvals retrieved successfully."
    }


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/approvals/respond", tags=["Approvals"])
async def respond_to_approval(engagement_id: str, payload: ApprovalResponseRequest, db: Session = Depends(get_db)):
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    outcome_service = OutcomeService(db)

    if payload.action == "APPROVE":
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

        updated_eng = outcome_service.approve_outcome_version(
            engagement_id=engagement_id,
            outcome_id=new_v2.id,
            approved_by=payload.actor_id
        )

        # Log timeline approval event
        db.add(TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="OUTCOME_APPROVED",
            title="Outcome Version Approved",
            description=f"Manager ({payload.actor_id}) approved transition to Outcome Version {new_v2.version}.",
            actor_type="MANAGER",
            actor_id=payload.actor_id,
            created_at=datetime.utcnow()
        ))
        db.commit()

        return {
            "success": True,
            "data": {
                "engagement_id": updated_eng.id,
                "new_version": new_v2.version,
                "status": updated_eng.status,
                "current_outcome_id": updated_eng.current_outcome_id
            },
            "message": f"Outcome Version {new_v2.version} approved and activated successfully."
        }
    else:
        eng.status = "HEALTHY"
        db.commit()
        return {
            "success": True,
            "data": {"engagement_id": engagement_id, "status": "HEALTHY"},
            "message": "Outcome change proposal rejected."
        }


# Knowledge Document Ingestion Endpoints
@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/documents", tags=["Knowledge"])
async def list_documents(engagement_id: str, db: Session = Depends(get_db)):
    docs = db.query(DocumentModel).filter(DocumentModel.engagement_id == engagement_id).all()
    return {
        "success": True,
        "data": [
            {
                "id": d.id,
                "engagement_id": d.engagement_id,
                "title": d.title,
                "category": d.category,
                "status": d.status,
                "chunks_count": d.chunks_count,
                "uploaded_by": d.uploaded_by,
                "created_at": d.created_at.isoformat()
            } for d in docs
        ]
    }


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/documents/upload", tags=["Knowledge"])
async def upload_document(
    engagement_id: str,
    payload: IngestDocumentRequest,
    db: Session = Depends(get_db)
):
    """
    Manager Document Upload endpoint: Categorizes and indexes document into KNOW Agent.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    # Ingest into vector store
    result = know_agent.ingest_document(
        engagement_id=engagement_id,
        title=payload.title,
        raw_text=payload.content
    )

    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    category_enum = DocumentCategory.OTHER
    try:
        category_enum = DocumentCategory(payload.category)
    except Exception:
        category_enum = DocumentCategory.OTHER

    doc = DocumentModel(
        id=doc_id,
        engagement_id=engagement_id,
        title=payload.title,
        category=category_enum,
        status=DocumentStatus.INDEXED,
        content=payload.content,
        chunks_count=result.get("chunks_created", 1),
        uploaded_by="manager_user_1",
        created_at=datetime.utcnow()
    )
    db.add(doc)

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="DOCUMENT_INGESTED",
        title="Document Uploaded & Indexed",
        description=f"Manager uploaded document '{payload.title}' categorized as '{category_enum.value}'.",
        actor_type="MANAGER",
        actor_id="manager_user_1",
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": {
            "id": doc.id,
            "title": doc.title,
            "category": doc.category,
            "status": doc.status,
            "chunks_count": doc.chunks_count
        },
        "message": f"Document '{payload.title}' uploaded and indexed under category '{category_enum.value}'."
    }


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/knowledge/query", tags=["Knowledge"])
async def query_knowledge(engagement_id: str, payload: KnowledgeQueryRequest):
    grounded_answer = know_agent.answer_question(
        engagement_id=engagement_id,
        raw_question=payload.question,
        top_k=payload.top_k
    )
    return {
        "success": True,
        "data": grounded_answer.model_dump(),
        "message": "Grounded Q&A response generated with source citations."
    }


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/next-action", tags=["Intelligence"])
async def get_next_best_action(engagement_id: str, db: Session = Depends(get_db)):
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    version = current_outcome.version if current_outcome else 1
    approvals = db.query(Approval).filter(Approval.engagement_id == engagement_id, Approval.status == "PENDING").all()

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


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/customer-updates/generate", tags=["Delivery"])
async def generate_customer_update(engagement_id: str, payload: GenerateCustomerUpdateRequest, db: Session = Depends(get_db)):
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    statement = current_outcome.statement if current_outcome else ""
    criteria = current_outcome.success_criteria if current_outcome else []

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

    return {
        "success": True,
        "data": draft.model_dump(),
        "message": "DELIVER Agent customer update draft generated successfully."
    }


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/supervisor/summary", tags=["Supervisor"])
async def get_supervisor_summary(engagement_id: str, db: Session = Depends(get_db)):
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


class UniversalSupervisorQueryPayload(BaseModel):
    query: str


class WorknotePayload(BaseModel):
    event_type: str = "WORKNOTE"  # WORKNOTE, CUSTOMER_INPUT, DECISION, OBSERVATION, PROGRESS
    title: str
    description: str
    actor_name: str = "FDE User"


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/supervisor/query", tags=["Supervisor"])
async def query_universal_supervisor(engagement_id: str, payload: UniversalSupervisorQueryPayload, db: Session = Depends(get_db)):
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

    response = supervisor_coordinator.query_supervisor(
        engagement_id=engagement_id,
        customer_name=eng.customer_name,
        raw_query=payload.query,
        current_work_cycle=eng.current_work_cycle,
        status=eng.status,
        outcome_statement=statement,
        success_criteria=criteria,
        version=version,
        pending_approvals=len(approvals)
    )

    return {
        "success": True,
        "data": response.model_dump(),
        "message": "Supervisor universal query processed successfully."
    }


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/supervisor/brief", tags=["Supervisor"])
async def get_daily_work_brief(engagement_id: str, db: Session = Depends(get_db)):
    """
    Proactive Intelligence Mode: Generates a 10-point Daily Work Briefing.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    statement = current_outcome.statement if current_outcome else ""
    version = current_outcome.version if current_outcome else 1
    approvals = db.query(Approval).filter(Approval.engagement_id == engagement_id, Approval.status == "PENDING").all()

    brief = supervisor_coordinator.generate_daily_work_brief(
        engagement_id=engagement_id,
        customer_name=eng.customer_name,
        status=eng.status,
        outcome_statement=statement,
        version=version,
        pending_approvals=len(approvals)
    )

    return {
        "success": True,
        "data": brief.model_dump(),
        "message": "Daily work intelligence brief generated successfully."
    }


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/timeline/worknotes", tags=["Timeline"])
async def record_worknote(engagement_id: str, payload: WorknotePayload, db: Session = Depends(get_db)):
    """
    Fast Context Capture Endpoint ('Do work -> record what matters'):
    Logs FDE worknote/observation/decision into PostgreSQL shared memory timeline.
    """
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

