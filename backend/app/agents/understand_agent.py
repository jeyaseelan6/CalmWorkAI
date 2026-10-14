"""
UNDERSTAND Agent — Outcome & Change Impact Intelligence.
Built on Google Agent Development Kit (ADK).
Analyzes customer requirement changes using Evidence -> Reasoning -> Recommendation pattern,
strictly protected by the pre-LLM AI Input Privacy Guardrail.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
import json
import logging
import os

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


class SuccessCriterionImpact(BaseModel):
    id: str
    title: str
    completed: bool
    impact_type: str = Field(description="UNTOUCHED | MODIFIED | ADDED | DEPRECATED")


class ChangeImpactAnalysis(BaseModel):
    change_title: str
    privacy_scrubbed: bool
    evidence: List[str]
    reasoning: List[str]
    recommendation: str
    suggested_outcome_statement: str
    suggested_success_criteria: List[Dict[str, Any]]
    risk_score: str = Field(description="LOW | MEDIUM | HIGH | CRITICAL")
    affected_dimensions: List[str]


UNDERSTAND_INSTRUCTION = (
    "You are the CalmWork UNDERSTAND Agent, an outcome-driven intelligence specialist for Forward-Deployed Engineers. "
    "Your objective is to evaluate incoming requirement changes, scope shifts, and technical constraints "
    "against active engagement outcome statements and Outcome Goals success criteria. "
    "Always reason using the Evidence -> Reasoning -> Recommendation pattern. "
    "Analyze whether the requirement introduces gating conditions, impacts existing success criteria, or requires Outcome Goals v2 expansion. "
    "Never silently modify authoritative database state; produce structured change impact analysis with recommendations for Manager approval. "
    "Return JSON matching keys: change_title (string), evidence (list of strings), reasoning (list of strings), "
    "recommendation (string), suggested_outcome_statement (string), suggested_success_criteria (list of dicts with id, title, completed), "
    "risk_score (LOW|MEDIUM|HIGH|CRITICAL), affected_dimensions (list of strings)."
)


class UnderstandAgent:
    """
    UNDERSTAND Agent: Google ADK-powered outcome alignment & change impact engine.
    Evaluates incoming engagement changes against current outcome definitions.
    Does NOT silently modify database state; produces recommendations for Manager approval.
    """

    def __init__(
        self,
        privacy_engine: Optional[PrivacyPolicyEngine] = None,
        session_service: Optional[BaseSessionService] = None
    ):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.session_service = session_service or get_session_service()
        self.model = get_adk_model()

        # Build genuine Google ADK Agent
        self.adk_agent = Agent(
            name="understand_agent",
            description="Evaluates requirement shifts and scope drift against Outcome Goals criteria using Evidence -> Reasoning -> Recommendation pattern.",
            model=self.model,
            instruction=UNDERSTAND_INSTRUCTION,
            output_schema=ChangeImpactAnalysis,
            before_model_callback=create_privacy_guardrail_callback(self.privacy_engine)
        )

        # ADK Runner for standalone execution
        self.runner = create_adk_runner(
            agent=self.adk_agent,
            session_service=self.session_service,
            app_name=settings.ADK_APP_NAME
        )

    def analyze_change(
        self,
        raw_change_text: str,
        current_outcome_statement: str,
        current_success_criteria: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> ChangeImpactAnalysis:
        """
        Runs privacy guardrail sanitization and analyzes change impact using Google ADK Agent.
        Returns validated Evidence -> Reasoning -> Recommendation payload.
        """
        sid = session_id or "session-understand"

        # 1. Pre-LLM Privacy Boundary Enforcement (Sanitization before ADK model transit)
        try:
            anonymized_change, mapping = self.privacy_engine.process_llm_input(
                text=raw_change_text,
                session_id=sid
            )
            anonymized_outcome, _ = self.privacy_engine.process_llm_input(
                text=current_outcome_statement,
                session_id=sid
            )
        except Exception as e:
            logger.error(f"Privacy guardrail preparation failed: {str(e)}")
            return ChangeImpactAnalysis(
                change_title="Change analysis blocked by privacy guardrail",
                privacy_scrubbed=False,
                evidence=["Privacy guardrail preparation failed"],
                reasoning=["Context could not be safely prepared for model transit"],
                recommendation="Manual review required due to privacy processing error.",
                suggested_outcome_statement=current_outcome_statement,
                suggested_success_criteria=current_success_criteria,
                risk_score="HIGH",
                affected_dimensions=["Privacy Boundary"]
            )

        # 2. Prepare ADK prompt with sanitized context (Mapping is NEVER sent to model)
        prompt = (
            f"Anonymized Requirement Input: {anonymized_change}\n"
            f"Anonymized Outcome Statement: {anonymized_outcome}\n"
            f"Current Success Criteria (Outcome Goals): {json.dumps(current_success_criteria)}"
        )

        # 3. Execute ADK Runner if model credentials or test mock available
        adk_response_text = None
        has_credentials = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or settings.GROQ_API_KEY or _MOCK_ADK_RESPONSES)
        if has_credentials:
            try:
                adk_response_text = execute_adk_runner(
                    runner=self.runner,
                    user_id="fde_user",
                    session_id=sid,
                    message_text=prompt,
                    system_instruction=UNDERSTAND_INSTRUCTION,
                    json_mode=True
                )
            except Exception as e:
                logger.warning(f"ADK Runner execution failed: {str(e)}")

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
                logger.warning(f"Failed to parse ADK structured output ({parse_err})")

        if not parsed or not isinstance(parsed, dict):
            raise RuntimeError(
                "AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
            )

        evidence = parsed.get("evidence", [])
        reasoning = parsed.get("reasoning", [])
        recommendation = parsed.get("recommendation", "")
        risk_score = parsed.get("risk_score", "MEDIUM")
        affected_dims = parsed.get("affected_dimensions", [])
        suggested_outcome = parsed.get("suggested_outcome_statement", current_outcome_statement)
        suggested_criteria = parsed.get("suggested_success_criteria", list(current_success_criteria))

        # 5. Sanitize output tokens back for authorized display
        clean_title = self.privacy_engine.sanitize_output(raw_change_text, mapping)
        clean_evidence = [self.privacy_engine.sanitize_output(e, mapping) for e in evidence]
        clean_reasoning = [self.privacy_engine.sanitize_output(r, mapping) for r in reasoning]
        clean_rec = self.privacy_engine.sanitize_output(recommendation, mapping)

        return ChangeImpactAnalysis(
            change_title=f"Customer requirement change: '{clean_title}'",
            privacy_scrubbed=len(mapping.reference_to_original) > 0,
            evidence=clean_evidence,
            reasoning=clean_reasoning,
            recommendation=clean_rec,
            suggested_outcome_statement=suggested_outcome,
            suggested_success_criteria=suggested_criteria,
            risk_score=risk_score,
            affected_dimensions=affected_dims
        )
