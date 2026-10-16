"""
CalmWork AI - Advanced Engineering Multi-Agent Coordination Platform.
Principal FastAPI Application Entry Point.
Modular monolithic architecture utilizing APIRouter domain modules.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.db.database import init_db
from app.api.deps import know_agent
from app.api.v1 import api_router

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifespan Context Manager.
    Handles startup database initialization and cold-start vector store rehydration.
    """
    logger.info("Initializing CalmWork database schema...")
    init_db()

    # Optional seeding only when explicitly requested via SEED_DEFAULT_DATA=true
    if settings.SEED_DEFAULT_DATA:
        logger.info("SEED_DEFAULT_DATA is enabled; feeding sample development documents...")
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

    # Start Morning Brief 08:00 AM IST Automated Scheduler
    try:
        from app.skills.morning_brief import start_morning_brief_scheduler, stop_morning_brief_scheduler
        start_morning_brief_scheduler()
    except Exception as sched_err:
        logger.warning(f"Could not start Morning Brief scheduler: {sched_err}")

    logger.info("CalmWork backend startup complete.")
    yield
    try:
        from app.skills.morning_brief import stop_morning_brief_scheduler
        stop_morning_brief_scheduler()
    except Exception:
        pass
    logger.info("CalmWork backend shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register modular API routers
app.include_router(api_router)


@app.get("/", tags=["Health"])
def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "api_docs": f"{settings.API_V1_STR}/docs"
    }


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "privacy_guardrail": "enabled" if settings.PRIVACY_GUARDRAIL_ENABLED else "disabled"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

