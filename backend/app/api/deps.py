"""
Shared API Singletons and Dependencies.
Initializes agent instances and security services once across the application lifecycle.
Active Agents: PLAN, KNOW, MOVE, DELIVER, SUPPORT, and SUPERVISOR Coordinator.
"""

import logging
from app.config import settings
from app.privacy import PrivacyPolicyEngine
from app.services import StorageService
from app.agents import (
    PlanAgent,
    KnowAgent,
    MoveAgent,
    DeliverAgent,
    SupportAgent,
    UnderstandAgent  # compatibility alias to PlanAgent
)
from app.supervisor import SupervisorCoordinator

logger = logging.getLogger(__name__)

# Singletons with Privacy Guardrail integration
privacy_engine = PrivacyPolicyEngine(
    use_cloud_dlp=settings.USE_CLOUD_DLP_API,
    gcp_project_id=settings.GCP_PROJECT_ID
)

storage_service = StorageService()
know_agent = KnowAgent(privacy_engine=privacy_engine)
plan_agent = PlanAgent(privacy_engine=privacy_engine, know_agent=know_agent)
move_agent = MoveAgent(privacy_engine=privacy_engine)
deliver_agent = DeliverAgent(privacy_engine=privacy_engine)
support_agent = SupportAgent(privacy_engine=privacy_engine, know_agent=know_agent)

# Compatibility alias for existing API routes & tests
understand_agent = plan_agent

supervisor_coordinator = SupervisorCoordinator(
    privacy_engine=privacy_engine,
    plan_agent=plan_agent,
    support_agent=support_agent,
    know_agent=know_agent,
    move_agent=move_agent,
    deliver_agent=deliver_agent
)
