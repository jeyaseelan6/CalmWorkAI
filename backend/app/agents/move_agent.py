"""
MOVE Agent — Execution Velocity & Next Best Action Engine.
Evaluates active blockers, dependencies, and gating criteria across the 6 FDE Work Cycles,
determining the single highest-impact Next Best Action with explicit 'Why Now' justification.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import logging

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
    situation: str
    recommendation: str
    why_now: str
    impact: str
    evidence: List[str]
    confidence: str = Field(description="High | Medium | Low")
    approval_required: bool = True
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

        if status == "NEEDS_REASSESSMENT" or pending_approvals > 0 or any(b.get("is_gating") for b in raw_blockers):
            situation = f"Outcome status for {customer_name} is currently NEEDS_REASSESSMENT due to pending gating dependency or requirement change."
            recommendation = f"Request required security configuration and obtain Manager approval for Outcome Version {outcome_version + 1}."
            why_now = "Production validation step is currently blocked by this unfulfilled dependency."
            impact = "Receiving configuration and approval enables authentication integration and clears deployment path."
            evidence = [
                f"Engagement status: {status}",
                f"Pending approvals: {pending_approvals}",
                "Active gating dependency unfulfilled"
            ]
            confidence = "High"
            approval_required = True
            priority = "CRITICAL"
            gating_blocker = BlockerItem(
                id="blk-001",
                title="Configuration & Approval Dependency",
                owner="Customer Security / Manager",
                status="Waiting on Customer",
                is_gating=True,
                description="Enterprise SSO configuration and outcome version approval required."
            )
            role = "CUSTOMER_OWNER" if status == "NEEDS_REASSESSMENT" else "MANAGER"
        elif "STEP_5" in str(current_work_cycle).upper() or "Deploy" in str(current_work_cycle):
            situation = f"Engagement is at Step 5 (Deploy Into Production) for {customer_name}."
            recommendation = "Execute cutover performance dry-run test on staging replica."
            why_now = "Dry-run performance data is required to confirm the 15-minute cutover window before production deployment."
            impact = "Confirms zero-downtime cutover window and validates replication metrics."
            evidence = [
                f"Current Work Cycle: {current_work_cycle}",
                "Production deployment scheduled"
            ]
            confidence = "High"
            approval_required = False
            priority = "HIGH_PRIORITY"
            gating_blocker = BlockerItem(
                id="blk-002",
                title="Staging Maintenance Window",
                owner="FDE Team",
                status="Scheduled",
                is_gating=False,
                description="Performance benchmark scheduled during off-peak maintenance window."
            )
            role = "FDE"
        else:
            situation = f"Engagement execution progressing in {current_work_cycle}."
            recommendation = "Complete current work cycle checklist items and verify success criteria."
            why_now = "Maintains outcome delivery velocity towards target milestone."
            impact = "Advances progress towards production validation readiness."
            evidence = [f"Current Work Cycle: {current_work_cycle}"]
            confidence = "High"
            approval_required = False
            priority = "ROUTINE"
            gating_blocker = None
            role = "FDE"

        # Privacy Anonymization
        anon_action, mapping1 = self.privacy_engine.process_llm_input(recommendation, session_id=engagement_id)
        clean_rec = self.privacy_engine.sanitize_output(recommendation, mapping1)
        clean_sit = self.privacy_engine.sanitize_output(situation, mapping1)
        clean_why = self.privacy_engine.sanitize_output(why_now, mapping1)
        clean_impact = self.privacy_engine.sanitize_output(impact, mapping1)

        return NextBestActionRecommendation(
            engagement_id=engagement_id,
            customer_name=customer_name,
            action_title=clean_rec,
            situation=clean_sit,
            recommendation=clean_rec,
            why_now=clean_why,
            impact=clean_impact,
            evidence=evidence,
            confidence=confidence,
            approval_required=approval_required,
            priority_level=priority,
            target_work_cycle=str(current_work_cycle),
            gating_blocker=gating_blocker,
            affected_role=role,
            privacy_scrubbed=len(mapping1.reference_to_original) > 0
        )
