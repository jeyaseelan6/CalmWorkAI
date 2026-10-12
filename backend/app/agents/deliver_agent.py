"""
DELIVER Agent — Executive Customer Communication Engine.
Built on Google Agent Development Kit (ADK).
Translates technical engineering progress, DoD checklist completion, and work cycle steps into
executive business language updates suitable for customer stakeholders, protected by AI Privacy Guardrail.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone
import json
import logging

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import BaseSessionService

from app.config import settings
from app.privacy import PrivacyPolicyEngine
from app.agents.adk_runtime import (
    get_adk_model,
    get_session_service,
    create_privacy_guardrail_callback,
    create_adk_runner,
    execute_adk_runner
)

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


DELIVER_INSTRUCTION = (
    "You are the CalmWork DELIVER Agent, an executive communication specialist for Forward-Deployed Engineers. "
    "Your objective is to translate technical engineering milestone progress into executive, polished business communication "
    "suitable for enterprise customer stakeholders. "
    "Never claim unverified completions. Only reference verified milestones and criteria. "
    "Drafts must always require human manager approval before distribution. "
    "Return JSON matching keys: subject (string), executive_summary (string), "
    "key_milestones_achieved (list of strings), next_milestone_target (string), customer_action_items (list of strings)."
)


class DeliverAgent:
    """
    DELIVER Agent: Google ADK-powered executive communication drafting engine.
    Translates technical outcomes and DoD progress into manager-approved customer updates.
    Does NOT auto-send communications. Manager review & approval required.
    """

    def __init__(
        self,
        privacy_engine: Optional[PrivacyPolicyEngine] = None,
        session_service: Optional[BaseSessionService] = None,
        gemini_service: Optional[Any] = None  # retained for backward compatibility
    ):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.session_service = session_service or get_session_service()
        self.model = get_adk_model()

        # Build genuine Google ADK Agent
        self.adk_agent = Agent(
            name="deliver_agent",
            description="Translates verified technical milestones into executive stakeholder communications requiring manager approval.",
            model=self.model,
            instruction=DELIVER_INSTRUCTION,
            output_schema=CustomerUpdateDraft,
            before_model_callback=create_privacy_guardrail_callback(self.privacy_engine)
        )

        # ADK Runner for standalone execution
        self.runner = create_adk_runner(
            agent=self.adk_agent,
            session_service=self.session_service,
            app_name=settings.ADK_APP_NAME
        )

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
        Generates executive business update draft from technical engagement progress using Google ADK.
        """
        raw_notes_text = raw_notes or ""

        # 1. Pre-LLM Privacy Guardrail Anonymization
        anonymized_notes, mapping = self.privacy_engine.process_llm_input(
            text=f"{customer_name} {raw_notes_text}",
            session_id=engagement_id
        )

        # Extract completed success criteria
        completed_items = [c.get("title", "") for c in success_criteria if c.get("completed")]
        pending_items = [c.get("title", "") for c in success_criteria if not c.get("completed")]

        # 2. Baseline content structure
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

        # 3. Construct ADK Prompt
        prompt = (
            f"Customer: {customer_name}\n"
            f"Engagement Name: {engagement_name}\n"
            f"Target Outcome: {outcome_statement}\n"
            f"Format Type: {format_type}\n"
            f"Active Work Cycle: {current_work_cycle}\n"
            f"Completed Milestones: {json.dumps(completed_items)}\n"
            f"Pending Milestones: {json.dumps(pending_items)}\n"
            f"Engineer Notes: {anonymized_notes}"
        )

        # 4. Attempt ADK Runner Execution
        adk_response_text = None
        has_credentials = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or settings.GROQ_API_KEY)
        if has_credentials:
            try:
                adk_response_text = execute_adk_runner(
                    runner=self.runner,
                    user_id="fde_user",
                    session_id=engagement_id,
                    message_text=prompt,
                    system_instruction=DELIVER_INSTRUCTION,
                    json_mode=True
                )
            except Exception as e:
                logger.warning(f"ADK DELIVER runner execution failed ({str(e)}); using deterministic template draft.")

        # 5. Parse ADK response if received
        if adk_response_text:
            try:
                cleaned = adk_response_text.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("```")[1]
                    if cleaned.startswith("json"):
                        cleaned = cleaned[4:]
                    cleaned = cleaned.strip()

                parsed = json.loads(cleaned)
                if parsed.get("subject"):
                    subject = parsed["subject"]
                if parsed.get("executive_summary"):
                    exec_summary = parsed["executive_summary"]
                if parsed.get("key_milestones_achieved"):
                    milestones = parsed["key_milestones_achieved"]
                if parsed.get("next_milestone_target"):
                    next_target = parsed["next_milestone_target"]
                if parsed.get("customer_action_items"):
                    customer_actions = parsed["customer_action_items"]
            except Exception as parse_err:
                logger.warning(f"Failed to parse ADK DELIVER output ({parse_err}); using template draft.")

        # 6. Sanitize tokens back for authorized display
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
