"""
CalmWork AI — Agentic Skills Registry.
Provides modular, reusable procedural skills for multi-agent workflows.
"""

from app.skills.morning_brief import (
    morning_brief_skill,
    morning_brief_manifest,
    start_morning_brief_scheduler,
    stop_morning_brief_scheduler
)

SKILLS_REGISTRY = {
    morning_brief_manifest.skill_id: {
        "manifest": morning_brief_manifest,
        "executor": morning_brief_skill
    }
}

__all__ = [
    "morning_brief_skill",
    "morning_brief_manifest",
    "start_morning_brief_scheduler",
    "stop_morning_brief_scheduler",
    "SKILLS_REGISTRY"
]
