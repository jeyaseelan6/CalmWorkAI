"""
Morning Brief Agentic Skill — Manifest & Metadata.
Defines the declarative specification, inputs, outputs, and trigger configuration
for the Morning Brief Skill in CalmWork AI.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class SkillTriggerType:
    ON_DEMAND = "ON_DEMAND"
    CHAT_INTENT = "CHAT_INTENT"


class SkillManifest(BaseModel):
    skill_id: str = "skill_morning_brief"
    name: str = "Morning Brief Skill"
    version: str = "1.0.0"
    category: str = "Work Intelligence & Operational Planning"
    description: str = (
        "Modular agentic skill that coordinates PLAN (scope & milestones), "
        "KNOW (grounded specs), and MOVE (blockers & Next Best Action) "
        "to synthesize an evidence-backed daily briefing on-demand with IST deadline targeting."
    )
    supported_triggers: List[str] = [
        SkillTriggerType.ON_DEMAND,
        SkillTriggerType.CHAT_INTENT
    ]
    execution_mode: str = "MANUAL_ON_DEMAND"
    cost_control_policy: str = (
        "Strictly on-demand manual trigger. Automatic background execution is disabled "
        "to eliminate wasteful multi-tenant LLM token consumption across inactive engagements."
    )
    schedule_cron: Optional[str] = None
    schedule_timezone: str = "Asia/Kolkata"
    schedule_description: str = "Manual on-demand execution via engineer/manager trigger. Auto-runner disabled for cost control."
    participating_agents: List[str] = ["PLAN", "KNOW", "MOVE", "SUPERVISOR"]
    authoritative_roles: List[str] = ["FDE", "MANAGER"]
    tags: List[str] = ["morning-brief", "daily-planning", "agentic-skill", "fde-velocity", "cost-optimized"]


morning_brief_manifest = SkillManifest()
