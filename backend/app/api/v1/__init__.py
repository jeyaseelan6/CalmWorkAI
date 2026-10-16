"""
API v1 Router Aggregator.
Consolidates modular sub-routers under /api/v1.
"""

from fastapi import APIRouter
from app.config import settings

from app.api.v1.auth import router as auth_router
from app.api.v1.engagements import router as engagements_router
from app.api.v1.approvals import router as approvals_router
from app.api.v1.documents import router as documents_router
from app.api.v1.planning import router as planning_router
from app.api.v1.supervisor import router as supervisor_router
from app.api.v1.intelligence import router as intelligence_router
from app.api.v1.skills import router as skills_router

api_router = APIRouter(prefix=settings.API_V1_STR)

api_router.include_router(auth_router)
api_router.include_router(engagements_router)
api_router.include_router(approvals_router)
api_router.include_router(documents_router)
api_router.include_router(planning_router)
api_router.include_router(supervisor_router)
api_router.include_router(intelligence_router)
api_router.include_router(skills_router)

__all__ = ["api_router"]

