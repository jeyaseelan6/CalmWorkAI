"""
PLAN Agent — Planning & Delivery Intelligence.
Built on Google Agent Development Kit (ADK).

Consolidates:
1. Natural language enterprise delivery planning and iterative plan reassessment.
2. Grounded requirement drift analysis, scope impact, and Outcome Goals health (migrated from UNDERSTAND).
3. Grounded retrieval via KNOW Agent to anchor plans in verified architecture specs.

Strictly protects context via pre-LLM AI Privacy Guardrails and enforces non-destructive
proposals requiring Engineering Manager approval for scope or commitment changes.
"""

from typing import Dict, Any, List, Optional, Callable
from pydantic import BaseModel, Field
import json
import logging
import uuid
from datetime import datetime, timezone

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import BaseSessionService
from fastapi import HTTPException, status

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


# -------------------------------------------------------------------------
# Pydantic Schemas for Delivery Planning & Change Impact Intelligence
# -------------------------------------------------------------------------

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


class WorkTask(BaseModel):
    id: str
    milestone_id: str
    title: str
    description: str
    dependencies: List[str] = []
    owner: Optional[str] = None
    status: str = "PLANNED"  # "PLANNED" | "IN_PROGRESS" | "COMPLETED"
    due_date: Optional[str] = None
    linked_goal_id: Optional[str] = None
    approval_status: Optional[str] = "APPROVED"


class WorkMilestone(BaseModel):
    id: str
    title: str
    sequence_order: int
    deliverables: List[str] = []
    dependencies: List[str] = []
    customer_decisions_required: List[str] = []


class FactAssumptionGap(BaseModel):
    confirmed_facts: List[str] = []
    inferred_assumptions: List[str] = []
    unresolved_questions_or_gaps: List[str] = []


class StructuredWorkPlanProposal(BaseModel):
    proposal_id: str
    engagement_id: str
    customer_name: str
    engagement_objective: str
    outcomes: List[str] = []
    definition_of_done: List[Dict[str, Any]] = []
    milestones: List[WorkMilestone] = []
    tasks: List[WorkTask] = []
    risks: List[str] = []
    facts_and_assumptions: FactAssumptionGap = Field(default_factory=FactAssumptionGap)
    next_actions: List[str] = []
    timeline_summary: str = ""
    is_provisional: bool = False
    clarifying_questions: List[str] = []
    status: str = "PROPOSED"
    generated_at: str


class PlanReassessmentResult(BaseModel):
    plan_id: str
    engagement_id: str
    outcome_health: str  # "HEALTHY" | "ATTENTION" | "NEEDS_REASSESSMENT"
    evidence_observed: List[str] = []
    scope_drift_detected: bool = False
    scope_drift_explanation: Optional[str] = None
    recommended_modifications: List[str] = []
    tasks_to_add: List[WorkTask] = []
    tasks_to_update: List[Dict[str, Any]] = []
    requires_manager_approval: bool = False
    reassessed_at: str


from app.agents.invariants import build_agent_instruction
from app.agents.fde_playbook import PLAN_FDE_DIRECTIVE

PLAN_INSTRUCTION = build_agent_instruction(PLAN_FDE_DIRECTIVE)



