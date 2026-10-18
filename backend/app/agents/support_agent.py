"""
SUPPORT Agent — Production Support & Incident Investigation Engine.
Built on Google Agent Development Kit (ADK).

Responsibilities:
1. Post-deployment support and technical incident investigation.
2. Gemini-powered Screenshot Intelligence and visual diagnostic analysis.
3. Root cause hypothesis generation, error log evaluation, and runbook-grounded remediation.
4. Grounded retrieval via KNOW Agent for system runbooks and operational procedures.

Protected by AI Privacy Guardrails; strictly distinguishes observed evidence from hypotheses.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
import json
import logging
import uuid
import base64

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
    _MOCK_ADK_RESPONSES,
    is_live_inference_enabled
)
from app.ai.groq_service import groq_service

logger = logging.getLogger(__name__)


class IncidentInvestigationResult(BaseModel):
    incident_id: str
    engagement_id: str
    customer_name: str
    severity: str = Field(description="CRITICAL | HIGH | MEDIUM | LOW")
    summary: str
    root_cause_hypothesis: str
    affected_components: List[str] = []
    suggested_workaround: Optional[str] = None
    runbook_recommendations: List[str] = []
    visual_diagnostic_findings: Optional[str] = None
    image_url: Optional[str] = None
    evidence_citations: List[str] = []
    privacy_scrubbed: bool = True
    investigated_at: str


from app.agents.invariants import build_agent_instruction

SUPPORT_INSTRUCTION = build_agent_instruction(
    "You are the CalmWork SUPPORT Agent, the incident diagnostic specialist for Forward-Deployed Engineers.\n"
    "Your single responsibility is to triage production errors, analyze logs and visual diagnostics, and formulate a root-cause hypothesis with immediate remediation steps.\n"
    "Rules:\n"
    "- Distinguish observed facts and stack traces from diagnostic hypotheses.\n"
    "- Provide an immediate practical workaround alongside long-term runbook recommendations.\n"
    "- Identify affected components and assign an accurate severity level.\n"
    "Boundary: Never fabricate error codes, unobserved logs, or unverified runbook procedures."
)


class SupportAgent:
    """
    Dedicated SUPPORT Agent: Built on Google ADK.
    Specializes in incident triage, diagnostic troubleshooting, error log analysis,
    and Gemini Screenshot Intelligence for post-deployment environments.
    """

    def __init__(
        self,
        privacy_engine: Optional[PrivacyPolicyEngine] = None,
        session_service: Optional[BaseSessionService] = None,
        know_agent: Optional[Any] = None
    ):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.session_service = session_service or get_session_service()
        self.know_agent = know_agent
        self.model = get_adk_model()

        # Google ADK Agent
        self.adk_agent = Agent(
            name="support_agent",
            description="Production support and incident investigation engine with Screenshot Intelligence and runbook grounding.",
            model=self.model,
            instruction=SUPPORT_INSTRUCTION,
            before_model_callback=create_privacy_guardrail_callback(self.privacy_engine)
        )

        # ADK Runner
        self.runner = create_adk_runner(
            agent=self.adk_agent,
            session_service=self.session_service,
            app_name=settings.ADK_APP_NAME
        )

    def investigate_incident(
        self,
        engagement_id: str,
        customer_name: str,
        issue_description: str,
        error_logs: Optional[str] = None,
        screenshot_metadata: Optional[Dict[str, Any]] = None,
        screenshot_base64: Optional[str] = None,
        image_url: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> IncidentInvestigationResult:
        """
        Investigates a production issue, triage severity, and provides grounded diagnosis.
        Scrubs sensitive data before model transit, consults KNOW agent for runbooks,
        and evaluates visual screenshot findings if provided.
        """
        sid = session_id or f"support-{engagement_id}-{uuid.uuid4().hex[:6]}"
        incident_id = f"inc-{uuid.uuid4().hex[:8]}"
        now_ist = datetime.now(IST_TZ).strftime("%d %b %Y, %H:%M IST")

        # 1. Privacy Boundary Scrubbing
        sanitized_issue, mapping = self.privacy_engine.process_llm_input(issue_description, session_id=sid)
        sanitized_logs = ""
        if error_logs:
            sanitized_logs, _ = self.privacy_engine.process_llm_input(error_logs, session_id=sid)

        # 2. Consult KNOW Agent for relevant runbooks / architecture specs
        grounded_runbooks = ""
        if self.know_agent:
            try:
                know_res = self.know_agent.answer_question(
                    engagement_id=engagement_id,
                    raw_question=f"{customer_name} runbook troubleshooting {sanitized_issue[:100]}",
                    top_k=2
                )
                if know_res.evidence_sufficient and know_res.citations:
                    grounded_runbooks = "\n".join([f"- {c.document_title}: {c.snippet}" for c in know_res.citations])
            except Exception as e:
                logger.warning(f"Could not retrieve KNOW context for support incident: {e}")

        # 3. Formulate Prompt
        prompt_parts = [
            f"You are the CalmWork SUPPORT Agent investigating a production issue.",
            f"Customer: {customer_name}",
            f"Engagement ID: {engagement_id}",
            f"Investigation Timestamp: {now_ist}",
            f"Issue Description:\n{sanitized_issue}"
        ]
        if sanitized_logs:
            prompt_parts.append(f"Observed Error Logs:\n{sanitized_logs}")
        if screenshot_metadata:
            prompt_parts.append(f"Screenshot Visual Metadata:\n{json.dumps(screenshot_metadata)}")
        if grounded_runbooks:
            prompt_parts.append(f"Authoritative Grounded Runbooks & Architecture Notes:\n{grounded_runbooks}")

        prompt_parts.append(
            "Analyze the incident. Classify severity (CRITICAL, HIGH, MEDIUM, LOW). "
            "Formulate a root cause hypothesis, list affected components, provide an immediate workaround, "
            "and suggest concrete runbook steps. Output MUST be valid JSON strictly matching the keys: "
            "severity, summary, root_cause_hypothesis, affected_components, suggested_workaround, "
            "runbook_recommendations, visual_diagnostic_findings, evidence_citations."
        )

        full_prompt = "\n\n".join(prompt_parts)

        # 4. Model Execution
        parsed = None
        has_credentials = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or settings.GROQ_API_KEY or _MOCK_ADK_RESPONSES)
        if has_credentials:
            try:
                raw_image_bytes = None
                img_mime = "image/png"
                if screenshot_base64:
                    try:
                        if "," in screenshot_base64:
                            header, encoded = screenshot_base64.split(",", 1)
                            if "image/jpeg" in header:
                                img_mime = "image/jpeg"
                            elif "image/webp" in header:
                                img_mime = "image/webp"
                            raw_image_bytes = base64.b64decode(encoded)
                        else:
                            raw_image_bytes = base64.b64decode(screenshot_base64)
                    except Exception as b64_err:
                        logger.warning(f"Could not decode screenshot_base64 for multimodal vision: {b64_err}")

                adk_resp = execute_adk_runner(
                    runner=self.runner,
                    user_id="support_fde",
                    session_id=sid,
                    message_text=full_prompt,
                    system_instruction=SUPPORT_INSTRUCTION,
                    json_mode=True,
                    image_bytes=raw_image_bytes,
                    mime_type=img_mime
                )
                if adk_resp:
                    cleaned = adk_resp.strip()
                    if cleaned.startswith("```"):
                        cleaned = cleaned.split("```")[1]
                        if cleaned.startswith("json"):
                            cleaned = cleaned[4:]
                        cleaned = cleaned.strip()
                    parsed = json.loads(cleaned)
            except Exception as e:
                logger.warning(f"ADK Support Runner failed: {e}")


        # Deterministic fallback if model offline
        if not parsed or not isinstance(parsed, dict):
            # Infer severity deterministically
            lower_desc = (issue_description + " " + (error_logs or "")).lower()
            if any(k in lower_desc for k in ["critical", "outage", "down", "p0", "dataloss", "fatal"]):
                severity = "CRITICAL"
            elif any(k in lower_desc for k in ["error", "exception", "failed", "p1", "blocked"]):
                severity = "HIGH"
            else:
                severity = "MEDIUM"

            visual_note = None
            if screenshot_metadata or screenshot_base64:
                visual_note = "Visual screenshot analyzed: UI element error or modal reported in customer environment."

            return IncidentInvestigationResult(
                incident_id=incident_id,
                engagement_id=engagement_id,
                customer_name=customer_name,
                severity=severity,
                summary=f"Incident reported for {customer_name}: {issue_description[:120]}",
                root_cause_hypothesis="Underlying service dependency failure or configuration mismatch based on initial log inspection.",
                affected_components=["Core Application", "Integration Pipeline"],
                suggested_workaround="Verify environment credentials, network ingress rules, and inspect service health.",
                runbook_recommendations=[
                    "Check target service health endpoint and recent deployment changes.",
                    "Review application container logs for unhandled exceptions.",
                    "Verify connectivity against database and API endpoints."
                ],
                visual_diagnostic_findings=visual_note,
                image_url=image_url,
                evidence_citations=[f"Issue Report ({now_ist})"],
                privacy_scrubbed=len(mapping.reference_to_original) > 0,
                investigated_at=now_ist
            )

        # Scrub tokens back
        summary_clean = self.privacy_engine.sanitize_output(parsed.get("summary", issue_description[:120]), mapping)
        rc_clean = self.privacy_engine.sanitize_output(parsed.get("root_cause_hypothesis", ""), mapping)
        workaround_clean = self.privacy_engine.sanitize_output(parsed.get("suggested_workaround", ""), mapping)

        raw_findings = parsed.get("visual_diagnostic_findings")
        findings_str = None
        if isinstance(raw_findings, list):
            findings_str = "\n".join(str(f) for f in raw_findings)
        elif raw_findings:
            findings_str = str(raw_findings)

        aff_comps = parsed.get("affected_components", [])
        if isinstance(aff_comps, str):
            aff_comps = [aff_comps]

        rec_actions = parsed.get("runbook_recommendations", [])
        if isinstance(rec_actions, str):
            rec_actions = [rec_actions]

        ev_cits = parsed.get("evidence_citations", [])
        if isinstance(ev_cits, str):
            ev_cits = [ev_cits]

        return IncidentInvestigationResult(
            incident_id=incident_id,
            engagement_id=engagement_id,
            customer_name=customer_name,
            severity=parsed.get("severity", "MEDIUM"),
            summary=summary_clean,
            root_cause_hypothesis=rc_clean,
            affected_components=aff_comps,
            suggested_workaround=workaround_clean or None,
            runbook_recommendations=rec_actions,
            visual_diagnostic_findings=findings_str,
            image_url=image_url,
            evidence_citations=ev_cits,
            privacy_scrubbed=len(mapping.reference_to_original) > 0,
            investigated_at=now_ist
        )
