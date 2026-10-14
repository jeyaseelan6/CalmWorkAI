"""
Shared API Singletons and Dependencies.
Initializes agent instances and security services once across the application lifecycle.
"""

import logging
from app.config import settings
from app.privacy import PrivacyPolicyEngine
from app.services import StorageService
from app.agents import (
    UnderstandAgent,
    KnowAgent,
    MoveAgent,
    DeliverAgent
)
from app.supervisor import SupervisorCoordinator

logger = logging.getLogger(__name__)

# Singletons with Privacy Guardrail integration
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
