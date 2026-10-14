"""
MOVE Agent — Execution Velocity & Next Best Action Engine.
Built on Google Agent Development Kit (ADK).
Evaluates active blockers, dependencies, and gating criteria across the 6 FDE Work Cycles,
determining the single highest-impact Next Best Action with explicit 'Why Now' justification.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
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
    execute_adk_runner,
    _MOCK_ADK_RESPONSES
)

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


MOVE_INSTRUCTION = (
    "You are the CalmWork MOVE Agent, an execution velocity specialist for Forward-Deployed Engineers. "
    "Your objective is to determine the single highest-impact Next Best Action to maintain delivery velocity "
    "and clear gating criteria across the 6 FDE Work Cycles. "
    "All target times and deadlines must strictly use Indian Standard Time (IST) 24-hour clock (e.g. '14 Oct 2026, 17:00 IST'). NEVER use UTC or 12-hour AM/PM formats. "
    "Analyze active blockers, gating criteria, outcome status, and work cycle phase. "
    "Return JSON matching keys: action_title (string), situation (string), recommendation (string), "
    "why_now (string), impact (string), evidence (list of strings), confidence ('High'|'Medium'|'Low'), "
    "approval_required (bool), priority_level ('CRITICAL'|'HIGH_PRIORITY'|'MEDIUM_PRIORITY'|'ROUTINE'), "
    "affected_role ('FDE'|'MANAGER'|'CUSTOMER_OWNER')."
)


class MoveAgent:
    """
    MOVE Agent: Google ADK-powered execution velocity & gating action engine.
    Ranks actions by impact on gating criteria and outcome velocity.
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
            name="move_agent",
            description="Evaluates blockers, work cycles, and gating criteria to calculate the single highest-leverage Next Best Action with Why Now rationale.",
            model=self.model,
            instruction=MOVE_INSTRUCTION,
            output_schema=NextBestActionRecommendation,
            before_model_callback=create_privacy_guardrail_callback(self.privacy_engine)
        )

        # ADK Runner for standalone execution
        self.runner = create_adk_runner(
            agent=self.adk_agent,
            session_service=self.session_service,
            app_name=settings.ADK_APP_NAME
        )

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
        Calculates the single highest-priority Next Best Action for the FDE using Google ADK.
        """
        raw_blockers = blockers or []

        # 1. Pre-LLM Privacy Boundary Enforcement
        anonymized_cust, mapping = self.privacy_engine.process_llm_input(
            text=customer_name,
            session_id=engagement_id
        )

        # 2. ADK Prompt Construction over sanitized context
        prompt = (
            f"Customer: {anonymized_cust}\n"
            f"Current Work Cycle: {current_work_cycle}\n"
            f"Status: {status}\n"
            f"Outcome Version: {outcome_version}\n"
            f"Pending Approvals: {pending_approvals}\n"
            f"Blockers: {json.dumps(raw_blockers)}"
        )

        # 3. Attempt ADK Runner execution
        adk_response_text = None
        has_credentials = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or settings.GROQ_API_KEY or _MOCK_ADK_RESPONSES)
        if has_credentials:
            try:
                adk_response_text = execute_adk_runner(
                    runner=self.runner,
                    user_id="fde_user",
                    session_id=engagement_id,
                    message_text=prompt,
                    system_instruction=MOVE_INSTRUCTION,
                    json_mode=True
                )
            except Exception as e:
                logger.warning(f"ADK MOVE runner execution failed ({str(e)})")

        # 4. Parse ADK output — strictly no deterministic fallback fabrication
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
                logger.warning(f"Failed to parse ADK MOVE output ({parse_err})")

        if not parsed or not isinstance(parsed, dict):
            raise RuntimeError(
                "AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
            )

        situation = parsed.get("situation", f"Engagement is progressing in {current_work_cycle}.")
        recommendation = parsed.get("recommendation", "")
        why_now = parsed.get("why_now", "")
        impact = parsed.get("impact", "")
        evidence = parsed.get("evidence", [f"Status: {status}", f"Work cycle: {current_work_cycle}"])
        confidence = parsed.get("confidence", "Medium")
        approval_required = parsed.get("approval_required", False)
        priority = parsed.get("priority_level", "HIGH_PRIORITY")
        role = parsed.get("affected_role", "FDE")
        gating_blocker = None

        # 6. Sanitize output tokens back for authorized display
        clean_rec = self.privacy_engine.sanitize_output(recommendation, mapping)
        clean_sit = self.privacy_engine.sanitize_output(situation, mapping)
        clean_why = self.privacy_engine.sanitize_output(why_now, mapping)
        clean_impact = self.privacy_engine.sanitize_output(impact, mapping)

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
            privacy_scrubbed=len(mapping.reference_to_original) > 0
        )
