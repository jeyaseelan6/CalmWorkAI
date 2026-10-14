"""
Supervisor Coordinator Engine.
Central Orchestrator coordinating all 4 specialized agents (UNDERSTAND, KNOW, MOVE, DELIVER)
over 1 centralized engagement state across the 6 FDE Work Cycles.
"""

from typing import List, Dict, Any, Optional, Callable
from pydantic import BaseModel, Field
import logging
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
from fastapi import HTTPException
from google.adk.runners import Runner
from google.adk.sessions import BaseSessionService
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


class DelegatedAgentInfo(BaseModel):
    id: str  # "UNDERSTAND" | "MOVE" | "DELIVER" | "KNOW" | "MULTI_AGENT"
    name: str  # e.g. "UNDERSTAND Agent"
    role: str  # e.g. "Requirements & Scope Intelligence"
    badge_label: str  # e.g. "Scope & Contract Specialist"
    color: str  # "purple" | "amber" | "rose" | "blue" | "slate"


class SupervisorQueryResponse(BaseModel):
    engagement_id: str
    query: str
    intent_detected: str  # "UNDERSTAND" | "KNOW" | "MOVE" | "DELIVER" | "MULTI_AGENT"
    answer: str
    sources: List[SourceCitation]
    capabilities_used: List[str]
    sufficient_evidence: bool = True
    suggested_followups: List[str]
    delegated_agent: Optional[DelegatedAgentInfo] = None
    timestamp: str


