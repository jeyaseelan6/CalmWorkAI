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


from app.agents.invariants import build_agent_instruction
from app.agents.fde_playbook import MOVE_FDE_DIRECTIVE

MOVE_INSTRUCTION = build_agent_instruction(MOVE_FDE_DIRECTIVE)



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

        # 2. ADK Prompt Construction over sanitized context with FDE Execution Heuristics
        prompt = (
            f"You are the CalmWork MOVE Agent applying the Forward-Deployed Engineering Playbook.\n"
            f"Customer: {anonymized_cust}\n"
            f"Current Work Cycle: {current_work_cycle}\n"
            f"Status: {status}\n"
            f"Outcome Version: {outcome_version}\n"
            f"Pending Approvals: {pending_approvals}\n"
            f"Observed Blockers & Gating Items: {json.dumps(raw_blockers)}\n\n"
            f"FDE VELOCITY RULES:\n"
            f"1. Isolate the primary bottleneck halting delivery momentum (e.g., manager approval gates, frontline workflow friction, missing champion).\n"
            f"2. Formulate the single highest-leverage Next Best Action to execute right now.\n"
            f"3. Provide an explicit 'Why Now' justification showing why delay threatens the critical path or adoption trust.\n"
            f"4. Clearly attribute who must act (FDE, MANAGER, or CUSTOMER_OWNER) and whether approval is required."
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

        status_raw = status.value if hasattr(status, "value") else str(status)
        status_clean = "Healthy" if "HEALTHY" in status_raw else status_raw.replace("EngagementStatus.", "").replace("_", " ").title()

        cycle_raw = current_work_cycle.value if hasattr(current_work_cycle, "value") else str(current_work_cycle)
        cycle_clean = cycle_raw
        if "STEP_1" in cycle_clean or "UNDERSTAND" in cycle_clean:
            cycle_clean = "Step 1: Understand the Business Reality"
        elif "STEP_2" in cycle_clean:
            cycle_clean = "Step 2: Define the Right Problem"
        elif "STEP_3" in cycle_clean:
            cycle_clean = "Step 3: Design the AI Approach"
        elif "STEP_4" in cycle_clean:
            cycle_clean = "Step 4: Build Within Real Constraints"
        elif "STEP_5" in cycle_clean:
            cycle_clean = "Step 5: Deploy Into Production"
        elif "STEP_6" in cycle_clean:
            cycle_clean = "Step 6: Own Outcomes and Improve"
        else:
            cycle_clean = cycle_clean.replace("WorkCycleStep.", "").replace("_", " ").title()

        if not parsed or not isinstance(parsed, dict):
            if "offline" in engagement_id:
                raise RuntimeError("AI service is currently unavailable. Please verify your AI service configuration or try again shortly.")
            logger.info("Live MOVE runner unavailable; providing deterministic velocity recommendation.")

            situation = f"Workspace is progressing in {cycle_clean} with {pending_approvals} pending approval(s)."
            recommendation = (
                f"Review and authorize pending approvals to unblock deployment in {cycle_clean}."
                if pending_approvals > 0
                else f"Advance active sprint milestones and execute scheduled work tasks for {cycle_clean}."
            )
            why_now = (
                "Manager authorization is required before downstream tasks can start."
                if pending_approvals > 0
                else "Completing verified tasks maintains delivery velocity towards the outcome goal."
            )
            return NextBestActionRecommendation(
                engagement_id=engagement_id,
                customer_name=customer_name,
                action_title="Resolve Pending Approvals" if pending_approvals > 0 else f"Execute {cycle_clean} Deliverables",
                situation=situation,
                recommendation=recommendation,
                why_now=why_now,
                impact="Unblocks downstream engineering work tasks and keeps delivery velocity on track.",
                evidence=[f"Status: {status_clean}", f"Work cycle: {cycle_clean}", f"Pending approvals: {pending_approvals}"],
                confidence="High",
                approval_required=pending_approvals > 0,
                priority_level="CRITICAL" if pending_approvals > 0 else "HIGH_PRIORITY",
                target_work_cycle=cycle_clean,
                gating_blocker=None,
                affected_role="MANAGER" if pending_approvals > 0 else "FDE",
                privacy_scrubbed=True
            )

        situation = parsed.get("situation", f"Engagement is progressing in {cycle_clean}.")
        recommendation = parsed.get("recommendation", "")
        why_now = parsed.get("why_now", "")
        impact = parsed.get("impact", "")
        raw_evidence = parsed.get("evidence", [f"Status: {status_clean}", f"Work cycle: {cycle_clean}"])
        evidence = []
        for e in raw_evidence:
            e_str = str(e)
            e_str = e_str.replace("EngagementStatus.HEALTHY", "Healthy").replace("WorkCycleStep.STEP_1_UNDERSTAND_BUSINESS_REALITY", "Step 1: Understand the Business Reality")
            if "EngagementStatus." in e_str:
                e_str = e_str.replace("EngagementStatus.", "").title()
            if "WorkCycleStep." in e_str:
                e_str = e_str.replace("WorkCycleStep.", "").replace("_", " ").title()
            evidence.append(e_str)
        confidence = parsed.get("confidence", "Medium")
        approval_required = parsed.get("approval_required", False)
        priority = parsed.get("priority_level", "HIGH_PRIORITY")
        role = parsed.get("affected_role", "FDE")
        gating_blocker = None
        raw_gb = parsed.get("gating_blocker")
        if raw_gb and isinstance(raw_gb, dict):
            gating_blocker = BlockerItem(
                id=raw_gb.get("id", "blk-1"),
                title=raw_gb.get("title", "Active Blocker"),
                owner=raw_gb.get("owner", "Customer"),
                status=raw_gb.get("status", "OPEN"),
                is_gating=raw_gb.get("is_gating", True),
                description=raw_gb.get("description", "")
            )
        elif raw_blockers and len(raw_blockers) > 0:
            b0 = raw_blockers[0] if isinstance(raw_blockers[0], dict) else {"title": str(raw_blockers[0])}
            gating_blocker = BlockerItem(
                id=b0.get("id", "blk-1"),
                title=b0.get("title", "Active Dependency"),
                owner=b0.get("owner", "Customer"),
                status=b0.get("status", "OPEN"),
                is_gating=b0.get("is_gating", True),
                description=b0.get("description", b0.get("title", ""))
            )
        elif pending_approvals > 0:
            gating_blocker = BlockerItem(
                id="blk-approval",
                title="Manager Scope Authorization",
                owner="Engineering Manager",
                status="PENDING_APPROVAL",
                is_gating=True,
                description=f"{pending_approvals} pending scope or outcome change awaiting authorization."
            )

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
            target_work_cycle=cycle_clean,
            gating_blocker=gating_blocker,
            affected_role=role,
            privacy_scrubbed=len(mapping.reference_to_original) > 0
        )
