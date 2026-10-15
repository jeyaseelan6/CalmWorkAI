"""
UNDERSTAND Agent (RETIRED / DEPRECATED).
All capabilities (scope analysis, outcome health, requirement drift, and change-impact analysis)
have been migrated into the dedicated PLAN Agent (app.agents.plan_agent.PlanAgent).

This module is maintained as a thin compatibility shim for existing imports and API consumers.
Do NOT use UnderstandAgent for new code; use PlanAgent directly.
"""

import warnings
import logging
from typing import Optional, Any
from app.privacy import PrivacyPolicyEngine
from google.adk.sessions import BaseSessionService

from app.agents.plan_agent import (
    PlanAgent,
    ChangeImpactAnalysis,
    SuccessCriterionImpact
)

logger = logging.getLogger(__name__)


class UnderstandAgent(PlanAgent):
    """
    Deprecated compatibility wrapper for UnderstandAgent.
    Delegates all change analysis, requirement drift, and outcome evaluation
    directly to PlanAgent.
    """

    def __init__(
        self,
        privacy_engine: Optional[PrivacyPolicyEngine] = None,
        session_service: Optional[BaseSessionService] = None,
        gemini_service: Optional[Any] = None  # retained for backwards compatibility
    ):
        warnings.warn(
            "UnderstandAgent is deprecated and retired as an independent agent. "
            "Its capabilities have migrated to PlanAgent. Use PlanAgent instead.",
            DeprecationWarning,
            stacklevel=2
        )
        logger.info("Instantiating PlanAgent via deprecated UnderstandAgent compatibility shim.")
        super().__init__(
            privacy_engine=privacy_engine,
            session_service=session_service
        )


__all__ = [
    "UnderstandAgent",
    "ChangeImpactAnalysis",
    "SuccessCriterionImpact"
]
