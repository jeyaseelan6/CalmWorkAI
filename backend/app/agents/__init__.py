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

from app.agents.invariants import (
    IST_TZ,
    get_current_ist_datetime,
    get_current_ist_str,
    UNIVERSAL_AGENT_INVARIANTS,
    build_agent_instruction
)
from app.agents.fde_playbook import (
    FDE_CORE_PLAYBOOK,
    PLAN_FDE_DIRECTIVE,
    MOVE_FDE_DIRECTIVE,
    SUPERVISOR_FDE_DIRECTIVE
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
    "get_session_service",
    "IST_TZ",
    "get_current_ist_datetime",
    "get_current_ist_str",
    "UNIVERSAL_AGENT_INVARIANTS",
    "build_agent_instruction",
    "FDE_CORE_PLAYBOOK",
    "PLAN_FDE_DIRECTIVE",
    "MOVE_FDE_DIRECTIVE",
    "SUPERVISOR_FDE_DIRECTIVE"
]

