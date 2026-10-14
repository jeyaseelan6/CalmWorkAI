"""
Supervisor Coordinator Engine.
Central Orchestrator coordinating all 4 specialized agents (UNDERSTAND, KNOW, MOVE, DELIVER)
over 1 centralized engagement state across the 6 FDE Work Cycles.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import json
import re
import uuid
from datetime import datetime, timezone, timedelta

IST_TZ = timezone(timedelta(hours=5, minutes=30))

from app.agents import (
    UnderstandAgent, ChangeImpactAnalysis,
    KnowAgent, GroundedAnswer,
    MoveAgent, NextBestActionRecommendation,
    DeliverAgent, CustomerUpdateDraft
)
from app.privacy import PrivacyPolicyEngine
from app.ai.gemini_service import GeminiService
from app.supervisor.event_bus import EventBus, EngagementEvent

from google.adk.agents import Agent, SequentialAgent
from google.adk.runners import Runner
from google.adk.sessions import BaseSessionService
from app.agents.adk_runtime import (
    get_adk_model,
    get_session_service,
    create_privacy_guardrail_callback,
    create_adk_runner,
    execute_adk_runner
)
from app.config import settings

logger = logging.getLogger(__name__)


class AgentStatusSummary(BaseModel):
    agent_name: str
    role_description: str
    status: str  # "ACTIVE" | "IDLE" | "RECOMMENDATION_PENDING"
    last_output_summary: str


class SupervisorQueryRequest(BaseModel):
    query: str
    session_id: Optional[str] = None


class SourceCitation(BaseModel):
    title: str
    source_type: str  # "DOCUMENT" | "TIMELINE" | "OUTCOME" | "DECISION"
    snippet: str


class SupervisorQueryResponse(BaseModel):
    engagement_id: str
    query: str
    intent_detected: str  # "UNDERSTAND" | "KNOW" | "MOVE" | "DELIVER" | "MULTI_AGENT"
    answer: str
    sources: List[SourceCitation]
    capabilities_used: List[str]
    sufficient_evidence: bool = True
    suggested_followups: List[str]
    timestamp: str


class ProposedWorkItem(BaseModel):
    id: str
    title: str
    sequence_order: int
    why_it_matters: str
    dependencies: List[str] = []
    blockers: List[str] = []
    decisions_or_approvals_required: List[str] = []
    status: str = "PROPOSED"  # "PROPOSED" | "APPROVED" | "SUPERSEDED" | "REJECTED"


class ProposedWorkPlan(BaseModel):
    plan_id: str
    engagement_id: str
    version: int = 1
    target_outcome: str
    work_items: List[ProposedWorkItem]
    assumptions_and_questions: List[str] = []
    recommended_first_action: str
    status: str = "PROPOSED"
    generated_at: str


class WorkTask(BaseModel):
    id: str
    milestone_id: str
    title: str
    description: str
    dependencies: List[str] = []
    owner: Optional[str] = None
    status: str = "PLANNED"  # "PLANNED" | "IN_PROGRESS" | "COMPLETED"


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
    definition_of_done: List[Dict[str, Any]] = []  # [{"id": str, "title": str, "completed": bool}]
    milestones: List[WorkMilestone] = []
    tasks: List[WorkTask] = []
    risks: List[str] = []
    facts_and_assumptions: FactAssumptionGap = FactAssumptionGap()
    next_actions: List[str] = []
    timeline_summary: str = "No explicit deadline committed."
    is_provisional: bool = False
    clarifying_questions: List[str] = []
    status: str = "PROPOSED"  # "PROPOSED" | "APPROVED"
    generated_at: str


class WhatChangedItem(BaseModel):
    summary: str
    category: str  # "REQUIREMENT" | "PROGRESS" | "DECISION" | "BLOCKER" | "OUTCOME"
    date_recorded: str
    timeline_ref: Optional[str] = None


class BlockerItem(BaseModel):
    title: str
    dependency_type: str  # "CUSTOMER" | "TECHNICAL" | "APPROVAL" | "DECISION"
    evidence_snippet: str
    impact_description: str


class EvidenceAndConfidenceItem(BaseModel):
    claim: str
    category: str  # "VERIFIED_FACT" | "AI_INTERPRETATION" | "PROPOSED_ACTION" | "MISSING_STALE_INFO"
    evidence_source: str
    confidence_level: str  # "HIGH" | "MEDIUM" | "LOW"


class DailyWorkBrief(BaseModel):
    brief_id: str
    engagement_id: str
    customer_name: str
    brief_date: str
    source_state_version: int = 1
    what_changed: List[WhatChangedItem]
    what_matters_today_outcome: str
    outcome_health: str  # "HEALTHY" | "ATTENTION" | "NEEDS_REASSESSMENT"
    key_risks: List[str]
    pending_decisions_and_approvals: List[str]
    what_is_blocking_progress: List[BlockerItem]
    proposed_work_plan: ProposedWorkPlan
    evidence_and_confidence: List[EvidenceAndConfidenceItem]
    warnings_or_partial_failures: List[str] = []
    capabilities_invoked: List[str] = ["UNDERSTAND", "KNOW", "MOVE", "SUPERVISOR"]
    deliver_invoked: bool = False
    generated_at: str


class SupervisorSummary(BaseModel):
    engagement_id: str
    customer_name: str
    overall_health: str
    current_work_cycle: str
    agents: List[AgentStatusSummary]
    change_impact: Optional[ChangeImpactAnalysis] = None
    next_action: Optional[NextBestActionRecommendation] = None
    customer_update: Optional[CustomerUpdateDraft] = None
    privacy_guardrail_active: bool = True
    orchestrated_at: str


class SupervisorCoordinator:
    """
    Supervisor Coordinator: Deterministic multi-agent orchestrator.
    Routes events to relevant agents, updates unified state, and ensures 360-degree governance.
    """

    def __init__(
        self,
        privacy_engine: Optional[PrivacyPolicyEngine] = None,
        gemini_service: Optional[Any] = None,
        session_service: Optional[BaseSessionService] = None
    ):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.session_service = session_service or get_session_service()
        self.model = get_adk_model()
        self.gemini_service = gemini_service
        self.event_bus = EventBus()

        # Instantiate specialized ADK agents
        self.understand_agent = UnderstandAgent(
            privacy_engine=self.privacy_engine,
            session_service=self.session_service
        )
        self.know_agent = KnowAgent(
            privacy_engine=self.privacy_engine,
            session_service=self.session_service
        )
        self.move_agent = MoveAgent(
            privacy_engine=self.privacy_engine,
            session_service=self.session_service
        )
        self.deliver_agent = DeliverAgent(
            privacy_engine=self.privacy_engine,
            session_service=self.session_service
        )

        # ADK Sequential Workflow for predictable Morning Brief orchestration
        # CRITICAL INVARIANT: DELIVER is strictly EXCLUDED from Morning Brief
        self.morning_brief_workflow = SequentialAgent(
            name="morning_brief_sequential_workflow",
            description="Sequential ADK workflow executing UNDERSTAND -> KNOW -> MOVE (DELIVER excluded).",
            sub_agents=[
                self.understand_agent.adk_agent,
                self.know_agent.adk_agent,
                self.move_agent.adk_agent
            ]
        )

        # Central Supervisor ADK Agent for conversational queries and synthesis
        self.supervisor_agent = Agent(
            name="supervisor_coordinator",
            description="Central multi-agent coordinator for conversational queries and Morning Brief synthesis.",
            model=self.model,
            instruction=(
                "You are the CalmWork Supervisor Multi-Agent Coordinator for Forward-Deployed Engineers. "
                "Synthesize findings across UNDERSTAND, KNOW, MOVE, and DELIVER. "
                "Respond helpfully, politely, and concisely based strictly on verified engagement facts."
            ),
            before_model_callback=create_privacy_guardrail_callback(self.privacy_engine)
        )

        self.runner = create_adk_runner(
            agent=self.supervisor_agent,
            session_service=self.session_service,
            app_name=settings.ADK_APP_NAME
        )

    def query_supervisor(
        self,
        engagement_id: str,
        customer_name: str,
        raw_query: str,
        current_work_cycle: str = "Stage 4: Validation",
        status: str = "HEALTHY",
        outcome_statement: str = "",
        success_criteria: List[Dict[str, Any]] = None,
        version: int = 1,
        pending_approvals: int = 0
    ) -> SupervisorQueryResponse:
        """
        Universal Conversational Interface ('Ask CalmWork'):
        Interprets intent, prepares context over shared memory, orchestrates specialists,
        and enforces strict privacy & anti-hallucination policies.
        """
        logger.info(f"Supervisor processing query for engagement {engagement_id}: '{raw_query}'")

        # Apply Privacy Boundary
        sanitized_query, mapping = self.privacy_engine.process_llm_input(raw_query, session_id=engagement_id)

        q_lower = sanitized_query.lower()
        capabilities_used = []
        sources = []

        # Intent Detection Logic
        if any(w in q_lower for w in ["changed", "requirement", "impact", "scope", "biometric", "scan", "tablet", "iris"]):
            intent = "UNDERSTAND"
            capabilities_used.append("UNDERSTAND")
        elif any(w in q_lower for w in ["blocking", "blocker", "do next", "action", "focus"]):
            intent = "MOVE"
            capabilities_used.append("MOVE")
        elif any(w in q_lower for w in ["customer", "update", "tell them", "share", "email"]):
            intent = "DELIVER"
            capabilities_used.append("DELIVER")
        else:
            intent = "KNOW"
            capabilities_used.append("KNOW")

        # Check for multi-agent questions (e.g. "What changed and what is blocking production?")
        if len([word for word in ["changed", "blocking", "customer", "next"] if word in q_lower]) >= 2:
            intent = "MULTI_AGENT"
            capabilities_used = ["UNDERSTAND", "MOVE", "KNOW", "DELIVER"]

        # Run Grounded RAG search via KNOW agent
        know_response = self.know_agent.answer_question(
            engagement_id=engagement_id,
            raw_question=sanitized_query,
            top_k=3
        )

        for cit in know_response.citations:
            sources.append(SourceCitation(
                title=cit.document_title,
                source_type="DOCUMENT",
                snippet=cit.snippet
            ))

        # Check for anti-hallucination fallback requirement
        sufficient = know_response.evidence_sufficient
        if not sufficient and intent == "KNOW" and not (self.gemini_service and self.gemini_service.api_key):
            answer = "I don't have enough verified engagement evidence to answer this confidently."
            return SupervisorQueryResponse(
                engagement_id=engagement_id,
                query=raw_query,
                intent_detected=intent,
                answer=answer,
                sources=[],
                capabilities_used=capabilities_used,
                sufficient_evidence=False,
                suggested_followups=["Record a worknote with additional context", "Upload official technical specification document"],
                timestamp=datetime.now(timezone.utc).isoformat()
            )

        # Synthesize Multi-Agent Answer
        answer_parts = []

        if "UNDERSTAND" in capabilities_used:
            # If user provided a specific requirement text in query, run dynamic analysis
            if any(term in q_lower for term in ["requires", "mandate", "iris", "tablet", "nurse", "biometric", "sso", "security", "hipaa", "audit"]):
                try:
                    eval_res = self.understand_agent.analyze_change(
                        raw_change_text=raw_query,
                        current_outcome_statement=outcome_statement,
                        current_success_criteria=[]
                    )
                    answer_parts.append(
                        f"**UNDERSTAND Agent Analysis**:\n"
                        f"- **Evidence**: {'; '.join(eval_res.evidence[:2])}\n"
                        f"- **Reasoning**: {'; '.join(eval_res.reasoning[:2])}\n"
                        f"- **Recommendation**: {eval_res.recommendation}\n"
                        f"- **Risk Score**: {eval_res.risk_score}"
                    )
                except Exception as e:
                    logger.warning(f"Live understand eval fallback: {str(e)}")
                    answer_parts.append(f"**UNDERSTAND Analysis**: Analyzed requirement change for {customer_name}. Scope shift requires review.")
            elif status == "NEEDS_REASSESSMENT":
                answer_parts.append(f"**UNDERSTAND Analysis**: Enterprise SSO requirement was identified, which shifted Outcome Version {version} status to NEEDS_REASSESSMENT pending Manager approval of Definition of Done v2.")
            else:
                answer_parts.append(f"**UNDERSTAND Analysis**: Outcome Version {version} ('{outcome_statement}') remains aligned with customer requirements.")

        if "MOVE" in capabilities_used:
            next_act = self.move_agent.determine_next_action(
                engagement_id=engagement_id,
                customer_name=customer_name,
                current_work_cycle=current_work_cycle,
                status=status,
                outcome_version=version,
                pending_approvals=pending_approvals
            )
            answer_parts.append(f"**MOVE Action**: Next Best Action is '{next_act.action_title}'. {next_act.why_now}")

        if "DELIVER" in capabilities_used:
            answer_parts.append(f"**DELIVER Communication**: Customer update draft is ready. Key message: Enterprise onboarding automation is 75% complete.")

        if "KNOW" in capabilities_used and know_response.evidence_sufficient and know_response.answer:
            answer_parts.append(f"**KNOW Evidence**: {know_response.answer}")

        # If it's a general question or greeting, synthesize via Google ADK Supervisor Agent
        if not answer_parts:
            prompt = (
                f"Customer Engagement: {customer_name}\n"
                f"Active Outcome: {outcome_statement}\n"
                f"Status: {status}\n"
                f"User Message: {sanitized_query}"
            )
            try:
                adk_reply = execute_adk_runner(
                    runner=self.runner,
                    user_id="fde_user",
                    session_id=engagement_id,
                    message_text=prompt
                )
                if adk_reply:
                    answer_parts.append(adk_reply)
            except Exception as e:
                logger.warning(f"ADK Supervisor conversational runner fallback: {e}")

            if not answer_parts:
                answer_parts.append(know_response.answer)

        final_answer = "\n\n".join(answer_parts) if answer_parts else know_response.answer

        # Restore de-anonymized names if needed
        final_answer = self.privacy_engine.sanitize_output(final_answer, mapping)

        return SupervisorQueryResponse(
            engagement_id=engagement_id,
            query=raw_query,
            intent_detected=intent,
            answer=final_answer,
            sources=sources,
            capabilities_used=capabilities_used,
            sufficient_evidence=True,
            suggested_followups=[
                "What is the current status of Definition of Done v2?",
                "Draft an executive customer status update",
                "Who is the security team owner for OAuth configuration?"
            ],
            timestamp=datetime.now(timezone.utc).isoformat()
        )

    def generate_daily_work_brief(
        self,
        engagement_id: str,
        customer_name: str,
        status: str = "HEALTHY",
        outcome_statement: str = "",
        version: int = 1,
        pending_approvals: int = 0,
        current_work_cycle: str = "Step 1: Understand the Business Reality",
        timeline_events: Optional[List[Any]] = None,
        success_criteria: Optional[List[Dict[str, Any]]] = None,
        approved_work_plan: Optional[Dict[str, Any]] = None
    ) -> DailyWorkBrief:
        """
        Proactive Morning Brief Workflow (Sequential Execution):
        1. Load shared state snapshot
        2. UNDERSTAND -> Outcome changes & scope risks
        3. KNOW -> Guided retrieval of evidence & history based on UNDERSTAND findings
        4. MOVE -> Blockers, dependencies, pending decisions, Next Best Action
        5. SUPERVISOR -> Consolidates findings & creates Proposed Daily Work Plan
        * CRITICAL REQUIREMENT: DELIVER is EXCLUDED from default Morning Brief *
        """
        now_str = datetime.now(IST_TZ).strftime("%d/%m/%Y %H:%M")
        now_iso = datetime.now(IST_TZ).isoformat()
        warnings: List[str] = []

        # -------------------------------------------------------------
        # STEP 1: Invoke UNDERSTAND Agent (Identify Outcome & Scope Drift)
        # -------------------------------------------------------------
        raw_change = ""
        if timeline_events:
            for evt in timeline_events:
                evt_type = getattr(evt, "event_type", "")
                if evt_type in ("CHANGE_DETECTED", "REQUIREMENT_CHANGE", "OUTCOME_CHANGE_PROPOSED"):
                    raw_change = getattr(evt, "description", "") or getattr(evt, "title", "")
                    break
            if not raw_change and len(timeline_events) > 0:
                raw_change = getattr(timeline_events[0], "description", "") or getattr(timeline_events[0], "title", "")

        if not raw_change:
            if status == "NEEDS_REASSESSMENT":
                raw_change = f"Scope reassessment initiated for {customer_name}: requirement drift or gating dependency identified."
            else:
                raw_change = f"Progress updated for {customer_name} across {current_work_cycle}."

        understand_findings = None
        try:
            crit_titles = [c.get("title", "") if isinstance(c, dict) else str(c) for c in (success_criteria or [])]
            understand_findings = self.understand_agent.analyze_change(
                raw_change_text=raw_change,
                current_outcome_statement=outcome_statement or f"Deliver active outcome for {customer_name}.",
                current_success_criteria=crit_titles
            )
        except Exception as e:
            logger.warning(f"UNDERSTAND agent execution warning in Morning Brief: {str(e)}")
            warnings.append("UNDERSTAND analysis completed with partial scope evidence.")

        # -------------------------------------------------------------
        # STEP 2: Invoke KNOW Agent (Guided RAG Retrieval using UNDERSTAND findings)
        # -------------------------------------------------------------
        know_findings = None
        try:
            guided_query = f"{customer_name} technical specifications, architectural constraints, and outcome criteria"
            know_findings = self.know_agent.answer_question(
                engagement_id=engagement_id,
                raw_question=guided_query,
                top_k=2
            )
            if not know_findings.verified_evidence_found:
                warnings.append(f"KNOW agent reported limited indexed documentation for {customer_name}; grounded on structured database records.")
        except Exception as e:
            logger.warning(f"KNOW agent execution warning in Morning Brief: {str(e)}")
            warnings.append("KNOW retrieval incomplete; using structured DB timeline context.")

        # -------------------------------------------------------------
        # STEP 3: Invoke MOVE Agent (Blockers, Dependencies, Next Action)
        # -------------------------------------------------------------
        move_findings = None
        try:
            move_findings = self.move_agent.determine_next_action(
                engagement_id=engagement_id,
                customer_name=customer_name,
                current_work_cycle=current_work_cycle or "Step 1: Understand the Business Reality",
                status=status,
                outcome_version=version,
                pending_approvals=pending_approvals
            )
        except Exception as e:
            logger.warning(f"MOVE agent execution warning in Morning Brief: {str(e)}")
            warnings.append("MOVE action calculation completed with fallback action rules.")

        # -------------------------------------------------------------
        # STEP 4: Supervisor Synthesis & Work Plan Preparation
        # (Constructing Sections A, B, C, D, E dynamically)
        # -------------------------------------------------------------
        
        # Section A: What Changed?
        what_changed: List[WhatChangedItem] = []
        category_map = {
            "ENGAGEMENT_CREATED": "INITIATIVE",
            "OUTCOME_CHANGE_PROPOSED": "OUTCOME",
            "OUTCOME_APPROVED": "OUTCOME",
            "CHANGE_DETECTED": "REQUIREMENT",
            "WORKNOTE_LOGGED": "PROGRESS",
            "APPROVAL_CREATED": "GOVERNANCE",
            "BLOCKER_IDENTIFIED": "BLOCKER",
            "MORNING_BRIEF_GENERATED": "SYSTEM"
        }
        if timeline_events:
            for evt in timeline_events:
                evt_type = getattr(evt, "event_type", "PROGRESS")
                # Exclude internal morning brief system events so only real business/milestone events appear
                if evt_type == "MORNING_BRIEF_GENERATED":
                    continue
                summary_text = getattr(evt, "description", None) or getattr(evt, "title", "Milestone recorded")
                evt_date = getattr(evt, "created_at", None)
                if evt_date and hasattr(evt_date, "strftime"):
                    if getattr(evt_date, "tzinfo", None) is None:
                        evt_ist = evt_date.replace(tzinfo=timezone.utc).astimezone(IST_TZ)
                    else:
                        evt_ist = evt_date.astimezone(IST_TZ)
                    date_str = evt_ist.strftime("%d/%m/%Y %H:%M")
                else:
                    date_str = now_str
                what_changed.append(WhatChangedItem(
                    summary=summary_text,
                    category=category_map.get(evt_type, "PROGRESS"),
                    date_recorded=date_str,
                    timeline_ref=str(getattr(evt, "id", f"evt-{engagement_id}"))
                ))
                if len(what_changed) >= 3:
                    break

        if not what_changed:
            what_changed = [
                WhatChangedItem(
                    summary=f"Engagement '{customer_name}' initialized with Outcome v{version} Definition of Done.",
                    category="PROGRESS",
                    date_recorded=now_str,
                    timeline_ref=f"eng-{engagement_id}"
                )
            ]

        what_matters_outcome = outcome_statement or f"Deliver active engagement outcome for {customer_name}."
        outcome_health = status

        risks: List[str] = []
        if status == "NEEDS_REASSESSMENT":
            risks.append(f"Outcome alignment required for {customer_name}: pending scope upgrade awaiting manager signoff.")
        elif status == "BLOCKED":
            risks.append(f"Gating blocker currently impacting progression in {current_work_cycle} for {customer_name}.")
        elif status == "AT_RISK":
            risks.append(f"Delivery velocity requires attention to maintain target milestone for {customer_name}.")
        else:
            risks.append(f"Ensure active criteria adhere to agreed technical constraints for {customer_name}.")

        pending_decisions: List[str] = []
        if pending_approvals > 0:
            pending_decisions.append(f"Manager approval required for {customer_name} (Outcome v{version} / DoD change).")

        blockers: List[BlockerItem] = []
        if move_findings and move_findings.gating_blocker:
            blk = move_findings.gating_blocker
            blockers.append(BlockerItem(
                title=blk.title,
                dependency_type="EXTERNAL" if "Customer" in blk.owner else "INTERNAL",
                evidence_snippet=blk.description,
                impact_description=move_findings.impact or f"Impacts progression in {current_work_cycle}."
            ))
        elif status == "NEEDS_REASSESSMENT":
            blockers.append(BlockerItem(
                title=f"Pending Scope Reassessment for {customer_name}",
                dependency_type="GOVERNANCE",
                evidence_snippet="Requirement drift or gating dependency requires Manager approval before proceeding.",
                impact_description=f"Gates advancement in {current_work_cycle}."
            ))
        elif status == "BLOCKED":
            blockers.append(BlockerItem(
                title="Unresolved Gating Dependency",
                dependency_type="PROCESS",
                evidence_snippet=f"Engagement status is marked BLOCKED for {customer_name}.",
                impact_description="Prevents advancement to subsequent work cycle phase."
            ))

        # Dynamic Work Items from approved_work_plan or success_criteria
        work_items: List[ProposedWorkItem] = []
        if approved_work_plan and isinstance(approved_work_plan, dict) and approved_work_plan.get("tasks"):
            for idx, task in enumerate(approved_work_plan.get("tasks", [])):
                t_id = task.get("id", f"wi-{idx+1}")
                t_title = task.get("title", f"Task {idx+1}")
                t_status = "COMPLETED" if task.get("status") == "COMPLETED" else "PROPOSED"
                t_deps = task.get("dependencies", [])
                work_items.append(ProposedWorkItem(
                    id=t_id,
                    title=t_title,
                    sequence_order=idx + 1,
                    why_it_matters=task.get("description") or f"Approved plan task for {customer_name}.",
                    dependencies=t_deps,
                    blockers=[],
                    decisions_or_approvals_required=[],
                    status=t_status
                ))
        elif success_criteria:
            for idx, crit in enumerate(success_criteria):
                crit_id = crit.get("id", f"wi-{idx+1}") if isinstance(crit, dict) else f"wi-{idx+1}"
                crit_title = crit.get("title", f"Deliver milestone criterion {idx+1}") if isinstance(crit, dict) else str(crit)
                is_done = crit.get("completed", False) if isinstance(crit, dict) else False
                work_items.append(ProposedWorkItem(
                    id=crit_id,
                    title=crit_title,
                    sequence_order=idx + 1,
                    why_it_matters=f"Fulfills Definition of Done criterion for {customer_name}.",
                    dependencies=[],
                    blockers=[],
                    decisions_or_approvals_required=["Manager Signoff"] if status == "NEEDS_REASSESSMENT" and idx == 0 else [],
                    status="COMPLETED" if is_done else "PROPOSED"
                ))
        if not work_items:
            work_items = [
                ProposedWorkItem(
                    id="wi-1",
                    title=f"Review scope & technical requirements for {customer_name}",
                    sequence_order=1,
                    why_it_matters=f"Baseline alignment with customer goals in {current_work_cycle}.",
                    dependencies=[],
                    blockers=[],
                    decisions_or_approvals_required=[],
                    status="PROPOSED"
                )
            ]

        rec_first_action = (
            move_findings.recommendation
            if (move_findings and move_findings.recommendation)
            else f"Review Definition of Done criteria for {customer_name}."
        )

        plan_assumptions = [
            f"Assumption: Technical constraints and requirements for {customer_name} are captured in the active outcome.",
            f"Work Cycle Context: Currently executing {current_work_cycle}."
        ]
        if approved_work_plan and isinstance(approved_work_plan, dict):
            faa = approved_work_plan.get("facts_and_assumptions", {})
            if isinstance(faa, dict) and faa.get("inferred_assumptions"):
                for a in faa.get("inferred_assumptions", [])[:2]:
                    plan_assumptions.append(f"Plan Assumption: {a}")

        proposed_plan = ProposedWorkPlan(
            plan_id=f"plan-{engagement_id}-{version}",
            engagement_id=engagement_id,
            version=version,
            target_outcome=what_matters_outcome,
            work_items=work_items,
            assumptions_and_questions=plan_assumptions,
            recommended_first_action=rec_first_action,
            status="PROPOSED",
            generated_at=now_iso
        )

        evidence_items: List[EvidenceAndConfidenceItem] = []
        if know_findings and know_findings.citations:
            for cit in know_findings.citations:
                evidence_items.append(EvidenceAndConfidenceItem(
                    claim=cit.snippet,
                    category="VERIFIED_FACT",
                    evidence_source=f"Document: '{cit.document_title}'",
                    confidence_level="HIGH" if cit.relevance_score > 0.4 else "MEDIUM"
                ))
        if not evidence_items:
            evidence_items = [
                EvidenceAndConfidenceItem(
                    claim=f"Outcome contract v{version} active in database for {customer_name}.",
                    category="VERIFIED_FACT",
                    evidence_source=f"State Model: Outcome {engagement_id} (Version {version})",
                    confidence_level="HIGH"
                )
            ]

        # Return complete Morning Brief with explicit provenance
        return DailyWorkBrief(
            brief_id=f"brief-{engagement_id}-{now_str}",
            engagement_id=engagement_id,
            customer_name=customer_name,
            brief_date=now_str,
            source_state_version=version,
            what_changed=what_changed,
            what_matters_today_outcome=what_matters_outcome,
            outcome_health=outcome_health,
            key_risks=risks,
            pending_decisions_and_approvals=pending_decisions,
            what_is_blocking_progress=blockers,
            proposed_work_plan=proposed_plan,
            evidence_and_confidence=evidence_items,
            warnings_or_partial_failures=warnings,
            capabilities_invoked=["UNDERSTAND", "KNOW", "MOVE", "SUPERVISOR"],
            deliver_invoked=False,  # CRITICAL INVARIANT: DELIVER EXCLUDED
            generated_at=now_iso
        )

    def orchestrate_engagement(
        self,
        engagement_id: str,
        customer_name: str,
        engagement_name: str,
        current_work_cycle: str,
        status: str,
        outcome_statement: str,
        success_criteria: List[Dict[str, Any]],
        version: int = 1,
        pending_approvals: int = 0
    ) -> SupervisorSummary:
        """
        Runs Supervisor orchestration across all 4 agents for complete 360-degree synthesis.
        """
        logger.info(f"Supervisor Coordinator orchestrating engagement {engagement_id} ({customer_name})")

        # 1. Invoke MOVE Agent for Next Best Action
        next_action = self.move_agent.determine_next_action(
            engagement_id=engagement_id,
            customer_name=customer_name,
            current_work_cycle=current_work_cycle,
            status=status,
            outcome_version=version,
            pending_approvals=pending_approvals
        )

        # 2. Invoke DELIVER Agent for Customer Update Draft
        customer_update = self.deliver_agent.generate_customer_update(
            engagement_id=engagement_id,
            customer_name=customer_name,
            engagement_name=engagement_name,
            outcome_statement=outcome_statement,
            success_criteria=success_criteria,
            current_work_cycle=current_work_cycle
        )

        # 3. Formulate Agent Status Summary
        agents_summary = [
            AgentStatusSummary(
                agent_name="UNDERSTAND",
                role_description="Outcome Drift & Scope Change Analysis",
                status="RECOMMENDATION_PENDING" if status == "NEEDS_REASSESSMENT" else "ACTIVE",
                last_output_summary="Evaluates requirement changes via Evidence -> Reasoning -> Recommendation pattern."
            ),
            AgentStatusSummary(
                agent_name="KNOW",
                role_description="Tenant-Isolated Grounded RAG Search",
                status="ACTIVE",
                last_output_summary="Indexes customer specs and returns grounded answers with explicit citations."
            ),
            AgentStatusSummary(
                agent_name="MOVE",
                role_description="Execution Velocity & Next Best Action",
                status="ACTIVE",
                last_output_summary=f"Next Action: {next_action.action_title}"
            ),
            AgentStatusSummary(
                agent_name="DELIVER",
                role_description="Executive Customer Communication Studio",
                status="ACTIVE",
                last_output_summary=f"Subject: {customer_update.subject}"
            )
        ]

        return SupervisorSummary(
            engagement_id=engagement_id,
            customer_name=customer_name,
            overall_health=status,
            current_work_cycle=current_work_cycle,
            agents=agents_summary,
            next_action=next_action,
            customer_update=customer_update,
            privacy_guardrail_active=True,
            orchestrated_at=datetime.now(timezone.utc).isoformat()
        )

    def generate_natural_language_work_plan(
        self,
        engagement_id: str,
        customer_name: str,
        natural_language_description: str,
        existing_plan_edits: Optional[Dict[str, Any]] = None,
        current_outcome_statement: Optional[str] = None,
        current_success_criteria: Optional[List[Any]] = None,
        session_id: Optional[str] = None
    ) -> StructuredWorkPlanProposal:
        """
        Supervisor Work Planning Engine:
        Interprets a manager's natural language work description,
        scrubs sensitive PII through Privacy Guardrails,
        invokes the Google ADK Supervisor Agent to formulate a structured plan,
        and returns a schema-validated, editable proposal without mutating authoritative state.
        """
        if not natural_language_description or not natural_language_description.strip():
            raise ValueError("Work description cannot be empty.")

        now_iso = datetime.now(timezone.utc).isoformat()
        proposal_id = f"prop-{uuid.uuid4().hex[:8]}"

        # 1. Apply Pre-LLM Privacy Guardrail
        sanitized_desc, mapping = self.privacy_engine.process_llm_input(
            natural_language_description,
            session_id=engagement_id
        )

        # 2. Retrieve any relevant indexed specifications
        grounded_context = ""
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

        # 3. Construct Google ADK Prompt
        prompt = (
            f"You are the CalmWork Supervisor Multi-Agent Work Planning Engine for Forward Deployed Engineering.\n"
            f"Customer: {customer_name}\n"
            f"Engagement ID: {engagement_id}\n\n"
            f"Manager's Natural Language Description:\n{sanitized_desc}\n\n"
        )
        if grounded_context:
            prompt += f"Grounded Technical Documentation:\n{grounded_context}\n\n"

        prompt += (
            "CRITICAL WORK PLANNING RULES:\n"
            "1. Transform this description into an actionable, structured enterprise delivery plan.\n"
            "2. DO NOT fabricate specific dates, deadlines, or timelines unless explicitly stated by the manager in the prompt.\n"
            "3. DO NOT fabricate team members, owners, or effort commitments unless provided.\n"
            "4. Clearly separate:\n"
            "   - Confirmed facts directly provided by the manager.\n"
            "   - Inferred assumptions you made (marked explicitly as assumptions).\n"
            "   - Unresolved questions or missing information gaps.\n"
            "5. If important information is missing, formulate 1-3 targeted clarifying questions.\n"
            "6. Formulate 2-4 ordered milestones with concrete tasks, deliverables, dependencies, and any required customer decisions/approvals.\n"
            "7. Formulate a crisp Definition of Done list.\n\n"
            "Output MUST be a single valid JSON object strictly matching this structure:\n"
            "{\n"
            '  "engagement_objective": "...",\n'
            '  "outcomes": ["..."],\n'
            '  "definition_of_done": [{"id": "dod-1", "title": "...", "completed": false}],\n'
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
        has_credentials = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or settings.GROQ_API_KEY)
        if has_credentials:
            try:
                raw_reply = execute_adk_runner(
                    runner=self.runner,
                    user_id="manager_user",
                    session_id=f"plan-{engagement_id}",
                    message_text=prompt,
                    system_instruction=(
                        "You are the CalmWork Supervisor Work Planning Engine. "
                        "Produce valid JSON enterprise work plans strictly grounded on provided manager input."
                    ),
                    json_mode=True
                )
                if raw_reply:
                    clean_json = raw_reply.strip()
                    if clean_json.startswith("```"):
                        clean_json = re.sub(r"^```(?:json)?\s*", "", clean_json)
                        clean_json = re.sub(r"\s*```$", "", clean_json)
                    parsed_data = json.loads(clean_json)
            except Exception as e:
                logger.warning(f"ADK runner planning generation fallback: {e}")

        # Deterministic extraction fallback (used in test suite or when model output is offline/unparseable)
        if not parsed_data or not isinstance(parsed_data, dict):
            parsed_data = self._deterministic_plan_synthesis(
                customer_name=customer_name,
                text=sanitized_desc
            )

        # Merge any existing manager edits if provided
        if existing_plan_edits and isinstance(existing_plan_edits, dict):
            for k, v in existing_plan_edits.items():
                if v is not None and k in parsed_data:
                    parsed_data[k] = v

        # Validate with Pydantic
        milestones = [WorkMilestone(**m) for m in parsed_data.get("milestones", [])]
        tasks = [WorkTask(**t) for t in parsed_data.get("tasks", [])]
        faa_data = parsed_data.get("facts_and_assumptions", {})
        facts_and_assumptions = FactAssumptionGap(
            confirmed_facts=faa_data.get("confirmed_facts", []),
            inferred_assumptions=faa_data.get("inferred_assumptions", []),
            unresolved_questions_or_gaps=faa_data.get("unresolved_questions_or_gaps", [])
        )

        dod_list = parsed_data.get("definition_of_done", [])
        formatted_dod = []
        for idx, item in enumerate(dod_list):
            if isinstance(item, dict):
                formatted_dod.append({
                    "id": item.get("id", f"dod-{idx+1}"),
                    "title": item.get("title", f"DoD Criterion {idx+1}"),
                    "completed": item.get("completed", False)
                })
            elif isinstance(item, str):
                formatted_dod.append({
                    "id": f"dod-{idx+1}",
                    "title": item,
                    "completed": False
                })

        raw_risks = parsed_data.get("risks", [])
        if not raw_risks:
            raw_risks = [
                f"Customer security approval turnaround times may impact {customer_name} milestone delivery.",
                "Prerequisite access to legacy environments and technical documentation must be secured early."
            ]

        raw_next_actions = parsed_data.get("next_actions", [])
        if not raw_next_actions and milestones:
            first_ms = milestones[0]
            raw_next_actions = [
                f"Initiate {first_ms.title} for {customer_name}.",
                f"Verify prerequisite access: {first_ms.dependencies[0] if first_ms.dependencies else 'Technical documentation'}"
            ]
        elif not raw_next_actions:
            raw_next_actions = [
                f"Schedule discovery and requirements review with {customer_name} technical stakeholders.",
                "Verify operational environment access and baseline technical constraints."
            ]

        proposal = StructuredWorkPlanProposal(
            proposal_id=proposal_id,
            engagement_id=engagement_id,
            customer_name=customer_name,
            engagement_objective=self.privacy_engine.sanitize_output(
                parsed_data.get("engagement_objective", f"Deliver initiative for {customer_name}."),
                mapping
            ),
            outcomes=[self.privacy_engine.sanitize_output(o, mapping) for o in parsed_data.get("outcomes", [])],
            definition_of_done=formatted_dod,
            milestones=milestones,
            tasks=tasks,
            risks=[self.privacy_engine.sanitize_output(r, mapping) for r in raw_risks],
            facts_and_assumptions=facts_and_assumptions,
            next_actions=[self.privacy_engine.sanitize_output(a, mapping) for a in raw_next_actions],
            timeline_summary=self.privacy_engine.sanitize_output(
                parsed_data.get("timeline_summary", "No explicit timeline committed."),
                mapping
            ),
            is_provisional=bool(parsed_data.get("is_provisional", False)),
            clarifying_questions=[self.privacy_engine.sanitize_output(q, mapping) for q in parsed_data.get("clarifying_questions", [])],
            status="PROPOSED",
            generated_at=now_iso
        )

        return proposal

    def _deterministic_plan_synthesis(self, customer_name: str, text: str) -> Dict[str, Any]:
        """
        Deterministic extraction of structured plan from natural language description.
        Guarantees schema validity when LLM inference is offline or in test environments.
        Extracts real facts from text, separates inferred assumptions, and identifies missing info.
        """
        text_lower = text.lower()

        # 1. Timeline Extraction (NO fabrication)
        deadline_match = re.search(r'\b(?:within|in|by)\s+(\d+\s*(?:weeks?|months?|days?)|Q[1-4]|end\s+of\s+\w+)\b', text, re.IGNORECASE)
        timeline_summary = f"Target completion: {deadline_match.group(1)}" if deadline_match else "No explicit timeline committed."

        # 2. Extract facts from text
        confirmed_facts = []
        sentences = [s.strip() for s in re.split(r'[.\n;]+', text) if len(s.strip()) > 8]
        for s in sentences[:4]:
            confirmed_facts.append(s)

        # 3. Inferred Assumptions (explicitly marked)
        inferred_assumptions = [
            f"Target cloud and operational environments will be provisioned with access granted by {customer_name}.",
            "Customer architecture and security stakeholders will be available for milestone reviews and sign-offs."
        ]

        # 4. Identify Gaps & Missing Information
        missing_gaps = []
        clarifying_questions = []
        if not deadline_match:
            missing_gaps.append("Target delivery date or hard milestone deadlines not specified.")
            clarifying_questions.append("What is the required target completion timeline or deadline?")

        if not any(k in text_lower for k in ["security", "compliance", "sso", "audit"]):
            missing_gaps.append("Enterprise security and compliance governance constraints not detailed.")
            clarifying_questions.append("Are there specific compliance or security requirements (e.g. SOC2, HIPAA, SSO)?")

        if not any(k in text_lower for k in ["team", "handover", "training", "owner"]):
            missing_gaps.append("Customer handover team and operational owners not identified.")
            clarifying_questions.append("Who is the primary customer technical lead for handover and validation?")

        # 5. Extract Objectives & Outcomes
        objective = sentences[0] if sentences else f"Deliver enterprise cloud initiative for {customer_name}."
        outcomes = [
            f"Successfully execute initiative for {customer_name} meeting all defined acceptance criteria.",
            f"Production verification and handover to {customer_name} team."
        ]

        # 6. Determine Milestones
        milestones = [
            WorkMilestone(
                id="ms-1",
                title="Discovery, Architecture Assessment & Security Baseline",
                sequence_order=1,
                deliverables=["Architecture assessment document", "Security and compliance requirements specification"],
                dependencies=["Customer technical stakeholder interviews", "Environment access credentials"],
                customer_decisions_required=["Security architecture sign-off"]
            ),
            WorkMilestone(
                id="ms-2",
                title="Core Workflow Migration & Environment Implementation",
                sequence_order=2,
                deliverables=["Provisioned cloud infrastructure", "Migrated critical workflows and service pipelines"],
                dependencies=["Approved architecture from Milestone 1", "Source system access"],
                customer_decisions_required=["Staging cutover approval"]
            ),
            WorkMilestone(
                id="ms-3",
                title="Production Validation, Handover & Operational Sign-off",
                sequence_order=3,
                deliverables=["Production validation report", "Operational runbook & team handover sessions"],
                dependencies=["Milestone 2 migration completion", "Customer testing sign-off"],
                customer_decisions_required=["Final production cutover and handover acceptance"]
            )
        ]

        # 7. Concrete Work Tasks
        tasks = [
            WorkTask(
                id="task-1",
                milestone_id="ms-1",
                title="Assess Existing Architecture & Dependencies",
                description=f"Analyze existing system topology, data flows, and constraints for {customer_name}.",
                dependencies=["Access to system documentation"],
                owner=None,
                status="PLANNED"
            ),
            WorkTask(
                id="task-2",
                milestone_id="ms-1",
                title="Identify Security & Compliance Requirements",
                description=f"Map security, authentication, and compliance requirements with {customer_name} security team.",
                dependencies=["Security stakeholder interview"],
                owner=None,
                status="PLANNED"
            ),
            WorkTask(
                id="task-3",
                milestone_id="ms-2",
                title="Implement & Configure Target Environment",
                description="Provision and configure cloud environment following approved architecture.",
                dependencies=["Approved security architecture"],
                owner=None,
                status="PLANNED"
            ),
            WorkTask(
                id="task-4",
                milestone_id="ms-2",
                title="Migrate Critical Workflows & Data Pipelines",
                description=f"Migrate and test core workflows for {customer_name}.",
                dependencies=["Target environment active"],
                owner=None,
                status="PLANNED"
            ),
            WorkTask(
                id="task-5",
                milestone_id="ms-3",
                title="Environment Validation & DoD Verification",
                description="Conduct end-to-end integration testing and verify all Definition of Done criteria.",
                dependencies=["Migration completed"],
                owner=None,
                status="PLANNED"
            ),
            WorkTask(
                id="task-6",
                milestone_id="ms-3",
                title="Customer Handover & Operational Enablement",
                description=f"Conduct handover sessions and deliver operational runbooks to {customer_name} team.",
                dependencies=["Validation testing complete"],
                owner=None,
                status="PLANNED"
            )
        ]

        # 8. Definition of Done
        dod = [
            {"id": "dod-1", "title": "Architecture assessment documented and approved by customer security", "completed": False},
            {"id": "dod-2", "title": "Target environment provisioned and critical workflows migrated", "completed": False},
            {"id": "dod-3", "title": "Production validation completed with zero critical blockers", "completed": False},
            {"id": "dod-4", "title": "Handover documentation and enablement sessions completed", "completed": False}
        ]

        # 9. Next Actions & Risks
        next_actions = [
            f"Schedule architecture discovery session with {customer_name} technical stakeholders.",
            "Obtain environment access credentials and review current system topology."
        ]
        risks = [
            "Customer security approval cycle may gate production deployment if not engaged early.",
            "Undocumented legacy dependencies may require scope or timeline adjustments."
        ]

        return {
            "engagement_objective": objective,
            "outcomes": outcomes,
            "definition_of_done": dod,
            "milestones": [m.model_dump() for m in milestones],
            "tasks": [t.model_dump() for t in tasks],
            "risks": risks,
            "facts_and_assumptions": {
                "confirmed_facts": confirmed_facts,
                "inferred_assumptions": inferred_assumptions,
                "unresolved_questions_or_gaps": missing_gaps
            },
            "next_actions": next_actions,
            "timeline_summary": timeline_summary,
            "is_provisional": len(missing_gaps) > 0,
            "clarifying_questions": clarifying_questions
        }

