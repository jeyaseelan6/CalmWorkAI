"""
DELIVER Agent — Executive Customer Communication Engine.
Built on Google Agent Development Kit (ADK).
Translates technical engineering progress, DoD checklist completion, and work cycle steps into
executive business language updates suitable for customer stakeholders, protected by AI Privacy Guardrail.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
import json
import logging

IST_TZ = timezone(timedelta(hours=5, minutes=30))

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
    execute_adk_runner,
    _MOCK_ADK_RESPONSES
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


from app.agents.invariants import build_agent_instruction

DELIVER_INSTRUCTION = build_agent_instruction(
    "You are the CalmWork DELIVER Agent, the executive communication specialist for Forward-Deployed Engineers.\n"
    "Your single responsibility is to translate technical milestone completions into clear, professional progress updates for enterprise stakeholders.\n"
    "Rules:\n"
    "- Summarize engineering achievements in business-focused language, highlighting milestone targets and customer action items.\n"
    "- Reference only verified, completed milestones and approved criteria.\n"
    "- Maintain a transparent, confident, and professional executive tone.\n"
    "Boundary: All generated communication drafts are strictly proposals requiring human manager approval before release."
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

        # 2. Construct ADK Prompt
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

        # 3. Attempt ADK Runner Execution
        adk_response_text = None
        has_credentials = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or settings.GROQ_API_KEY or _MOCK_ADK_RESPONSES)
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
                logger.warning(f"ADK DELIVER runner execution failed: {str(e)}")

        # 4. Parse ADK response — strictly no deterministic fallback fabrication
        parsed = None
        if adk_response_text:
            try:
                cleaned = adk_response_text.strip()
                if cleaned.startswith("```"):
                    cleaned = cleaned.split("```")[1]
                    if cleaned.startswith("json"):
                        cleaned = cleaned[4:]
                    cleaned = cleaned.strip()

                parsed = json.loads(cleaned)
            except Exception as parse_err:
                logger.warning(f"Failed to parse ADK DELIVER output ({parse_err})")

        if not parsed or not isinstance(parsed, dict):
            raise RuntimeError(
                "AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
            )

        subject = parsed.get("subject", f"Customer Update: {customer_name} — {engagement_name}")
        exec_summary = parsed.get("executive_summary", "")
        milestones = parsed.get("key_milestones_achieved", [])
        next_target = parsed.get("next_milestone_target", "")
        customer_actions = parsed.get("customer_action_items", [])

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
            generated_at=datetime.now(IST_TZ).isoformat(),
            privacy_scrubbed=len(mapping.reference_to_original) > 0,
            approval_required=True
        )
