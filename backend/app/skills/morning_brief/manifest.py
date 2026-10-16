"""
Morning Brief Agentic Skill — Manifest & Metadata.
Defines the declarative specification, inputs, outputs, and trigger configuration
for the Morning Brief Skill in CalmWork AI.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class SkillTriggerType:
    ON_DEMAND = "ON_DEMAND"
    SCHEDULED = "SCHEDULED"
    CHAT_INTENT = "CHAT_INTENT"


class SkillManifest(BaseModel):
    skill_id: str = "skill_morning_brief"
    name: str = "Morning Brief Skill"
    version: str = "1.0.0"
    category: str = "Work Intelligence & Operational Planning"
    description: str = (
        "Modular agentic skill that analyzes engagement state overnight, "
        "coordinates PLAN (scope & milestones), KNOW (grounded specs), and MOVE (blockers & Next Best Action) "
        "to synthesize an evidence-backed daily briefing with IST deadline targeting."
    )
    supported_triggers: List[str] = [
        SkillTriggerType.ON_DEMAND,
        SkillTriggerType.SCHEDULED,
        SkillTriggerType.CHAT_INTENT
    ]
    schedule_cron: str = "30 2 * * *"  # 02:30 UTC = 08:00 AM IST
    schedule_timezone: str = "Asia/Kolkata"
    schedule_description: str = "Runs automatically every day at 08:00 AM IST across all active customer engagements."
    participating_agents: List[str] = ["PLAN", "KNOW", "MOVE", "SUPERVISOR"]
    authoritative_roles: List[str] = ["FDE", "MANAGER"]
    tags: List[str] = ["morning-brief", "daily-planning", "agentic-skill", "fde-velocity"]


morning_brief_manifest = SkillManifest()