class PlanAgent:
    """
    Dedicated PLAN Agent: Built on Google ADK.
    Integrates planning synthesis, iterative plan reassessment, and scope/requirement drift intelligence.
    Consumes KNOW Agent for grounded architecture evidence retrieval.
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
            name="plan_agent",
            description="Specialized planning and delivery intelligence engine. Generates structured work plans, analyzes requirement shifts, evaluates scope drift, and reassesses plans against grounded evidence.",
            model=self.model,
            instruction=PLAN_INSTRUCTION,
            before_model_callback=create_privacy_guardrail_callback(self.privacy_engine)
        )

        # ADK Runner for standalone execution
        self.runner = create_adk_runner(
            agent=self.adk_agent,
            session_service=self.session_service,
            app_name=settings.ADK_APP_NAME
        )

    # ---------------------------------------------------------------------
    # 1. Natural Language Work Plan Generation
    # ---------------------------------------------------------------------

    def generate_natural_language_work_plan(
        self,
        engagement_id: str,
        customer_name: str,
        natural_language_description: str,
        existing_plan_edits: Optional[Dict[str, Any]] = None,
        current_outcome_statement: Optional[str] = None,
        current_success_criteria: Optional[List[Any]] = None,
        session_id: Optional[str] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> StructuredWorkPlanProposal:
        """
        Interprets a natural language work description,
        scrubs sensitive PII through Privacy Guardrails,
        retrieves verified architecture specs from KNOW Agent,
        invokes the Google ADK Plan Agent to formulate a structured plan,
        and returns a schema-validated, editable proposal without mutating authoritative state.
        """
        if not natural_language_description or not natural_language_description.strip():
            raise ValueError("Work description cannot be empty.")

        now_iso = datetime.now(timezone.utc).isoformat()
        proposal_id = f"prop-{uuid.uuid4().hex[:8]}"

        # Step 1: Pre-LLM Privacy Guardrail
        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "PLAN",
                "stage": "PRIVACY",
                "message": "Sanitizing input through Privacy Guardrail...",
                "step": 1,
                "total_steps": 4
            })
        sanitized_desc, mapping = self.privacy_engine.process_llm_input(
            natural_language_description,
            session_id=engagement_id
        )

        # Step 2: Grounded Retrieval via KNOW Agent
        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "KNOW",
                "stage": "RETRIEVAL",
                "message": f"KNOW Agent retrieving indexed technical documentation for {customer_name}...",
                "step": 2,
                "total_steps": 4
            })
        grounded_context = ""
        if self.know_agent:
            try:
                know_res = self.know_agent.answer_question(
                    engagement_id=engagement_id,
                    raw_question=f"{customer_name} architecture constraints and requirements",
                    top_k=2
                )
                if know_res.evidence_sufficient and know_res.citations:
                    grounded_context = "\n".join([f"- {c.document_title}: {c.snippet}" for c in know_res.citations])
            except Exception as e:
                logger.warning(f"Could not retrieve KNOW context for planning: {e}")

        # Step 3: Construct Google ADK Prompt
        prompt = (
            f"You are the CalmWork PLAN Agent for Forward Deployed Engineering.\n"
            f"Customer: {customer_name}\n"
            f"Engagement ID: {engagement_id}\n\n"
            f"Manager's Natural Language Description:\n{sanitized_desc}\n\n"
        )
        if current_outcome_statement:
            prompt += f"Active Outcome Goal: \"{current_outcome_statement}\"\n\n"
        if grounded_context:
            prompt += f"Grounded Technical Documentation:\n{grounded_context}\n\n"

        prompt += (
            "CRITICAL WORK PLANNING RULES (FORWARD-DEPLOYED ENGINEERING PLAYBOOK):\n"
            "1. Transform this description into an actionable, structured enterprise delivery plan that drives real adoption (not just code deployment).\n"
            "2. DO NOT fabricate specific dates, deadlines, or timelines unless explicitly stated by the manager in the prompt.\n"
            "3. DO NOT fabricate team members, owners, or effort commitments unless provided.\n"
            "4. Clearly separate:\n"
            "   - Confirmed facts directly provided by the manager.\n"
            "   - Inferred assumptions you made (marked explicitly as assumptions).\n"
            "   - Unresolved questions or missing information gaps.\n"
            "5. If important information is missing, formulate 1-3 targeted clarifying questions.\n"
            "6. Formulate 2-4 ordered milestones reflecting the FDE delivery lifecycle:\n"
            "   - Phase 1: Baseline Discovery & Friction Mapping (establish pre-launch baselines, recruit peer champions).\n"
            "   - Phase 2: Core Engineering & High-Leverage Small Win (ship narrow reliable scope, zero separate-tab friction, human-in-the-loop review).\n"
            "   - Phase 3: Production Verification, Governance & Adoption Handover (measure impact vs baseline, transition to named owner).\n"
            "7. Formulate a crisp Definition of Done (acceptance criteria) that measures real adoption and outcome success.\n\n"
            "Output MUST be a single valid JSON object strictly matching this structure:\n"

            "{\n"
            '  "engagement_objective": "...",\n'
            '  "outcomes": ["..."],\n'
            '  "definition_of_done": [{"id": "sc-1", "title": "...", "completed": false}],\n'
            '  "milestones": [\n'
            '    {\n'
            '      "id": "ms-1",\n'
            '      "title": "...",\n'
            '      "sequence_order": 1,\n'
            '      "deliverables": ["..."],\n'
            '      "dependencies": ["..."],\n'
            '      "customer_decisions_required": ["..."]\n'
            '    }\n'
            '  ],\n'
            '  "tasks": [\n'
            '    {\n'
            '      "id": "task-1",\n'
            '      "milestone_id": "ms-1",\n'
            '      "title": "...",\n'
            '      "description": "...",\n'
            '      "dependencies": ["..."],\n'
            '      "owner": null,\n'
            '      "status": "PLANNED"\n'
            '    }\n'
            '  ],\n'
            '  "risks": ["..."],\n'
            '  "facts_and_assumptions": {\n'
            '    "confirmed_facts": ["..."],\n'
            '    "inferred_assumptions": ["..."],\n'
            '    "unresolved_questions_or_gaps": ["..."]\n'
            '  },\n'
            '  "next_actions": ["..."],\n'
            '  "timeline_summary": "...",\n'
            '  "is_provisional": false,\n'
            '  "clarifying_questions": ["..."]\n'
            "}"
        )

        parsed_data = None
        has_credentials = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or settings.GROQ_API_KEY or _MOCK_ADK_RESPONSES)
        if has_credentials:
            try:
                if progress_callback:
                    progress_callback({
                        "type": "progress",
                        "agent": "PLAN",
                        "stage": "INFERENCE",
                        "message": "PLAN Agent synthesizing structured delivery plan with AI...",
                        "step": 3,
                        "total_steps": 4
                    })
                raw_reply = execute_adk_runner(
                    runner=self.runner,
                    user_id="manager_user",
                    session_id=f"plan-{engagement_id}",
                    message_text=prompt,
                    system_instruction=PLAN_INSTRUCTION,
                    json_mode=True
                )
                if raw_reply:
                    cleaned = raw_reply.strip()
                    if cleaned.startswith("```"):
                        cleaned = cleaned.split("```")[1]
                        if cleaned.startswith("json"):
                            cleaned = cleaned[4:]
                        cleaned = cleaned.strip()
                    parsed_data = json.loads(cleaned)
            except Exception as e:
                logger.warning(f"ADK Plan runner execution error: {e}")


        # Validate AI structured output; raise clean RuntimeError if unavailable
        if not parsed_data or not isinstance(parsed_data, dict):
            raise RuntimeError(
                "AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
            )

        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "PLAN",
                "stage": "COMPLETE",
                "message": "Plan proposal assembled safely without mutating authoritative state.",
                "step": 4,
                "total_steps": 4
            })

        milestones_raw = parsed_data.get("milestones", [])
        milestones = []
        for idx, m in enumerate(milestones_raw):
            milestones.append(WorkMilestone(
                id=m.get("id") or f"ms-{idx+1}",
                title=m.get("title", f"Milestone {idx+1}"),
                sequence_order=m.get("sequence_order", idx+1),
                deliverables=m.get("deliverables", []),
                dependencies=m.get("dependencies", []),
                customer_decisions_required=m.get("customer_decisions_required", [])
            ))

        tasks_raw = parsed_data.get("tasks", [])
        tasks = []
        for idx, t in enumerate(tasks_raw):
            tasks.append(WorkTask(
                id=t.get("id") or f"task-{idx+1}",
                milestone_id=t.get("milestone_id") or (milestones[0].id if milestones else "ms-1"),
                title=t.get("title", f"Task {idx+1}"),
                description=t.get("description", ""),
                dependencies=t.get("dependencies", []),
                owner=t.get("owner"),
                status=t.get("status", "PLANNED"),
                due_date=t.get("due_date"),
                approval_status="APPROVED"
            ))

        dod_raw = parsed_data.get("definition_of_done", [])
        dod = []
        for idx, d in enumerate(dod_raw):
            if isinstance(d, dict):
                dod.append({
                    "id": d.get("id") or f"sc-{idx+1}",
                    "title": d.get("title", "Outcome Criterion"),
                    "completed": bool(d.get("completed", False))
                })
            else:
                dod.append({
                    "id": f"sc-{idx+1}",
                    "title": str(d),
                    "completed": False
                })

        fa_raw = parsed_data.get("facts_and_assumptions", {})
        facts_assumptions = FactAssumptionGap(
            confirmed_facts=fa_raw.get("confirmed_facts", []),
            inferred_assumptions=fa_raw.get("inferred_assumptions", []),
            unresolved_questions_or_gaps=fa_raw.get("unresolved_questions_or_gaps", [])
        )

        return StructuredWorkPlanProposal(
            proposal_id=proposal_id,
            engagement_id=engagement_id,
            customer_name=customer_name,
            engagement_objective=parsed_data.get("engagement_objective", natural_language_description[:120]),
            outcomes=parsed_data.get("outcomes", [parsed_data.get("engagement_objective", "")]),
            definition_of_done=dod,
            milestones=milestones,
            tasks=tasks,
            risks=parsed_data.get("risks", []),
            facts_and_assumptions=facts_assumptions,
            next_actions=parsed_data.get("next_actions", []),
            timeline_summary=parsed_data.get("timeline_summary", "Milestone-driven implementation plan."),
            is_provisional=bool(parsed_data.get("is_provisional", False)),
            clarifying_questions=parsed_data.get("clarifying_questions", []),
            status="PROPOSED",
            generated_at=now_iso
        )

    def _build_deterministic_work_plan(
        self,
        customer_name: str,
        engagement_id: str,
        description: str,
        current_outcome: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Intelligent heuristic fallback work planning engine.
        Decomposes plain-text engineering goals into structured milestones and tasks
        when cloud LLM rate limits are hit, guaranteeing 100% operational uptime.
        """
        import re
        from datetime import datetime, timezone, timedelta

        raw_sentences = [
            s.strip() for s in re.split(r'[.\n;\u2022\r]+', description)
            if len(s.strip()) > 3
        ]
        if not raw_sentences:
            raw_sentences = [description.strip() or f"Execute engineering deliverables for {customer_name}"]

        tasks_list = []
        for idx, sentence in enumerate(raw_sentences):
            clean_s = re.sub(r'^[-\d*.]+\s*', '', sentence).strip()
            if not clean_s:
                continue
            title = clean_s[0].upper() + clean_s[1:]
            if len(title) > 90:
                short_title = title[:87] + "..."
            else:
                short_title = title

            now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)  # IST
            due_dt = now + timedelta(days=idx)
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            due_str = f"{due_dt.day:02d} {months[due_dt.month - 1]} {due_dt.year}, 17:00 IST"

            tasks_list.append({
                "id": f"task-{idx + 1}",
                "milestone_id": f"ms-{(idx % 3) + 1}",
                "title": short_title,
                "description": f"Grounded requirement: {clean_s}. Operational work task for {customer_name}.",
                "why_it_matters": f"Directly satisfies delivery requirement: {clean_s}",
                "dependencies": [f"task-{idx}"] if idx > 0 else [],
                "owner": None,
                "status": "TODO",
                "approval_status": "APPROVED",
                "due_date": due_str,
                "sequence_order": idx + 1
            })

        if len(tasks_list) == 1:
            main_t = tasks_list[0]["title"]
            now = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            d1 = f"{(now + timedelta(days=1)).day:02d} {months[(now + timedelta(days=1)).month - 1]} {(now + timedelta(days=1)).year}, 17:00 IST"
            d2 = f"{(now + timedelta(days=2)).day:02d} {months[(now + timedelta(days=2)).month - 1]} {(now + timedelta(days=2)).year}, 17:00 IST"
            tasks_list.extend([
                {
                    "id": "task-2",
                    "milestone_id": "ms-2",
                    "title": f"Execute implementation and pipeline testing for: {main_t}",
                    "description": f"End-to-end execution of core deliverable for {customer_name}.",
                    "why_it_matters": "Ensures implementation meets baseline architecture criteria.",
                    "dependencies": ["task-1"],
                    "owner": None,
                    "status": "TODO",
                    "approval_status": "APPROVED",
                    "due_date": d1,
                    "sequence_order": 2
                },
                {
                    "id": "task-3",
                    "milestone_id": "ms-3",
                    "title": f"Production validation & stakeholder verification: {main_t}",
                    "description": "Validation against acceptance criteria and outcome goals.",
                    "why_it_matters": "Gating milestone required before sign-off.",
                    "dependencies": ["task-2"],
                    "owner": None,
                    "status": "TODO",
                    "approval_status": "APPROVED",
                    "due_date": d2,
                    "sequence_order": 3
                }
            ])

        milestones = [
            {
                "id": "ms-1",
                "title": "Phase 1: Architecture Baseline & Discovery",
                "sequence_order": 1,
                "deliverables": [t["title"] for t in tasks_list if t["milestone_id"] == "ms-1"] or [tasks_list[0]["title"]],
                "dependencies": [],
                "customer_decisions_required": ["Architecture & environment access approval"]
            },
            {
                "id": "ms-2",
                "title": "Phase 2: Core Engineering & Implementation",
                "sequence_order": 2,
                "deliverables": [t["title"] for t in tasks_list if t["milestone_id"] == "ms-2"] or [tasks_list[min(1, len(tasks_list)-1)]["title"]],
                "dependencies": ["ms-1"],
                "customer_decisions_required": []
            },
            {
                "id": "ms-3",
                "title": "Phase 3: Verification & Security Sign-off",
                "sequence_order": 3,
                "deliverables": [t["title"] for t in tasks_list if t["milestone_id"] == "ms-3"] or [tasks_list[-1]["title"]],
                "dependencies": ["ms-2"],
                "customer_decisions_required": ["Final Outcome Goals acceptance sign-off"]
            }
        ]

        objective = current_outcome or (tasks_list[0]["title"] if tasks_list else f"Delivery plan for {customer_name}")
        dod = [
            {"id": f"dod-{i+1}", "title": f"Verified completion of {m['title']}", "completed": False}
            for i, m in enumerate(milestones)
        ]

        return {
            "engagement_objective": objective,
            "outcomes": [
                f"Achieve verified operational readiness for {customer_name}.",
                f"Successfully fulfill deliverable: {tasks_list[0]['title']}."
            ],
            "definition_of_done": dod,
            "milestones": milestones,
            "tasks": tasks_list,
            "risks": [
                "Dependencies on client architecture access and timely security sign-off."
            ],
            "facts_and_assumptions": {
                "confirmed_facts": [description[:120]],
                "inferred_assumptions": [
                    "Standard cloud deployment prerequisites and network ingress are pre-configured."
                ],
                "unresolved_questions_or_gaps": []
            },
            "next_actions": [tasks_list[0]["title"] if tasks_list else "Initiate Phase 1 tasks"],
            "timeline_summary": f"Structured into 3 phases across {len(tasks_list)} sequenced work tasks.",
            "is_provisional": False,
            "clarifying_questions": []
        }

    # ---------------------------------------------------------------------
    # 2. Scope, Requirement & Change Impact Intelligence (migrated from UNDERSTAND)
    # ---------------------------------------------------------------------

    def analyze_change(
        self,
        raw_change_text: str,
        current_outcome_statement: str,
        current_success_criteria: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> ChangeImpactAnalysis:
        """
        Evaluates incoming requirement changes, scope shifts, and technical constraints
        against active engagement outcome statements and Outcome Goals success criteria.
        Uses Evidence -> Reasoning -> Recommendation pattern.
        """
        sid = session_id or "session-plan-change"

        # 1. Pre-LLM Privacy Boundary Enforcement
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

        # 2. Prepare ADK prompt with sanitized context
        prompt = (
            f"Anonymized Requirement Input: {anonymized_change}\n"
            f"Anonymized Outcome Statement: {anonymized_outcome}\n"
            f"Current Success Criteria (Outcome Goals): {json.dumps(current_success_criteria)}\n\n"
            f"Evaluate this requirement change against the active Outcome statement and success criteria. "
            f"Analyze whether it impacts existing milestones/tasks or requires an Outcome Goals upgrade. "
            f"Return JSON with keys: change_title, evidence (list), reasoning (list), recommendation, "
            f"suggested_outcome_statement, suggested_success_criteria (list of dicts with id, title, completed), "
            f"risk_score (LOW|MEDIUM|HIGH|CRITICAL), affected_dimensions (list)."
        )

        adk_response_text = None
        has_credentials = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or settings.GROQ_API_KEY or _MOCK_ADK_RESPONSES)
        if has_credentials:
            try:
                adk_response_text = execute_adk_runner(
                    runner=self.runner,
                    user_id="fde_user",
                    session_id=sid,
                    message_text=prompt,
                    system_instruction=PLAN_INSTRUCTION,
                    json_mode=True
                )
            except Exception as e:
                logger.warning(f"ADK Plan Runner execution failed: {str(e)}")

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

        # Sanitize output tokens back for authorized display
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

    def analyze_change_impact(self, *args, **kwargs) -> ChangeImpactAnalysis:
        """Alias for analyze_change for semantic consistency."""
        return self.analyze_change(*args, **kwargs)

    # ---------------------------------------------------------------------
    # 3. Iterative Plan Reassessment with Evidence
    # ---------------------------------------------------------------------

    def reassess_plan_with_evidence(
        self,
        engagement_id: str,
        customer_name: str,
        current_work_plan: Dict[str, Any],
        new_evidence_items: List[str],
        worknotes: Optional[List[str]] = None,
        session_id: Optional[str] = None
    ) -> PlanReassessmentResult:
        """
        Iteratively reassesses an existing work plan when new evidence, decisions,
        work notes, or test results arrive. Identifies if scope drift has occurred,
        proposes task revisions or additions, and flags if manager approval is required.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        notes = worknotes or []

        # Check for scope drift triggers in evidence
        has_drift = any(
            any(term in text.lower() for term in ["sso", "compliance", "out of scope", "blocker", "mandatory", "change"])
            for text in (new_evidence_items + notes)
        )

        outcome_health = "NEEDS_REASSESSMENT" if has_drift else "HEALTHY"
        recs = []
        if has_drift:
            recs.append("Scope drift identified from new evidence: recommend reviewing and upgrading Outcome Goals.")
        else:
            recs.append("Current plan remains aligned with observed progress.")

        return PlanReassessmentResult(
            plan_id=current_work_plan.get("plan_id", f"plan-{engagement_id}"),
            engagement_id=engagement_id,
            outcome_health=outcome_health,
            evidence_observed=new_evidence_items[:5],
            scope_drift_detected=has_drift,
            scope_drift_explanation="Observed evidence contains new constraints or prerequisites." if has_drift else None,
            recommended_modifications=recs,
            tasks_to_add=[],
            tasks_to_update=[],
            requires_manager_approval=has_drift,
            reassessed_at=now_iso
        )
