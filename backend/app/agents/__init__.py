"""
Agents package initialization.
Active Agents: SUPERVISOR, PLAN, KNOW, MOVE, DELIVER, SUPPORT.
Note: UnderstandAgent is aliased to PlanAgent for backwards compatibility.
"""
from app.agents.plan_agent import (
    PlanAgent,
    ChangeImpactAnalysis,
    StructuredWorkPlanProposal,
    WorkMilestone,
    WorkTask,
    FactAssumptionGap,
    PlanReassessmentResult
)
from app.agents.support_agent import (
    SupportAgent,
    IncidentInvestigationResult
)
from app.agents.know_agent import KnowAgent, GroundedAnswer, GroundedCitation
from app.agents.move_agent import MoveAgent, NextBestActionRecommendation
from app.agents.deliver_agent import DeliverAgent, CustomerUpdateDraft
from app.agents.adk_runtime import (
    get_adk_model,
    create_adk_runner,
    execute_adk_runner,
    get_session_service
)

# Backwards compatibility wrapper: UNDERSTAND capabilities migrated into PLAN
from app.agents.understand_agent import UnderstandAgent

__all__ = [
    "PlanAgent",
    "ChangeImpactAnalysis",
    "StructuredWorkPlanProposal",
    "WorkMilestone",
    "WorkTask",
    "FactAssumptionGap",
    "PlanReassessmentResult",
    "SupportAgent",
    "IncidentInvestigationResult",
    "KnowAgent",
    "GroundedAnswer",
    "GroundedCitation",
    "MoveAgent",
    "NextBestActionRecommendation",
    "DeliverAgent",
    "CustomerUpdateDraft",
    "UnderstandAgent",
    "get_adk_model",
    "create_adk_runner",
    "execute_adk_runner",
    "get_session_service"
]