class ProposedWorkItem(BaseModel):
    id: str
    title: str
    sequence_order: int
    why_it_matters: str
    dependencies: List[str] = []
    blockers: List[str] = []
    decisions_or_approvals_required: List[str] = []
    status: str = "PROPOSED"  # "PROPOSED" | "TODO" | "IN_PROGRESS" | "COMPLETED" | "APPROVED" | "SUPERSEDED" | "REJECTED"
    due_date: Optional[str] = None  # Target due date in IST 24h clock (e.g. "14 Oct 2026, 17:00 IST")
    linked_goal_id: Optional[str] = None  # ID of corresponding Outcome Goal criterion (e.g. "sc-1")


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
    next_best_action: Optional[Dict[str, Any]] = None  # Complete MOVE Agent Output
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
        pending_approvals: int = 0,
        timeline_events: Optional[List[Any]] = None,
        approved_work_plan: Optional[Dict[str, Any]] = None,
        pending_approvals_list: Optional[List[Any]] = None,
        engagement_progress: int = 0
    ) -> SupervisorQueryResponse:
        """
        Universal Conversational Interface ('Ask CalmWork'):
        1. Classifies the intent of the message (UNDERSTAND, MOVE, DELIVER, KNOW, MULTI_AGENT).
        2. Explicitly hands over execution to the relevant specialist agent.
        3. Generates rich, context-aware responses utilizing real engagement timeline,
           work plan tasks, definition of done, and blockers.
        """
        logger.info(f"Supervisor processing query for engagement {engagement_id}: '{raw_query}'")

        # 1. Apply Defense-in-Depth Privacy Boundary
        sanitized_query, mapping = self.privacy_engine.process_llm_input(raw_query, session_id=engagement_id)
        q_lower = sanitized_query.lower().strip()

        # 2. Extract & Format Grounded Engagement Context
        crit_items = success_criteria or []
        completed_crits = [c for c in crit_items if isinstance(c, dict) and c.get("completed")]
        total_crits = len(crit_items)
        crit_lines = []
        for c in crit_items:
            if isinstance(c, dict):
                crit_lines.append(f"- [{'x' if c.get('completed') else ' '}] {c.get('title', 'Criterion')}")
            else:
                crit_lines.append(f"- [ ] {str(c)}")
        crit_formatted = "\n".join(crit_lines) if crit_lines else "No formal success criteria recorded."

        wp = approved_work_plan or {}
        tasks = wp.get("tasks", []) if isinstance(wp, dict) else []
        task_lines = []
        in_progress_tasks = []
        for t in tasks:
            if isinstance(t, dict):
                t_stat = str(t.get("status", "TODO")).upper()
                t_title = t.get("title", "Task")
                t_due = t.get("due_date", "Unscheduled")
                task_lines.append(f"- [{t_stat}] {t_title} (Due: {t_due})")
                if t_stat in ["IN_PROGRESS", "ACTIVE"]:
                    in_progress_tasks.append(t)
        tasks_formatted = "\n".join(task_lines[:6]) if task_lines else "No work plan tasks initialized."

        events = timeline_events or []
        recent_event_lines = []
        for ev in events[:6]:
            t = getattr(ev, "title", None) or (ev.get("title") if isinstance(ev, dict) else "")
            d = getattr(ev, "description", None) or (ev.get("description") if isinstance(ev, dict) else "")
            ev_type = getattr(ev, "event_type", None) or (ev.get("event_type") if isinstance(ev, dict) else "")
            dt = getattr(ev, "created_at", None) or (ev.get("created_at") if isinstance(ev, dict) else "")
            if isinstance(dt, datetime):
                dt_ist = dt.replace(tzinfo=timezone.utc).astimezone(IST_TZ) if dt.tzinfo is None else dt.astimezone(IST_TZ)
                dt_str = dt_ist.strftime("%d %b %Y, %H:%M IST")
            elif isinstance(dt, str) and dt:
                try:
                    parsed_dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
                    dt_ist = parsed_dt.replace(tzinfo=timezone.utc).astimezone(IST_TZ) if parsed_dt.tzinfo is None else parsed_dt.astimezone(IST_TZ)
                    dt_str = dt_ist.strftime("%d %b %Y, %H:%M IST")
                except Exception:
                    dt_str = str(dt)[:16]
            else:
                dt_str = str(dt)[:16]
            recent_event_lines.append(f"- [{dt_str}] ({ev_type}) {t}: {d}")
        timeline_formatted = "\n".join(recent_event_lines) if recent_event_lines else "No recent worknotes or events recorded."

        apprs = pending_approvals_list or []
        pending_desc_lines = []
        for a in apprs:
            a_type = getattr(a, "type", None) or (a.get("type") if isinstance(a, dict) else "APPROVAL")
            a_req = getattr(a, "requested_by", None) or (a.get("requested_by") if isinstance(a, dict) else "FDE")
            pending_desc_lines.append(f"{a_type} (Requested by {a_req})")
        pending_approvals_desc = "; ".join(pending_desc_lines) if pending_desc_lines else ("None" if pending_approvals == 0 else f"{pending_approvals} pending approval(s)")

        # 3. Intent Detection: AI Classification with Semantic Pattern Fallback
        now_ist = datetime.now(IST_TZ)
        now_ist_str = now_ist.strftime("%d %b %Y, %H:%M IST")
        time_rule = (
            f"MANDATORY TIMEZONE RULE:\n"
            f"- Current Platform Time: {now_ist_str}\n"
            f"- All timestamps, event hours, milestones, and deadlines across your response MUST strictly use Indian Standard Time (IST) 24-hour clock only (e.g. '{now_ist_str}' or '15:30 IST').\n"
            f"- NEVER output or mention UTC, GMT, or 12-hour AM/PM formats under any circumstances."
        )

        intent = None
        if groq_service.is_configured() or is_live_inference_enabled():
            classification_prompt = (
                f"You are the intent router for CalmWork AI multi-agent platform.\n"
                f"Classify the user message into EXACTLY ONE category:\n"
                f"- UNDERSTAND: Questions about requirements, scope changes, what changed today/recently, contract drift, additions/deletions, or new customer mandates.\n"
                f"- MOVE: Questions about immediate next actions, what to do next, priorities, blockers, overdue tasks, or why production/progress is blocked.\n"
                f"- DELIVER: Requests to prepare or draft a customer update, stakeholder communication, email, progress report, or status memo.\n"
                f"- KNOW: Questions about technical architecture, specs, database schemas, cutover windows, runbooks, documentation, or how systems work.\n"
                f"- MULTI_AGENT: Inquiries spanning multiple areas or asking for a general project status overview.\n\n"
                f"User Message: \"{sanitized_query}\"\n\n"
                f"Return ONLY the single word category name: UNDERSTAND, MOVE, DELIVER, KNOW, or MULTI_AGENT."
            )
            try:
                raw_cat = groq_service.generate_chat_completion(
                    prompt=classification_prompt,
                    system_instruction="You are an intent classification router. Return only one category name.",
                    max_tokens=15
                )
                if raw_cat:
                    candidate = raw_cat.strip().upper()
                    for cat in ["UNDERSTAND", "MOVE", "DELIVER", "KNOW", "MULTI_AGENT"]:
                        if cat in candidate:
                            intent = cat
                            break
            except Exception as ex:
                logger.debug(f"LLM intent classification fallback to rule matching: {ex}")

        # Semantic pattern matching fallback
        if not intent:
            if any(term in q_lower for term in [
                "what should i do", "what to do next", "do next", "what next", "next action",
                "next step", "what's next", "why is production blocked", "why is it blocked",
                "blocked", "blocking", "blocker", "priority", "priorities", "focus on",
                "tasks today", "what task", "task to work on"
            ]):
                intent = "MOVE"
            elif any(term in q_lower for term in [
                "what changed", "what's changed", "changed today", "recent change", "scope change",
                "scope drift", "new requirement", "requirement shift", "contract drift", "added",
                "mandate", "in scope", "out of scope", "changed", "requirements"
            ]):
                intent = "UNDERSTAND"
            elif any(term in q_lower for term in [
                "customer update", "client update", "stakeholder update", "prepare an update",
                "prepare update", "draft update", "draft an update", "tell the customer",
                "share with the client", "email update", "status memo", "email to the customer"
            ]):
                intent = "DELIVER"
            elif any(term in q_lower for term in [
                "cutover", "window", "spec", "architecture", "encryption", "database",
                "runbook", "schema", "debezium", "cdc", "how does", "what is the", "policy",
                "documentation", "technical"
            ]):
                intent = "KNOW"
            elif len([w for w in ["changed", "blocking", "customer", "next", "spec", "update"] if w in q_lower]) >= 2:
                intent = "MULTI_AGENT"
            else:
                intent = "KNOW"

        capabilities_used = [intent] if intent != "MULTI_AGENT" else ["UNDERSTAND", "MOVE", "KNOW", "DELIVER"]
        sources: List[SourceCitation] = []
        answer = ""

        # 4. Handover to Relevant Specialist Agent & Context-Aware Execution

        if intent == "UNDERSTAND":
            handover_banner = "🎯 **[Handed over to UNDERSTAND Agent — Requirements & Scope Intelligence]**\n\n"

            llm_response = None
            if groq_service.is_configured() or is_live_inference_enabled():
                understand_prompt = (
                    f"You are the UNDERSTAND Agent in CalmWork AI. You protect scope integrity and track requirement evolution.\n\n"
                    f"{time_rule}\n\n"
                    f"Engagement Context:\n"
                    f"- Customer: {customer_name} ({engagement_id})\n"
                    f"- Current Work Cycle: {current_work_cycle}\n"
                    f"- Status: {status}\n"
                    f"- Outcome Version {version}: \"{outcome_statement}\"\n"
                    f"- Progress: {engagement_progress}% ({len(completed_crits)}/{total_crits} criteria completed)\n\n"
                    f"Success Criteria (Outcome Goals):\n{crit_formatted}\n\n"
                    f"Recent Timeline Events & Worknotes (All in IST):\n{timeline_formatted}\n\n"
                    f"User Query: \"{sanitized_query}\"\n\n"
                    f"Provide a concise, direct, professional response answering the user's question with full context of recent timeline events, worknotes, and whether current work remains strictly within approved scope. Ensure any dates or times mentioned are strictly in IST 24h format."
                )
                try:
                    llm_response = groq_service.generate_chat_completion(
                        prompt=understand_prompt,
                        system_instruction="You are the CalmWork UNDERSTAND Agent. Respond concisely and professionally. Keep all timestamps strictly in IST 24-hour clock notation.",
                        max_tokens=600
                    )
                except Exception as e:
                    logger.debug(f"UNDERSTAND LLM call fallback: {e}")

            if llm_response:
                answer = llm_response.strip()
            else:
                parts = []
                if events:
                    parts.append(f"**Recent Timeline Activity for {customer_name}:**")
                    for ev in events[:4]:
                        t = getattr(ev, "title", None) or (ev.get("title") if isinstance(ev, dict) else "")
                        d = getattr(ev, "description", None) or (ev.get("description") if isinstance(ev, dict) else "")
                        parts.append(f"- **{t}**: {d}")
                    parts.append("")

                parts.append(f"**Outcome Goals Alignment (v{version}):**")
                parts.append(f"Outcome statement: *\"{outcome_statement}\"* (Progress: {engagement_progress}%, {len(completed_crits)}/{total_crits} criteria completed).")
                if crit_items:
                    parts.append("\n**Definition of Done Status:**")
                    for c in crit_items[:4]:
                        if isinstance(c, dict):
                            box = "✅" if c.get("completed") else "⏳"
                            parts.append(f"- {box} {c.get('title', 'Criterion')}")
                if status == "NEEDS_REASSESSMENT":
                    parts.append("\n⚠️ **Scope Alert**: Engagement is flagged as `NEEDS_REASSESSMENT`. An unapproved scope addition or contract shift was detected requiring Manager authorization.")
                else:
                    parts.append("\n✅ Current engineering trajectory remains aligned with approved contractual scope.")
                answer = "\n".join(parts)

        elif intent == "MOVE":
            handover_banner = "⚡ **[Handed over to MOVE Agent — Operational Velocity & Next Actions]**\n\n"

            llm_response = None
            if groq_service.is_configured() or is_live_inference_enabled():
                move_prompt = (
                    f"You are the MOVE Agent in CalmWork AI. You specialize in operational velocity, eliminating blockers, and recommending the single highest-leverage next action.\n\n"
                    f"{time_rule}\n\n"
                    f"Engagement Context:\n"
                    f"- Customer: {customer_name}\n"
                    f"- Current Work Cycle: {current_work_cycle}\n"
                    f"- Status: {status}\n"
                    f"- Pending Approvals: {pending_approvals_desc}\n\n"
                    f"Active Work Plan Tasks (Target Due Dates in IST):\n{tasks_formatted}\n\n"
                    f"Recent Activity (in IST):\n{timeline_formatted}\n\n"
                    f"User Query: \"{sanitized_query}\"\n\n"
                    f"Identify the Next Best Action for the engineer, explain WHY NOW, address any gating approvals or blockers, and specify immediate next steps. All target times and schedules must strictly use IST 24-hour notation."
                )
                try:
                    llm_response = groq_service.generate_chat_completion(
                        prompt=move_prompt,
                        system_instruction="You are the CalmWork MOVE Agent. Provide high-clarity operational guidance. Keep all timestamps and deadlines strictly in IST 24-hour clock notation.",
                        max_tokens=600
                    )
                except Exception as e:
                    logger.debug(f"MOVE LLM call fallback: {e}")

            if llm_response:
                answer = llm_response.strip()
            else:
                next_act = self.move_agent.determine_next_action(
                    engagement_id=engagement_id,
                    customer_name=customer_name,
                    current_work_cycle=current_work_cycle,
                    status=status,
                    outcome_version=version,
                    pending_approvals=pending_approvals
                )
                parts = [
                    f"**Next Best Action**: {next_act.action_title}\n",
                    f"**Why Now**: {next_act.why_now}\n",
                    f"**Impact**: {next_act.impact}\n",
                    f"**Priority**: `{next_act.priority_level}` (Confidence: {next_act.confidence})"
                ]
                if any(b in q_lower for b in ["blocked", "blocker", "blocking"]):
                    parts.append("\n### Blocker Analysis:")
                    if pending_approvals > 0:
                        parts.append(f"⚠️ **Primary Blocker**: {pending_approvals_desc} is pending Manager approval before progression.")
                    else:
                        parts.append("✅ **No Workflow Blockers**: There are no active blocking approvals halting execution.")
                elif pending_approvals > 0:
                    parts.append(f"\n⚠️ **Blocker Gate**: {pending_approvals_desc} is pending Manager approval before progression.")

                if in_progress_tasks:
                    parts.append(f"\n**Immediate Task in Flight**: {in_progress_tasks[0].get('title')} (Due: {in_progress_tasks[0].get('due_date', 'Unscheduled')})")
                elif tasks:
                    parts.append(f"\n**Next Task in Queue**: {tasks[0].get('title')} (Status: {tasks[0].get('status', 'TODO')})")
                answer = "\n".join(parts)

        elif intent == "DELIVER":
            handover_banner = "📢 **[Handed over to DELIVER Agent — Stakeholder Communications]**\n\n"

            llm_response = None
            if groq_service.is_configured() or is_live_inference_enabled():
                deliver_prompt = (
                    f"You are the DELIVER Agent in CalmWork AI. You translate engineering progress into calm, high-trust executive stakeholder communication.\n\n"
                    f"{time_rule}\n\n"
                    f"Engagement Context:\n"
                    f"- Customer: {customer_name}\n"
                    f"- Current Stage: {current_work_cycle}\n"
                    f"- Outcome Objective: \"{outcome_statement}\"\n"
                    f"- Progress: {engagement_progress}%\n"
                    f"- Completed Criteria:\n{crit_formatted}\n\n"
                    f"Recent Engineering Worknotes (in IST):\n{timeline_formatted}\n\n"
                    f"User Query: \"{sanitized_query}\"\n\n"
                    f"Draft a clean, professional stakeholder update containing:\n"
                    f"1. Executive Summary\n"
                    f"2. Key Milestones Achieved (with dates in IST 24h notation)\n"
                    f"3. Next Milestones & Commitments (with target deadlines in IST 24h notation)\n"
                    f"4. Customer Action Items (if any)\n"
                    f"Note: Remind the user that manager approval is required before external distribution."
                )
                try:
                    llm_response = groq_service.generate_chat_completion(
                        prompt=deliver_prompt,
                        system_instruction="You are the CalmWork DELIVER Agent. Write clear, executive-grade customer communications. Keep all dates and times strictly in IST 24-hour clock notation.",
                        max_tokens=700
                    )
                except Exception as e:
                    logger.debug(f"DELIVER LLM call fallback: {e}")

            if llm_response:
                answer = llm_response.strip()
            else:
                draft = self.deliver_agent.generate_customer_update(
                    engagement_id=engagement_id,
                    customer_name=customer_name,
                    engagement_name=customer_name,
                    outcome_statement=outcome_statement,
                    success_criteria=crit_items,
                    current_work_cycle=current_work_cycle
                )
                parts = [
                    f"### {draft.subject}\n",
                    f"**Executive Summary**:\n{draft.executive_summary}\n",
                    "**Key Milestones Achieved**:"
                ]
                for m in draft.key_milestones_achieved:
                    parts.append(f"- {m}")
                parts.append(f"\n**Next Milestone Target**: {draft.next_milestone_target}")
                if draft.customer_action_items:
                    parts.append("\n**Customer Action Items**:")
                    for a in draft.customer_action_items:
                        parts.append(f"- {a}")
                parts.append("\n*Note: Customer updates require Manager authorization in the Approvals queue prior to client distribution.*")
                answer = "\n".join(parts)

        elif intent == "KNOW":
            handover_banner = "📚 **[Handed over to KNOW Agent — Grounded Technical Documentation & Engagement Intelligence]**\n\n"

            engagement_context = {
                "customer_name": customer_name,
                "timeline_events": events,
                "outcome_statement": outcome_statement,
                "success_criteria": crit_items,
                "outcome_version": version,
                "approved_work_plan": approved_work_plan,
                "pending_approvals": apprs,
                "current_work_cycle": current_work_cycle,
                "status": status,
                "engagement_progress": engagement_progress
            }

            know_response = self.know_agent.answer_question(
                engagement_id=engagement_id,
                raw_question=sanitized_query,
                top_k=3,
                engagement_context=engagement_context
            )
            for cit in know_response.citations:
                sources.append(SourceCitation(
                    title=cit.document_title,
                    source_type=getattr(cit, "source_type", "DOCUMENT"),
                    snippet=cit.snippet
                ))

            if know_response.evidence_sufficient:
                answer = know_response.answer
            else:
                answer = (
                    f"I searched the verified documentation and engagement records for {customer_name}, "
                    f"but there is not enough specific evidence to answer this query with high confidence.\n\n"
                    f"**Recommendation**: Please upload the technical specification via the Documents tab, "
                    f"or record the relevant update in Worknotes to index this information into the KNOW Agent."
                )

        else:  # MULTI_AGENT / SUPERVISOR
            parts = [
                f"### 360° Operational Briefing for {customer_name}\n",
                f"**1. Scope & Requirements (UNDERSTAND)**:",
                f"- Outcome Version {version}: *\"{outcome_statement}\"*",
                f"- Definition of Done: {len(completed_crits)}/{total_crits} criteria complete ({engagement_progress}% progress).",
                f"- Status: `{status}`\n",
                f"**2. Velocity & Active Tasks (MOVE)**:",
                f"- Current Work Cycle: {current_work_cycle}",
                f"- Pending Approvals: {pending_approvals_desc}"
            ]
            if in_progress_tasks:
                parts.append(f"- Task in Progress: {in_progress_tasks[0].get('title')}")

            parts.append("\n**3. Recent Shared Timeline Activity**:")
            for ev in events[:3]:
                t = getattr(ev, "title", None) or (ev.get("title") if isinstance(ev, dict) else "")
                parts.append(f"- {t}")

            answer = "\n".join(parts)

        # 5. Restore de-anonymized names if needed
        final_answer = self.privacy_engine.sanitize_output(answer, mapping)
        # Defense-in-depth: Ensure any residual UTC/GMT references are strictly converted to IST
        final_answer = re.sub(r'\(UTC\)', '(IST)', final_answer)
        final_answer = re.sub(r'\bUTC\b', 'IST', final_answer)
        final_answer = re.sub(r'\bGMT\b', 'IST', final_answer)

        # 6. Dynamic Suggested Followups based on intent
        if intent == "UNDERSTAND":
            suggested_followups = [
                "What success criteria are still incomplete?",
                "Record a worknote on scope discussion",
                "What should I do next?"
            ]
        elif intent == "MOVE":
            suggested_followups = [
                "What approvals are currently pending?",
                "Show active tasks in work plan",
                "Prepare a customer update"
            ]
        elif intent == "DELIVER":
            suggested_followups = [
                "Submit update for Manager approval",
                "Download executive summary PDF",
                "What should I do next?"
            ]
        elif intent == "KNOW":
            suggested_followups = [
                "Search engagement architecture docs",
                "Upload official specification document",
                "What changed today?"
            ]
        else:
            suggested_followups = [
                "What changed today?",
                "What should I do next?",
                "Prepare a customer update"
            ]

        # 7. Delegated Specialist Agent Metadata
        agent_directory = {
            "UNDERSTAND": DelegatedAgentInfo(
                id="UNDERSTAND",
                name="UNDERSTAND Agent",
                role="Requirements & Scope Intelligence",
                badge_label="Scope & Contract Specialist",
                color="purple"
            ),
            "MOVE": DelegatedAgentInfo(
                id="MOVE",
                name="MOVE Agent",
                role="Operational Velocity & Next Actions",
                badge_label="Velocity & Blocker Specialist",
                color="amber"
            ),
            "DELIVER": DelegatedAgentInfo(
                id="DELIVER",
                name="DELIVER Agent",
                role="Stakeholder Communications",
                badge_label="Executive Communication Specialist",
                color="rose"
            ),
            "KNOW": DelegatedAgentInfo(
                id="KNOW",
                name="KNOW Agent",
                role="Grounded Technical Documentation",
                badge_label="Verified Technical Knowledge",
                color="blue"
            ),
            "MULTI_AGENT": DelegatedAgentInfo(
                id="MULTI_AGENT",
                name="CalmWork Plan Agent",
                role="Central Multi-Agent Orchestration",
                badge_label="Universal Orchestrator",
                color="slate"
            )
        }
        delegated_agent = agent_directory.get(intent, agent_directory["MULTI_AGENT"])

        return SupervisorQueryResponse(
            engagement_id=engagement_id,
            query=raw_query,
            intent_detected=intent,
            answer=final_answer,
            sources=sources,
            capabilities_used=capabilities_used,
            sufficient_evidence=True,
            suggested_followups=suggested_followups,
            delegated_agent=delegated_agent,
            timestamp=datetime.now(IST_TZ).isoformat()
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
        approved_work_plan: Optional[Dict[str, Any]] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
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
        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "SUPERVISOR",
                "stage": "STATE",
                "message": "Loading engagement state snapshot & timeline...",
                "step": 1,
                "total_steps": 5
            })
        now_str = datetime.now(IST_TZ).strftime("%d %b %Y, %H:%M IST")
        now_iso = datetime.now(IST_TZ).isoformat()
        warnings: List[str] = []

        # -------------------------------------------------------------
        # STEP 1: Invoke UNDERSTAND Agent (Identify Outcome & Scope Drift)
        # -------------------------------------------------------------
        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "UNDERSTAND",
                "stage": "SCOPE_ANALYSIS",
                "message": "UNDERSTAND Agent analyzing requirement changes & scope drift...",
                "step": 2,
                "total_steps": 5
            })
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
        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "KNOW",
                "stage": "EVIDENCE_RETRIEVAL",
                "message": f"KNOW Agent performing grounded RAG retrieval for {customer_name}...",
                "step": 3,
                "total_steps": 5
            })
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
        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "MOVE",
                "stage": "ACTION_EVALUATION",
                "message": "MOVE Agent evaluating gating blockers & Next Best Action...",
                "step": 4,
                "total_steps": 5
            })
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
        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "SUPERVISOR",
                "stage": "SYNTHESIS",
                "message": "Supervisor assembling Daily Work Plan & IST Due Targets...",
                "step": 5,
                "total_steps": 5
            })
        
        # Section A: What Changed?
        what_changed: List[WhatChangedItem] = []
        category_map = {
            "ENGAGEMENT_CREATED": "INITIATIVE",
            "OUTCOME_CHANGE_PROPOSED": "OUTCOME",
            "OUTCOME_APPROVED": "OUTCOME",
            "CHANGE_DETECTED": "REQUIREMENT",
            "WORKNOTE_LOGGED": "WORKNOTE",
            "WORKNOTE": "WORKNOTE",
            "APPROVAL_CREATED": "GOVERNANCE",
            "BLOCKER_IDENTIFIED": "BLOCKER",
            "MORNING_BRIEF_GENERATED": "SYSTEM"
        }
        if timeline_events:
            for evt in timeline_events:
                evt_type = getattr(evt, "event_type", "PROGRESS")
                # Exclude internal morning brief system events and minor task updates so worknotes and major changes shine
                if evt_type in ("MORNING_BRIEF_GENERATED", "TASK_UPDATED"):
                    continue
                summary_text = getattr(evt, "description", None) or getattr(evt, "title", "Milestone recorded")
                evt_date = getattr(evt, "created_at", None)
                if evt_date and hasattr(evt_date, "strftime"):
                    if getattr(evt_date, "tzinfo", None) is None:
                        evt_ist = evt_date.replace(tzinfo=timezone.utc).astimezone(IST_TZ)
                    else:
                        evt_ist = evt_date.astimezone(IST_TZ)
                    date_str = evt_ist.strftime("%d %b %Y, %H:%M IST")
                else:
                    date_str = now_str
                what_changed.append(WhatChangedItem(
                    summary=summary_text,
                    category=category_map.get(evt_type, "PROGRESS"),
                    date_recorded=date_str,
                    timeline_ref=str(getattr(evt, "id", f"evt-{engagement_id}"))
                ))
                if len(what_changed) >= 5:
                    break

        if not what_changed:
            what_changed = [
                WhatChangedItem(
                    summary=f"Engagement '{customer_name}' initialized with Outcome v{version} Outcome Goals.",
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
        if (pending_approvals or 0) > 0:
            pending_decisions.append(f"Manager approval required for {customer_name} (Outcome v{version} / Outcome Goals change).")

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

        # Dynamic Work Items with IST Due Dates & Outcome Goal Linkage
        now_ist = datetime.now(IST_TZ)
        def compute_ist_due_date(seq: int) -> str:
            target = now_ist + timedelta(days=max(0, seq - 1))
            hour = 17 if seq == 1 else (14 if seq % 2 == 0 else 18)
            return target.replace(hour=hour, minute=0, second=0).strftime("%d %b %Y, %H:%M IST")

        work_items: List[ProposedWorkItem] = []
        existing_task_map = {}
        if approved_work_plan and isinstance(approved_work_plan, dict) and approved_work_plan.get("tasks"):
            for t in approved_work_plan.get("tasks", []):
                if isinstance(t, dict):
                    existing_task_map[t.get("id")] = t
                    if t.get("linked_goal_id"):
                        existing_task_map[t.get("linked_goal_id")] = t

        if success_criteria:
            for idx, crit in enumerate(success_criteria):
                crit_id = crit.get("id", f"sc-{idx+1}") if isinstance(crit, dict) else f"sc-{idx+1}"
                crit_title = crit.get("title", f"Deliver milestone criterion {idx+1}") if isinstance(crit, dict) else str(crit)
                is_done = crit.get("completed", False) if isinstance(crit, dict) else False
                matched_task = existing_task_map.get(crit_id) or existing_task_map.get(f"task-{idx+1}")
                crit_due = (matched_task.get("due_date") if matched_task else None) or (crit.get("due_date") if isinstance(crit, dict) else None) or compute_ist_due_date(idx + 1)
                t_status = "COMPLETED" if is_done else (matched_task.get("status", "TODO") if matched_task else "TODO")
                t_title = matched_task.get("title", crit_title) if (matched_task and matched_task.get("title") and not matched_task.get("title").startswith("task-")) else crit_title

                work_items.append(ProposedWorkItem(
                    id=crit_id,
                    title=t_title,
                    sequence_order=idx + 1,
                    why_it_matters=f"Fulfills Outcome Goal criterion for {customer_name}.",
                    dependencies=[],
                    blockers=[],
                    decisions_or_approvals_required=["Manager Signoff"] if status == "NEEDS_REASSESSMENT" and idx == 0 else [],
                    status="COMPLETED" if (is_done or t_status == "COMPLETED") else t_status,
                    due_date=crit_due,
                    linked_goal_id=crit_id
                ))
        elif approved_work_plan and isinstance(approved_work_plan, dict) and approved_work_plan.get("tasks"):
            for idx, task in enumerate(approved_work_plan.get("tasks", [])):
                t_id = task.get("id", f"task-{idx+1}")
                t_title = task.get("title", f"Task {idx+1}")
                t_raw_status = str(task.get("status", "TODO")).upper()
                t_status = "COMPLETED" if t_raw_status in ["COMPLETED", "DONE"] else ("IN_PROGRESS" if t_raw_status in ["IN_PROGRESS", "ACTIVE"] else "TODO")
                t_deps = task.get("dependencies", [])
                t_due = task.get("due_date") or compute_ist_due_date(idx + 1)
                work_items.append(ProposedWorkItem(
                    id=t_id,
                    title=t_title,
                    sequence_order=idx + 1,
                    why_it_matters=task.get("description") or f"Approved plan task for {customer_name}.",
                    dependencies=t_deps,
                    blockers=[],
                    decisions_or_approvals_required=[],
                    status=t_status,
                    due_date=t_due,
                    linked_goal_id=task.get("linked_goal_id")
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
                    status="TODO",
                    due_date=compute_ist_due_date(1),
                    linked_goal_id="sc-1"
                )
            ]

        rec_first_action = (
            move_findings.recommendation
            if (move_findings and move_findings.recommendation)
            else f"Review Outcome Goals criteria for {customer_name}."
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
            next_best_action=move_findings.model_dump() if move_findings else None,
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
        session_id: Optional[str] = None,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
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
        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "SUPERVISOR",
                "stage": "PRIVACY",
                "message": "Sanitizing input through Privacy Guardrail...",
                "step": 1,
                "total_steps": 4
            })
        sanitized_desc, mapping = self.privacy_engine.process_llm_input(
            natural_language_description,
            session_id=engagement_id
        )

        # 2. Retrieve any relevant indexed specifications
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
            "7. Formulate a crisp Outcome Goals (acceptance criteria) list.\n\n"
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
                        "agent": "SUPERVISOR",
                        "stage": "INFERENCE",
                        "message": "Planning Engine synthesizing structured delivery plan with AI...",
                        "step": 3,
                        "total_steps": 4
                    })
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
                logger.warning(f"ADK runner planning generation error: {e}")

        # Strictly enforce LLM generation — zero deterministic mock or fallback fabrication
        if not parsed_data or not isinstance(parsed_data, dict):
            raise HTTPException(
                status_code=503,
                detail="AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
            )

        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "SUPERVISOR",
                "stage": "VALIDATION",
                "message": "Validating milestone hierarchy, dependencies & Outcome Goals...",
                "step": 4,
                "total_steps": 4
            })

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

        dod_list = parsed_data.get("outcome_goals") or parsed_data.get("definition_of_done", [])
        formatted_dod = []
        for idx, item in enumerate(dod_list):
            if isinstance(item, dict):
                formatted_dod.append({
                    "id": item.get("id", f"sc-{idx+1}"),
                    "title": item.get("title", f"Outcome Goal {idx+1}"),
                    "completed": item.get("completed", False)
                })
            elif isinstance(item, str):
                formatted_dod.append({
                    "id": f"sc-{idx+1}",
                    "title": item,
                    "completed": False
                })

        raw_risks = parsed_data.get("risks", [])
        raw_next_actions = parsed_data.get("next_actions", [])

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


