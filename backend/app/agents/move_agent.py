"""
MOVE Agent — Execution Velocity & Next Best Action Engine.
Evaluates active blockers, dependencies, and gating criteria across the 6 FDE Work Cycles,
determining the single highest-impact Next Best Action with explicit 'Why Now' justification.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import logging
from datetime import datetime, timezone

from app.privacy import PrivacyPolicyEngine

logger = logging.getLogger(__name__)


class BlockerItem(BaseModel):
    id: str
    title: str
    owner: str
    status: str
    is_gating: bool
    description: str


class NextBestActionRecommendation(BaseModel):
    engagement_id: str
    customer_name: str
    action_title: str
    why_now: str
    priority_level: str = Field(description="CRITICAL | HIGH_PRIORITY | MEDIUM_PRIORITY | ROUTINE")
    target_work_cycle: str
    gating_blocker: Optional[BlockerItem] = None
    affected_role: str = Field(description="FDE | MANAGER | CUSTOMER_OWNER")
    privacy_scrubbed: bool = True


class MoveAgent:
    """
    MOVE Agent: Determines optimal execution path for Forward-Deployed Engineers.
    Ranks actions by impact on gating criteria and outcome velocity.
    """

    def __init__(self, privacy_engine: Optional[PrivacyPolicyEngine] = None):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()

    def determine_next_action(
        self,
        engagement_id: str,
        customer_name: str,
        current_work_cycle: str,
        status: str,
        outcome_version: int,
        blockers: Optional[List[Dict[str, Any]]] = None,
        pending_approvals: int = 0
    ) -> NextBestActionRecommendation:
        """
        Calculates the single highest-priority Next Best Action for the FDE.
        """
        raw_blockers = blockers or []

        # 1. Evaluate scenario rules
        if status == "NEEDS_REASSESSMENT" or outcome_version == 1 and "SSO" in str(raw_blockers):
            raw_action = f"Follow up with customer security owner for required Enterprise SSO configuration for {customer_name}."
            raw_why = f"This is currently the primary blocker gating Step 4 (Build Within Real Constraints) production validation for {customer_name}."
            priority = "CRITICAL"
            gating_blocker = BlockerItem(
                id="blk-001",
                title="SSO Configuration",
                owner="Customer Security Team",
                status="Waiting on Customer",
                is_gating=True,
                description="Enterprise SSO configuration required before production deployment."
            )
            role = "CUSTOMER_OWNER"
        elif pending_approvals > 0:
            raw_action = f"Review and approve pending Outcome Version transition for {customer_name}."
            raw_why = "Manager approval is required to activate the updated Definition of Done (DoD) success criteria."
            priority = "HIGH_PRIORITY"
            gating_blocker = None
            role = "MANAGER"
        elif "STEP_5" in current_work_cycle or "Deploy" in current_work_cycle:
            raw_action = f"Execute cutover performance dry-run test on staging replica for {customer_name}."
            raw_why = "Dry run performance data is required to confirm the 15-minute cutover window for Step 5 deployment."
            priority = "HIGH_PRIORITY"
            gating_blocker = BlockerItem(
                id="blk-002",
                title="Staging Maintenance Window",
                owner="FDE Team",
                status="Scheduled",
                is_gating=False,
                description="Staging maintenance window scheduled for Friday off-peak benchmark."
            )
            role = "FDE"
        else:
            raw_action = f"Complete current work cycle checklist items for {customer_name}."
            raw_why = "Maintains execution velocity towards target outcome milestone."
            priority = "ROUTINE"
            gating_blocker = None
            role = "FDE"

        # 2. Enforce Privacy Guardrail Anonymization
        anon_action, mapping1 = self.privacy_engine.process_llm_input(raw_action, session_id=engagement_id)
        anon_why, mapping2 = self.privacy_engine.process_llm_input(raw_why, session_id=engagement_id)

        # 3. Restore clean output for authorized FDE presentation
        clean_action = self.privacy_engine.sanitize_output(raw_action, mapping1)
        clean_why = self.privacy_engine.sanitize_output(raw_why, mapping2)

        return NextBestActionRecommendation(
            engagement_id=engagement_id,
            customer_name=customer_name,
            action_title=clean_action,
            why_now=clean_why,
            priority_level=priority,
            target_work_cycle=current_work_cycle,
            gating_blocker=gating_blocker,
            affected_role=role,
            privacy_scrubbed=len(mapping1.reference_to_original) > 0 or len(mapping2.reference_to_original) > 0
        )
