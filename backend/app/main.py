from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging
import uuid
import re
from datetime import datetime

from app.config import settings
from app.db.database import get_db, init_db
from app.models import (
    Engagement, EngagementStatus, WorkCycleStep, Outcome, OutcomeStatus,
    TimelineEvent, Approval, ApprovalType, ApprovalStatus,
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
from app.supervisor import (
    SupervisorCoordinator, SupervisorSummary, EngagementEvent,
    StructuredWorkPlanProposal, WorkMilestone, WorkTask, FactAssumptionGap
)

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

from app.auth import create_access_token, verify_password, DEMO_USERS, get_current_user, require_role, decode_access_token, security_bearer
from fastapi.security import HTTPAuthorizationCredentials

from app.services import OutcomeService, StorageService, extract_text_from_file, text_to_pdf_bytes

privacy_engine = PrivacyPolicyEngine(
    use_cloud_dlp=settings.USE_CLOUD_DLP_API,
    gcp_project_id=settings.GCP_PROJECT_ID
)

storage_service = StorageService()
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
async def get_me(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer)):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Bearer token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    if token == "demo-manager-token":
        user = DEMO_USERS["manager@calmwork.ai"]
    elif token == "demo-fde-token":
        user = DEMO_USERS["fde@calmwork.ai"]
    else:
        payload = decode_access_token(token)
        if not payload or "sub" not in payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        email = payload["sub"]
        user = DEMO_USERS.get(email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return {
        "success": True,
        "data": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user["role"],
            "title": user["title"]
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


class CreateEngagementRequest(BaseModel):
    customer_name: str
    name: str
    description: Optional[str] = ""
    initial_outcome_statement: Optional[str] = ""
    success_criteria: Optional[List[str]] = []


class GenerateCustomerUpdateRequest(BaseModel):
    raw_notes: Optional[str] = None
    format_type: str = "EXECUTIVE_SUMMARY"


class ProposeWorkPlanRequest(BaseModel):
    natural_language_description: str
    session_id: Optional[str] = None


class ApproveWorkPlanRequest(BaseModel):
    plan: Dict[str, Any]
    actor_id: Optional[str] = None
    decision_note: Optional[str] = None
    idempotency_key: Optional[str] = None


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
    # Re-index persistent documents from database to ensure vector store state persists across restarts
    try:
        from app.db.database import SessionLocal
        startup_db = SessionLocal()
        existing_docs = startup_db.query(DocumentModel).all()
        for doc in existing_docs:
            if doc.content:
                know_agent.ingest_document(
                    engagement_id=doc.engagement_id,
                    title=doc.title,
                    raw_text=doc.content
                )
        startup_db.close()
        logger.info(f"Re-indexed {len(existing_docs)} persistent documents from database into KNOW Agent vector store.")
    except Exception as e:
        logger.warning(f"Could not re-index persistent documents on startup: {e}")

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
    
    # Cloud DB Optimization: Batch fetch outcomes & pending approvals in 2 queries instead of 228 roundtrips
    outcome_ids = [eng.current_outcome_id for eng in engagements if eng.current_outcome_id]
    outcomes = {o.id: o for o in db.query(Outcome).filter(Outcome.id.in_(outcome_ids)).all()} if outcome_ids else {}
    
    from sqlalchemy import func
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


@app.post(f"{settings.API_V1_STR}/engagements", tags=["Engagements"])
async def create_engagement(
    payload: CreateEngagementRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER"]))
):
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
        if appr.type == ApprovalType.CUSTOMER_UPDATE:
            rec = f"Authorize Executive Customer Update release for {eng.customer_name if eng else 'customer'}."
            why = "DELIVER Agent translated engineering progress into executive stakeholder summary requiring manager sign-off before client delivery."
            evidence = ["AI privacy guardrail verified", "Executive summary draft generated"]
            impact = "Unlocks PDF download and authorizes FDE or Manager to send update to client stakeholders."
        elif appr.type == ApprovalType.OUTCOME_CHANGE:
            rec = f"Upgrade Definition of Done criteria and outcome for {eng.customer_name if eng else 'customer'}."
            why = "Customer requirement changed, gating production validation step."
            evidence = ["Requirement input received", "Current outcome DoD affected"]
            impact = "Updates DoD checklist and allows production rollout."
        else:
            rec = "Approve consequential action."
            why = "Consequential operational update requiring authorization."
            evidence = ["Action requested by engineer"]
            impact = "Authorizes requested workflow progression."

        result.append({
            "id": appr.id,
            "engagement_id": appr.engagement_id,
            "customer_name": eng.customer_name if eng else "Customer",
            "type": appr.type,
            "recommendation": rec,
            "why": why,
            "evidence": evidence,
            "impact": impact,
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
async def respond_to_approval(
    engagement_id: str, 
    payload: ApprovalResponseRequest, 
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER"]))
):
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    outcome_service = OutcomeService(db)
    manager_name = current_user.get("name", payload.actor_id or "David Miller")

    if payload.action == "APPROVE":
        current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
        updated_criteria = list(current_outcome.success_criteria or [])

        # Dynamic addition title based on engagement and payload
        if payload.decision_note and payload.decision_note.strip():
            addition_title = payload.decision_note.strip()
        elif eng.customer_name == "Acme Corp" or "acme" in engagement_id.lower():
            addition_title = "Enterprise SSO configuration & validation (Added v2)"
        else:
            addition_title = f"Approved scope expansion criterion (Added v{(current_outcome.version if current_outcome else 1) + 1})"

        new_crit_id = f"sc-{len(updated_criteria) + 1}"
        if not any(c.get("title") == addition_title for c in updated_criteria):
            updated_criteria.append({
                "id": new_crit_id,
                "title": addition_title,
                "completed": False
            })

        new_v2 = outcome_service.propose_new_outcome_version(
            engagement_id=engagement_id,
            new_statement=current_outcome.statement if current_outcome else eng.name,
            new_success_criteria=updated_criteria,
            proposed_by="understand_agent",
            reason=f"Manager approved scope expansion for {eng.customer_name}."
        )

        updated_eng = outcome_service.approve_outcome_version(
            engagement_id=engagement_id,
            outcome_id=new_v2.id,
            approved_by=manager_name
        )

        # Mark any pending approvals in DB as APPROVED
        pending_approvals_list = db.query(Approval).filter(
            Approval.engagement_id == engagement_id,
            Approval.status == ApprovalStatus.PENDING
        ).all()
        for appr in pending_approvals_list:
            appr.status = ApprovalStatus.APPROVED
            appr.reviewed_by = manager_name
            appr.decision_note = payload.decision_note
            appr.reviewed_at = datetime.utcnow()

        # Log timeline approval event
        db.add(TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="OUTCOME_APPROVED",
            title="Outcome Version Approved",
            description=f"Manager ({manager_name}) approved transition to Outcome Version {new_v2.version}.",
            actor_type="MANAGER",
            actor_id=current_user.get("id", "usr-mgr-002"),
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
    docs = db.query(DocumentModel).filter(DocumentModel.engagement_id == engagement_id).order_by(DocumentModel.created_at.desc()).all()
    res = []
    for d in docs:
        t_lower = d.title.lower()
        file_tuple = storage_service.get_document_file(engagement_id, d.id)
        fname = file_tuple[2].lower() if file_tuple else t_lower
        if fname.endswith(".pdf") or t_lower.endswith(".pdf"):
            ftype = "pdf"
        elif any(fname.endswith(ext) or t_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"]):
            ftype = "image"
        else:
            ftype = "text"

        res.append({
            "id": d.id,
            "engagement_id": d.engagement_id,
            "title": d.title,
            "category": d.category.value if hasattr(d.category, "value") else str(d.category),
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "chunks_count": d.chunks_count,
            "file_type": ftype,
            "uploaded_by": d.uploaded_by,
            "created_at": d.created_at.isoformat() if d.created_at else None
        })
    return {
        "success": True,
        "data": res
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
    storage_uri = storage_service.upload_document(
        engagement_id=engagement_id,
        document_id=doc_id,
        filename=f"{payload.title}.txt",
        content=payload.content
    )
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


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/documents/upload-file", tags=["Knowledge"])
async def upload_document_file(
    engagement_id: str,
    file: UploadFile = File(...),
    category: str = Form("Technical Documentation"),
    title: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Multipart File Upload endpoint for Grounded RAG Knowledge Base.
    Extracts text from .txt, .md, .pdf, .json, .csv, runs privacy scrub,
    chunks and indexes into KNOW Agent vector store, stores raw file,
    and records in DocumentModel and TimelineEvent.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        extracted_text = extract_text_from_file(file.filename or "uploaded_file.txt", file_bytes)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error extracting text from file {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract text from file: {str(e)}")

    doc_title = title.strip() if title and title.strip() else (file.filename or "Untitled Document")

    # Ingest into vector store
    result = know_agent.ingest_document(
        engagement_id=engagement_id,
        title=doc_title,
        raw_text=extracted_text
    )

    doc_id = f"doc-{uuid.uuid4().hex[:8]}"
    upload_filename = file.filename or f"{doc_title}.txt"
    storage_uri = storage_service.upload_binary_file(
        engagement_id=engagement_id,
        document_id=doc_id,
        filename=upload_filename,
        file_bytes=file_bytes,
        content_type=file.content_type or "application/octet-stream"
    )

    category_enum = DocumentCategory.OTHER
    for cat in DocumentCategory:
        if cat.value.lower() == category.lower() or cat.name.lower() == category.lower():
            category_enum = cat
            break

    chunks_count = result.get("chunks_created", 1)

    doc = DocumentModel(
        id=doc_id,
        engagement_id=engagement_id,
        title=doc_title,
        category=category_enum,
        status=DocumentStatus.INDEXED,
        content=extracted_text,
        chunks_count=chunks_count,
        uploaded_by="fde_user_1",
        created_at=datetime.utcnow()
    )
    db.add(doc)

    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="DOCUMENT_INGESTED",
        title="Document Uploaded & Indexed",
        description=f"Uploaded '{doc_title}' ({category_enum.value}) — indexed into {chunks_count} vector chunks for Grounded RAG.",
        actor_type="FDE",
        actor_id="fde_user_1",
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": {
            "id": doc.id,
            "engagement_id": doc.engagement_id,
            "title": doc.title,
            "category": doc.category.value if hasattr(doc.category, "value") else str(doc.category),
            "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status),
            "chunks_count": doc.chunks_count,
            "storage_uri": storage_uri,
            "created_at": doc.created_at.isoformat()
        },
        "message": f"Document '{doc_title}' uploaded and indexed into {chunks_count} vector chunks."
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


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/documents-search", tags=["Knowledge"])
async def search_documents(
    engagement_id: str,
    q: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Search customer documents by title, content, or category without requiring AI inference.
    """
    query = db.query(DocumentModel).filter(DocumentModel.engagement_id == engagement_id)
    if category and category.strip() and category.strip().lower() != "all":
        query = query.filter(DocumentModel.category == category.strip())

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            (DocumentModel.title.ilike(term)) | (DocumentModel.content.ilike(term))
        )

    docs = query.order_by(DocumentModel.created_at.desc()).all()
    results = []
    for d in docs:
        t_lower = d.title.lower()
        file_tuple = storage_service.get_document_file(engagement_id, d.id)
        fname = file_tuple[2].lower() if file_tuple else t_lower
        if fname.endswith(".pdf") or t_lower.endswith(".pdf"):
            ftype = "pdf"
        elif any(fname.endswith(ext) or t_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"]):
            ftype = "image"
        else:
            ftype = "text"

        snippet = None
        if q and q.strip() and d.content:
            idx = d.content.lower().find(q.strip().lower())
            if idx != -1:
                start = max(0, idx - 60)
                end = min(len(d.content), idx + 140)
                snippet = ("..." if start > 0 else "") + d.content[start:end].strip() + ("..." if end < len(d.content) else "")

        results.append({
            "id": d.id,
            "engagement_id": d.engagement_id,
            "title": d.title,
            "category": d.category.value if hasattr(d.category, "value") else str(d.category),
            "status": d.status.value if hasattr(d.status, "value") else str(d.status),
            "chunks_count": d.chunks_count,
            "file_type": ftype,
            "snippet": snippet,
            "uploaded_by": d.uploaded_by,
            "created_at": d.created_at.isoformat() if d.created_at else None
        })

    return {
        "success": True,
        "data": results,
        "total": len(results)
    }


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/documents/{{doc_id}}", tags=["Knowledge"])
async def get_document_detail(engagement_id: str, doc_id: str, db: Session = Depends(get_db)):
    """
    Retrieve single document details including full text and file type.
    """
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id, DocumentModel.engagement_id == engagement_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    t_lower = doc.title.lower()
    file_tuple = storage_service.get_document_file(engagement_id, doc_id)
    filename = file_tuple[2] if file_tuple else f"{doc.title}.txt"
    f_lower = filename.lower()

    if f_lower.endswith(".pdf") or t_lower.endswith(".pdf"):
        file_type = "pdf"
    elif any(f_lower.endswith(ext) or t_lower.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"]):
        file_type = "image"
    else:
        file_type = "text"

    return {
        "success": True,
        "data": {
            "id": doc.id,
            "engagement_id": doc.engagement_id,
            "title": doc.title,
            "filename": filename,
            "category": doc.category.value if hasattr(doc.category, "value") else str(doc.category),
            "status": doc.status.value if hasattr(doc.status, "value") else str(doc.status),
            "chunks_count": doc.chunks_count,
            "file_type": file_type,
            "has_binary_file": bool(file_tuple),
            "content": doc.content,
            "uploaded_by": doc.uploaded_by,
            "created_at": doc.created_at.isoformat() if doc.created_at else None
        }
    }


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/documents/{{doc_id}}/file", tags=["Knowledge"])
async def stream_document_file(engagement_id: str, doc_id: str, db: Session = Depends(get_db)):
    """
    Streams the raw PDF or image file for in-browser reading/viewing.
    Guarantees that files served as application/pdf start with standard %PDF- magic bytes.
    """
    doc = db.query(DocumentModel).filter(DocumentModel.id == doc_id, DocumentModel.engagement_id == engagement_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_tuple = storage_service.get_document_file(engagement_id, doc_id)
    if file_tuple:
        content_bytes, mime_type, filename = file_tuple
        is_pdf = (
            filename.lower().endswith(".pdf")
            or mime_type == "application/pdf"
            or doc.title.lower().endswith(".pdf")
        )
        if is_pdf:
            if not content_bytes.startswith(b"%PDF-"):
                text_content = content_bytes.decode("utf-8", "ignore")
                content_bytes = text_to_pdf_bytes(doc.title or filename, text_content)
            mime_type = "application/pdf"
            if not filename.lower().endswith(".pdf"):
                filename = f"{filename}.pdf"

        return Response(
            content=content_bytes,
            media_type=mime_type,
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "public, max-age=3600"
            }
        )

    # Fallback: If no file on disk, check if it's meant to be a PDF
    if doc.title.lower().endswith(".pdf") or "pdf" in (doc.title.lower()):
        text_content = doc.content or f"{doc.title}\n\nDocument text content is not available."
        pdf_bytes = text_to_pdf_bytes(doc.title, text_content)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{doc.title}.pdf"',
                "Cache-Control": "public, max-age=3600"
            }
        )

    # Fallback: Serve text content directly
    text_content = doc.content or f"{doc.title}\n\nDocument text content is not available."
    return Response(
        content=text_content.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": f'inline; filename="{doc.title}.txt"'
        }
    )


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

    # Ensure a pending Approval record exists for this Customer Update
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


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/customer-updates/approve", tags=["Delivery"])
async def approve_customer_update(
    engagement_id: str,
    payload: Optional[ApprovalResponseRequest] = None,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER"]))
):
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")

    manager_name = current_user.get("name", "David Miller")
    decision_note = payload.decision_note if payload and payload.decision_note else "Manager approved executive summary for client delivery."

    # Mark all pending CUSTOMER_UPDATE approvals for this engagement as APPROVED
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

    # If no pending approval was found, record one for complete audit trail
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

    # Log audit timeline event
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


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/customer-updates/status", tags=["Delivery"])
async def get_customer_update_approval_status(engagement_id: str, db: Session = Depends(get_db)):
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
    Proactive Intelligence Mode: Generates a sequential Morning Brief (UNDERSTAND -> KNOW -> MOVE -> Supervisor Plan).
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

    # Persist brief provenance into shared memory timeline
    db.add(TimelineEvent(
        id=f"evt-{uuid.uuid4().hex[:8]}",
        engagement_id=engagement_id,
        event_type="MORNING_BRIEF_GENERATED",
        title=f"Morning Brief Generated (v{version})",
        description=f"Supervisor synthesized sequential Morning Brief (UNDERSTAND → KNOW → MOVE). Proposed Plan: {brief.proposed_work_plan.recommended_first_action}. DELIVER excluded.",
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


# Natural-Language Work Planning Endpoints (Supervisor Led)

@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/plan/propose", tags=["Supervisor"])
async def propose_work_plan(
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
    except Exception as e:
        logger.error(f"Error generating work plan proposal: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/plan/approve", tags=["Supervisor"])
async def approve_work_plan(
    engagement_id: str,
    payload: ApproveWorkPlanRequest,
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["MANAGER", "FDE"]))
):
    """
    Work Plan Approval and Persistence Endpoint:
    - Allows FDEs to review, edit, approve, and activate their own generated work plans
      and routine tasks when remaining within the engagement's approved scope.
    - Preserves MANAGER approval requirement for consequential changes to approved outcomes,
      engagement scope, delivery commitments, or version upgrades (v2+).
    - Idempotently persists approved plan into Outcome, records timeline event with provenance,
      and indexes into KNOW Agent vector store.
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

    # Idempotency check: if current outcome already has the identical plan, return success without duplicate writes
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

    # Determine whether the requested change is consequential under approval policy:
    # 1. Explicit consequential or scope-expansion flag
    is_explicit_consequential = bool(
        plan_dict.get("is_consequential_change")
        or plan_dict.get("scope_expansion")
        or plan_dict.get("requires_manager_approval")
    )
    # 2. Target outcome version bump requested
    target_version = plan_dict.get("version")
    is_version_upgrade = bool(
        target_version and current_outcome and int(target_version) > current_outcome.version
    )
    # 3. Modification of approved outcome statement on an already active plan
    statement_changed = bool(
        has_existing_plan
        and proposed_objective
        and current_statement
        and proposed_objective != current_statement
    )
    # 4. Explicit decision note declaring scope expansion / contract alteration
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

    # Server-side RBAC & Policy Enforcement:
    # FDEs can approve within-scope plans and routine task updates, but consequential changes require MANAGER
    if is_consequential and user_role != "MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager approval required for consequential changes to approved outcomes, engagement scope, and delivery commitments."
        )

    outcome_service = OutcomeService(db)

    # Convert plan outcomes / Definition of Done into success_criteria
    dod_items = plan_dict.get("definition_of_done", [])
    updated_criteria = []
    if isinstance(dod_items, list):
        for idx, item in enumerate(dod_items):
            if isinstance(item, dict):
                updated_criteria.append(item)
            elif isinstance(item, str) and item.strip():
                updated_criteria.append({"id": f"dod-{idx+1}", "title": item.strip(), "completed": False})

    if not updated_criteria and plan_dict.get("outcomes"):
        for idx, o in enumerate(plan_dict.get("outcomes", [])):
            if isinstance(o, str) and o.strip():
                updated_criteria.append({"id": f"sc-{idx+1}", "title": o.strip(), "completed": False})

    if not updated_criteria and current_outcome:
        updated_criteria = current_outcome.success_criteria or []

    new_statement = proposed_objective if (user_role == "MANAGER" and proposed_objective) else current_statement

    try:
        if is_consequential and user_role == "MANAGER":
            # Consequential scope change approved by Manager: upgrade outcome version (v2+)
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
            # Routine task update / ordinary work plan refinement within approved scope (FDE or Manager)
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
            # Initial work plan approval within approved scope (FDE self-approval or Manager)
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

        # Record TimelineEvent with strict audit provenance
        milestones_count = len(plan_dict.get("milestones", []))
        tasks_count = len(plan_dict.get("tasks", [])) or sum(
            len(m.get("deliverables", []))
            for m in plan_dict.get("milestones", [])
            if isinstance(m, dict)
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

        # Ingest full approved work plan into KNOW Agent vector store (tenant-isolated Grounded RAG)
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

            plan_doc_lines.append("\n## Definition of Done:")
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


@app.get(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/plan", tags=["Supervisor"])
async def get_work_plan(engagement_id: str, db: Session = Depends(get_db)):
    """
    Retrieve active approved work plan for an engagement.
    """
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


@app.patch(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/dod/{{dod_id}}/toggle", tags=["Engagements"])
async def toggle_dod_criterion(engagement_id: str, dod_id: str, db: Session = Depends(get_db)):
    """
    Toggle completion status of a Definition of Done criterion in active outcome.
    Updates progress dynamically.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    if not current_outcome:
        raise HTTPException(status_code=404, detail="Outcome not found")

    from sqlalchemy.orm.attributes import flag_modified
    criteria = list(current_outcome.success_criteria or [])
    updated = False
    for item in criteria:
        if isinstance(item, dict) and item.get("id") == dod_id:
            item["completed"] = not item.get("completed", False)
            updated = True
            break

    if updated:
        current_outcome.success_criteria = criteria
        flag_modified(current_outcome, "success_criteria")

        if current_outcome.work_plan and isinstance(current_outcome.work_plan, dict):
            wp = dict(current_outcome.work_plan)
            dods = wp.get("definition_of_done", [])
            for d in dods:
                if isinstance(d, dict) and d.get("id") == dod_id:
                    d["completed"] = not d.get("completed", False)
                    break
            wp["definition_of_done"] = dods
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
        "message": "DoD criterion toggled successfully."
    }


@app.patch(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/tasks/{{task_id}}", tags=["Engagements"])
async def update_routine_task(
    engagement_id: str,
    task_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["FDE", "MANAGER"]))
):
    """
    Update a routine task within the active work plan.
    Does NOT require manager approval for ordinary task updates within scope.
    """
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise HTTPException(status_code=404, detail="Engagement not found")
    current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    if not current_outcome or not current_outcome.work_plan:
        raise HTTPException(status_code=404, detail="Active work plan not found")

    from sqlalchemy.orm.attributes import flag_modified
    wp = dict(current_outcome.work_plan)
    tasks = list(wp.get("tasks", []))
    target_task = None
    for t in tasks:
        if isinstance(t, dict) and t.get("id") == task_id:
            for k, v in payload.items():
                t[k] = v
            target_task = t
            break

    if not target_task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found in active work plan")

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
        event_type="TASK_UPDATED",
        title=f"Task Updated: {target_task.get('title', task_id)}",
        description=f"{user_role} {actor_name} updated routine task '{task_id}' within approved scope.",
        actor_type=user_role,
        actor_id=actor_id,
        created_at=datetime.utcnow()
    ))
    db.commit()

    return {
        "success": True,
        "data": target_task,
        "message": "Routine task updated successfully."
    }


@app.post(f"{settings.API_V1_STR}/engagements/{{engagement_id}}/tasks", tags=["Engagements"])
async def create_routine_task(
    engagement_id: str,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: Dict[str, Any] = Depends(require_role(["FDE", "MANAGER"]))
):
    """
    Create a routine task in the active work plan.
    Does NOT require manager approval for routine FDE-created tasks within scope.
    """
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
