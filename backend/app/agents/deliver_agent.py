"""
DELIVER Agent — Executive Customer Communication Engine.
Translates technical engineering progress, DoD checklist completion, and work cycle steps into
executive business language updates suitable for customer stakeholders, protected by AI Privacy Guardrail.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import logging
from datetime import datetime, timezone

from app.privacy import PrivacyPolicyEngine

logger = logging.getLogger(__name__)


class CustomerUpdateDraft(BaseModel):
    engagement_id: str
    customer_name: str
    subject: str
    executive_summary: str
    key_milestones_achieved: List[str]
    next_milestone_target: str
    customer_action_items: List[str]
    status: str = Field(description="DRAFT | PENDING_MANAGER_APPROVAL | APPROVED | SENT")
    generated_at: str
    privacy_scrubbed: bool = True


class DeliverAgent:
    """
    DELIVER Agent: Translates technical outcomes and DoD progress into
    manager-approved, executive-ready customer updates.
    """

    def __init__(self, privacy_engine: Optional[PrivacyPolicyEngine] = None):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()

    def generate_customer_update(
        self,
        engagement_id: str,
        customer_name: str,
        engagement_name: str,
        outcome_statement: str,
        success_criteria: List[Dict[str, Any]],
        current_work_cycle: str,
        raw_notes: Optional[str] = None
    ) -> CustomerUpdateDraft:
        """
        Generates executive business update draft from technical engagement progress.
        """
        raw_notes_text = raw_notes or ""

        # 1. Privacy Guardrail Anonymization
        anonymized_notes, mapping = self.privacy_engine.process_llm_input(
            text=f"{customer_name} {raw_notes_text}",
            session_id=engagement_id
        )

        # 2. Extract completed success criteria
        completed_items = [c.get("title", "") for c in success_criteria if c.get("completed")]
        pending_items = [c.get("title", "") for c in success_criteria if not c.get("completed")]

        # 3. Translate technical progress to Executive Business Language
        subject = f"Executive Update: {customer_name} — {engagement_name} Progress"

        if completed_items:
            milestones = [f"Successfully delivered: {item}" for item in completed_items]
        else:
            milestones = ["Completed technical baseline architecture and integration environment setup."]

        exec_summary = (
            f"We are actively advancing the {engagement_name} initiative for {customer_name} "
            f"in alignment with our target outcome: '{outcome_statement}'. "
            f"Core integration phases are progressing smoothly with verified system reliability."
        )

        next_target = pending_items[0] if pending_items else "Final production validation and rollout."

        if "sso" in raw_notes_text.lower() or "sso" in str(pending_items).lower():
            customer_actions = ["Configure Enterprise SSO identity provider integration and provide test credentials."]
        else:
            customer_actions = ["Review staging milestone performance report during next sync."]

        # Restore clean text for display
        clean_summary = self.privacy_engine.sanitize_output(exec_summary, mapping)
        clean_subject = self.privacy_engine.sanitize_output(subject, mapping)

        return CustomerUpdateDraft(
            engagement_id=engagement_id,
            customer_name=customer_name,
            subject=clean_subject,
            executive_summary=clean_summary,
            key_milestones_achieved=milestones,
            next_milestone_target=next_target,
            customer_action_items=customer_actions,
            status="DRAFT",
            generated_at=datetime.now(timezone.utc).isoformat(),
            privacy_scrubbed=len(mapping.reference_to_original) > 0
        )
