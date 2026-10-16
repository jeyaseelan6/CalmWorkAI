"""
CalmWork AI — Universal Agent Invariants.
Defines centralized platform rules, temporal invariants (IST 24-hour clock),
grounding rules, and governance policies inherited by all agents.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional

# Indian Standard Time (IST) offset: UTC +05:30
IST_TZ = timezone(timedelta(hours=5, minutes=30))


def get_current_ist_datetime() -> datetime:
    """Returns current datetime in Indian Standard Time (IST)."""
    return datetime.now(IST_TZ)


def get_current_ist_str() -> str:
    """Returns current datetime formatted in IST 24-hour clock (e.g., '16 Oct 2026, 20:15 IST')."""
    return get_current_ist_datetime().strftime("%d %b %Y, %H:%M IST")


UNIVERSAL_AGENT_INVARIANTS = """GLOBAL PLATFORM INVARIANTS (APPLIES TO ALL CALMWORK AI AGENTS):
1. MANDATORY TIMEZONE & CLOCK INVARIANT:
   - All timestamps, event hours, milestones, schedules, target due dates, and deadlines MUST strictly use Indian Standard Time (IST) 24-hour clock notation (e.g. '16 Oct 2026, 17:00 IST' or '14:30 IST').
   - You must NEVER output UTC, GMT, or 12-hour AM/PM formats under any circumstances.
2. GROUNDING & EVIDENCE INVARIANT:
   - Base all claims strictly on verified customer records, technical documents, or approved database models. Never hallucinate unverified state or fabricate error codes or nonexistent runbooks.
3. GOVERNANCE INVARIANT:
   - Changes to contractual scope, definitions of done, or external stakeholder updates always require Engineering Manager approval before execution."""


def build_agent_instruction(agent_specific_instruction: str) -> str:
    """
    Composes a complete agent instruction by injecting the universal platform invariants,
    current dynamic IST time anchor, and the agent's domain-specific instructions.
    """
    now_ist = get_current_ist_str()
    return (
        f"{UNIVERSAL_AGENT_INVARIANTS}\n\n"
        f"CURRENT PLATFORM TIME: {now_ist}\n\n"
        f"AGENT-SPECIFIC DIRECTIVE:\n"
        f"{agent_specific_instruction.strip()}"
    )
