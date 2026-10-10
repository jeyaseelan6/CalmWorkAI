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
from app.ai.gemini_service import GeminiService

logger = logging.getLogger(__name__)


class CustomerUpdateDraft(BaseModel):
    engagement_id: str
    customer_name: str
    format_type: str = Field(description="EXECUTIVE_SUMMARY | TECHNICAL_LOG | RELEASE_NOTE")
    subject: str
    executive_summary: str
    key_milestones_achieved: List[str]
    next_milestone_target: str
    customer_action_items: List[str]
    status: str = Field(description="DRAFT | PENDING_MANAGER_APPROVAL | APPROVED | SENT")
    generated_at: str
    privacy_scrubbed: bool = True
    approval_required: bool = True


class DeliverAgent:
    """
    DELIVER Agent: Translates technical outcomes and DoD progress into
    manager-approved, executive-ready customer updates.
    Does NOT auto-send communications. Manager review & approval required.
    """

    def __init__(
        self,
        privacy_engine: Optional[PrivacyPolicyEngine] = None,
        gemini_service: Optional[GeminiService] = None
    ):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.gemini_service = gemini_service or GeminiService(privacy_engine=self.privacy_engine)

    def generate_customer_update(
        self,
        engagement_id: str,
        customer_name: str,
        engagement_name: str,
        outcome_statement: str,
        success_criteria: List[Dict[str, Any]],
        current_work_cycle: str,
        raw_notes: Optional[str] = None,
        format_type: str = "EXECUTIVE_SUMMARY"
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

        # Extract completed success criteria
        completed_items = [c.get("title", "") for c in success_criteria if c.get("completed")]
        pending_items = [c.get("title", "") for c in success_criteria if not c.get("completed")]

        if format_type == "TECHNICAL_LOG":
            subject = f"Technical Progress Log: {customer_name} — {engagement_name}"
            exec_summary = (
                f"Technical status log for {engagement_name}. Active Work Cycle: {current_work_cycle}. "
                f"DoD Progress: {len(completed_items)} / {len(success_criteria)} criteria verified."
            )
        elif format_type == "RELEASE_NOTE":
            subject = f"Release Note: {customer_name} — Milestone Verification"
            exec_summary = (
                f"Release verification notes for {engagement_name}. Target outcome: '{outcome_statement}'. "
                f"All completed checklist items are verified in staging."
            )
        else:
            subject = f"Executive Update: {customer_name} — {engagement_name} Progress"
            exec_summary = (
                f"We are actively advancing the {engagement_name} initiative for {customer_name} "
                f"in alignment with our target outcome: '{outcome_statement}'."
            )

        milestones = [f"Delivered: {item}" for item in completed_items] if completed_items else ["Completed initial environment & API baseline setup."]
        next_target = pending_items[0] if pending_items else "Final production validation and handover."
        customer_actions = ["Review milestone progress during next scheduled sync."]

        # Try live Gemini executive drafting if available
        if self.gemini_service and self.gemini_service.api_key:
            gemini_draft = self.gemini_service.draft_customer_update(
                customer_name=customer_name,
                engagement_name=engagement_name,
                outcome_statement=outcome_statement,
                current_work_cycle=str(current_work_cycle),
                completed_milestones=completed_items,
                pending_milestones=pending_items,
                format_type=format_type,
                raw_notes=raw_notes_text,
                session_id=engagement_id
            )
            if gemini_draft and isinstance(gemini_draft, dict):
                if gemini_draft.get("subject"):
                    subject = gemini_draft["subject"]
                if gemini_draft.get("executive_summary"):
                    exec_summary = gemini_draft["executive_summary"]
                if gemini_draft.get("key_milestones_achieved"):
                    milestones = gemini_draft["key_milestones_achieved"]
                if gemini_draft.get("next_milestone_target"):
                    next_target = gemini_draft["next_milestone_target"]
                if gemini_draft.get("customer_action_items"):
                    customer_actions = gemini_draft["customer_action_items"]

        clean_summary = self.privacy_engine.sanitize_output(exec_summary, mapping)
        clean_subject = self.privacy_engine.sanitize_output(subject, mapping)

        return CustomerUpdateDraft(
            engagement_id=engagement_id,
            customer_name=customer_name,
            format_type=format_type,
            subject=clean_subject,
            executive_summary=clean_summary,
            key_milestones_achieved=milestones,
            next_milestone_target=next_target,
            customer_action_items=customer_actions,
            status="PENDING_MANAGER_APPROVAL",
            generated_at=datetime.now(timezone.utc).isoformat(),
            privacy_scrubbed=len(mapping.reference_to_original) > 0,
            approval_required=True
        )
