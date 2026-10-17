"""
Supervisor Coordinator Engine.
Central Orchestrator coordinating specialized agents (PLAN, KNOW, MOVE, DELIVER, SUPPORT)
over 1 centralized engagement state across the 6 FDE Work Cycles.
"""

from typing import List, Dict, Any, Optional, Callable
from pydantic import BaseModel, Field
import logging
import json
import re
import uuid
from datetime import datetime, timezone, timedelta

from app.agents.invariants import IST_TZ, get_current_ist_str, UNIVERSAL_AGENT_INVARIANTS

from app.agents import (
    PlanAgent, ChangeImpactAnalysis,
    StructuredWorkPlanProposal, WorkMilestone, WorkTask, FactAssumptionGap,
    PlanReassessmentResult,
    SupportAgent, IncidentInvestigationResult,
    KnowAgent, GroundedAnswer,
    MoveAgent, NextBestActionRecommendation,
    DeliverAgent, CustomerUpdateDraft,
    UnderstandAgent  # compatibility shim
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
    id: str  # "PLAN" | "MOVE" | "DELIVER" | "KNOW" | "SUPPORT" | "MULTI_AGENT" | "UNDERSTAND"
    name: str  # e.g. "PLAN Agent"
    role: str  # e.g. "Planning & Delivery Intelligence"
    badge_label: str  # e.g. "Planning & Delivery Specialist"
    color: str  # "purple" | "amber" | "rose" | "blue" | "emerald" | "slate"


class SupervisorQueryResponse(BaseModel):
    engagement_id: str
    query: str
    intent_detected: str  # "PLAN" | "KNOW" | "MOVE" | "DELIVER" | "SUPPORT" | "MULTI_AGENT"
    answer: str
    sources: List[SourceCitation]
    capabilities_used: List[str]
    sufficient_evidence: bool = True
    suggested_followups: List[str]
    delegated_agent: Optional[DelegatedAgentInfo] = None
    customer_update: Optional[CustomerUpdateDraft] = None
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
    capabilities_invoked: List[str] = ["PLAN", "KNOW", "MOVE", "SUPERVISOR"]
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
    Active Agents: PLAN, KNOW, MOVE, DELIVER, SUPPORT.
    """

    def __init__(
        self,
        privacy_engine: Optional[PrivacyPolicyEngine] = None,
        gemini_service: Optional[Any] = None,
        session_service: Optional[BaseSessionService] = None,
        plan_agent: Optional[Any] = None,
        support_agent: Optional[Any] = None,
        know_agent: Optional[Any] = None,
        move_agent: Optional[Any] = None,
        deliver_agent: Optional[Any] = None
    ):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.session_service = session_service or get_session_service()
        self.model = get_adk_model()
        self.gemini_service = gemini_service
        self.event_bus = EventBus()

        # Specialized agents: PLAN, KNOW, MOVE, DELIVER, SUPPORT
        self.know_agent = know_agent or KnowAgent(
            privacy_engine=self.privacy_engine,
            session_service=self.session_service
        )
        self.plan_agent = plan_agent or PlanAgent(
            privacy_engine=self.privacy_engine,
            session_service=self.session_service,
            know_agent=self.know_agent
        )
        self.move_agent = move_agent or MoveAgent(
            privacy_engine=self.privacy_engine,
            session_service=self.session_service
        )
        self.deliver_agent = deliver_agent or DeliverAgent(
            privacy_engine=self.privacy_engine,
            session_service=self.session_service
        )
        self.support_agent = support_agent or SupportAgent(
            privacy_engine=self.privacy_engine,
            session_service=self.session_service,
            know_agent=self.know_agent
        )
        # Compatibility property: understand_agent references plan_agent
        self.understand_agent = self.plan_agent

        # ADK Sequential Workflow for predictable Morning Brief orchestration:
        # PLAN -> KNOW -> MOVE (Supervisor consolidates). DELIVER is strictly EXCLUDED.
        self.morning_brief_workflow = SequentialAgent(
            name="morning_brief_sequential_workflow",
            description="Sequential ADK workflow executing PLAN -> KNOW -> MOVE (DELIVER excluded).",
            sub_agents=[
                self.plan_agent.adk_agent,
                self.know_agent.adk_agent,
                self.move_agent.adk_agent
            ]
        )

        # Central Supervisor ADK Agent for conversational queries and synthesis
        self.supervisor_agent = Agent(
            name="supervisor_coordinator",
            description="Central multi-agent coordinator for conversational queries, intent routing, and delivery orchestration.",
            model=self.model,
            instruction=(
                "You are the CalmWork Supervisor Multi-Agent Coordinator for Forward-Deployed Engineers. "
                "Synthesize findings across PLAN, KNOW, MOVE, DELIVER, and SUPPORT. "
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
        now_ist_str = get_current_ist_str()
        time_rule = f"{UNIVERSAL_AGENT_INVARIANTS}\n\nCURRENT PLATFORM TIME: {now_ist_str}"

        intent = None
        if groq_service.is_configured() or is_live_inference_enabled():
            classification_prompt = (
                f"You are the CalmWork Supervisor Router. Your sole job is to classify the user's primary intended outcome into exactly one agent.\n\n"
                f"CRITICAL DIRECTIVE (ANTI-GRAVITY PRINCIPLE):\n"
                f"Do NOT match on literal words. Ignore vocabulary surface triggers:\n"
                f"- The word 'plan' does NOT automatically mean PLAN (e.g., 'What is our plan to fix this blocker?' -> MOVE).\n"
                f"- The word 'blocked' does NOT automatically mean MOVE (e.g., 'Does the SOP say blocked ports fail the audit?' -> KNOW).\n"
                f"- Technical terms ('schema', 'cert', 'db') do NOT automatically mean KNOW if asking what action to take next.\n\n"
                f"Evaluate solely by the CORE HUMAN DESIRE:\n"
                f"1. MOVE: 'Tell me what action to take right now, who needs to unblock what, or what to prioritize.'\n"
                f"2. PLAN: 'Reshape, create, or modify the structure of our project roadmap and task lists.'\n"
                f"3. KNOW: 'Retrieve a factual, technical, or historical answer from documents, runbooks, or past notes.'\n"
                f"4. DELIVER: 'Draft or format a communication to be sent outside to stakeholders or executives.'\n"
                f"5. SUPPORT: Production incident diagnosis, bug triage, stack traces, crash logs, or screenshot diagnostics.\n"
                f"6. MULTI_AGENT: 'Give me a high-level 360-degree executive snapshot of where everything stands.'\n\n"
                f"User Message: \"{sanitized_query}\"\n\n"
                f"Return ONLY the single word category name: MOVE, PLAN, KNOW, DELIVER, SUPPORT, or MULTI_AGENT."
            )
            try:
                raw_cat = groq_service.generate_chat_completion(
                    prompt=classification_prompt,
                    system_instruction="You are an intent classification router. Return only one category name.",
                    max_tokens=15
                )
                if raw_cat:
                    candidate = raw_cat.strip().upper()
                    for cat in ["SUPPORT", "PLAN", "MOVE", "DELIVER", "KNOW", "MULTI_AGENT", "UNDERSTAND"]:
                        if cat in candidate:
                            intent = "PLAN" if cat == "UNDERSTAND" else cat
                            break
            except Exception as ex:
                logger.debug(f"LLM intent classification fallback to rule matching: {ex}")

        # Semantic pattern matching fallback with comprehensive domain trigger dictionaries
        if not intent:
            MULTI_AGENT_TRIGGERS = [
                "360", "operational briefing", "full operational update", "multi-agent",
                "full overview", "project status overview", "complete status", "comprehensive update",
                "general status", "everything"
            ]

            SUPPORT_TRIGGERS = [
                "incident", "outage", "bug", "crash", "error log", "screenshot",
                "diagnostic", "stack trace", "production issue", "triage", "support", "broken",
                "exception", "crashed", "exit code", "unhandled"
            ]

            DELIVER_TRIGGERS = [
                "customer update", "client update", "stakeholder update", "prepare an update",
                "prepare update", "draft update", "draft an update", "tell the customer",
                "share with the client", "email update", "status memo", "email to the customer",
                "email to client", "release notes", "executive brief", "executive summary",
                "external communication", "sign-off request", "completion report", "progress memo",
                "weekly summary", "status report"
            ]

            MOVE_TRIGGERS = [
                "what should i do", "what to do next", "do next", "what next", "next action",
                "next step", "what's next", "why is production blocked", "why is it blocked",
                "blocked", "blocking", "blocker", "unblock", "priority", "priorities", "focus on",
                "tasks today", "what task", "task to work on", "overdue", "stalled", "impediment",
                "highest leverage", "daily focus", "eod", "urgent tasks", "work sequence"
            ]

            PLAN_TRIGGERS = [
                "what changed", "what's changed", "changed today", "recent change", "scope change",
                "scope drift", "new requirement", "requirement shift", "contract drift", "added",
                "mandate", "in scope", "out of scope", "changed", "requirements", "plan",
                "milestone", "planning", "delivery plan", "work plan", "re-plan", "replan",
                "reassess", "definition of done", "dod", "success criteria", "target outcome",
                "outcome goals", "signoff criteria", "roadmap", "phasing", "break down"
            ]

            KNOW_TRIGGERS = [
                "cutover", "cutover window", "spec", "specification", "architecture", "encryption",
                "database", "schema", "erd", "runbook", "rollback", "debezium", "cdc", "kafka",
                "how does", "what is the", "policy", "security standard", "documentation",
                "technical", "search docs", "in the transcript", "meeting notes", "uploaded doc",
                "prerequisites", "specs"
            ]

            multi_word_hits = len([w for w in ["changed", "blocking", "customer", "next", "spec", "update", "plan", "support"] if w in q_lower])

            if any(term in q_lower for term in MULTI_AGENT_TRIGGERS) or multi_word_hits >= 3:
                intent = "MULTI_AGENT"
            elif any(term in q_lower for term in SUPPORT_TRIGGERS):
                intent = "SUPPORT"
            elif any(term in q_lower for term in DELIVER_TRIGGERS):
                intent = "DELIVER"
            elif any(term in q_lower for term in MOVE_TRIGGERS):
                intent = "MOVE"
            elif any(term in q_lower for term in PLAN_TRIGGERS):
                intent = "PLAN"
            elif any(term in q_lower for term in KNOW_TRIGGERS):
                intent = "KNOW"
            elif multi_word_hits >= 2:
                intent = "MULTI_AGENT"
            else:
                intent = "KNOW"

        capabilities_used = [intent] if intent != "MULTI_AGENT" else ["PLAN", "MOVE", "KNOW", "DELIVER", "SUPPORT"]
        sources: List[SourceCitation] = []
        customer_update_draft: Optional[CustomerUpdateDraft] = None
        answer = ""

        # 4. Handover to Relevant Specialist Agent & Context-Aware Execution

        if intent in ("PLAN", "UNDERSTAND"):
            handover_banner = "🎯 **[Handed over to PLAN Agent — Planning & Delivery Intelligence]**\n\n"

            llm_response = None
            if groq_service.is_configured() or is_live_inference_enabled():
                plan_prompt = (
                    f"You are the CalmWork PLAN Agent, the planning and delivery-intelligence specialist for Forward-Deployed Engineers.\n\n"
                    f"{time_rule}\n\n"
                    f"Engagement Context:\n"
                    f"- Customer: {customer_name} ({engagement_id})\n"
                    f"- Current Work Cycle: {current_work_cycle}\n"
                    f"- Status: {status}\n"
                    f"- Outcome Version {version}: \"{outcome_statement}\"\n"
                    f"- Progress: {engagement_progress}% ({len(completed_crits)}/{total_crits} criteria completed)\n\n"
                    f"Success Criteria (Outcome Goals):\n{crit_formatted}\n\n"
                    f"Active Work Plan Tasks (Target Due Dates in IST):\n{tasks_formatted}\n\n"
                    f"Recent Timeline Events & Worknotes (All in IST):\n{timeline_formatted}\n\n"
                    f"User Query: \"{sanitized_query}\"\n\n"
                    f"Provide a concise, direct, professional response answering the user's question with full context of delivery milestones, recent timeline events, worknotes, and whether current work remains strictly within approved scope. Ensure any dates or times mentioned are strictly in IST 24h format. Format with clean Markdown (do not use raw HTML like <br> tags)."
                )
                try:
                    llm_response = groq_service.generate_chat_completion(
                        prompt=plan_prompt,
                        system_instruction="You are the CalmWork PLAN Agent. Respond concisely and professionally using clean Markdown. Avoid raw HTML tags. Keep all timestamps strictly in IST 24-hour clock notation.",
                        max_tokens=1000
                    )
                except Exception as e:
                    logger.debug(f"PLAN LLM call fallback: {e}")

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

        elif intent == "SUPPORT":
            handover_banner = "🛠️ **[Handed over to SUPPORT Agent — Production Support & Screenshot Intelligence]**\n\n"
            support_result = self.support_agent.investigate_incident(
                engagement_id=engagement_id,
                customer_name=customer_name,
                issue_description=sanitized_query
            )
            parts = [
                f"**Incident Triage**: `{support_result.severity}` Severity\n",
                f"**Summary**: {support_result.summary}\n",
                f"**Root Cause Hypothesis**: {support_result.root_cause_hypothesis}\n",
                f"**Affected Components**: {', '.join(support_result.affected_components) if support_result.affected_components else 'Core Services'}\n"
            ]
            if support_result.suggested_workaround:
                parts.append(f"**Suggested Workaround**: {support_result.suggested_workaround}\n")
            if support_result.runbook_recommendations:
                parts.append("**Recommended Runbook Actions**:")
                for r in support_result.runbook_recommendations:
                    parts.append(f"- {r}")
            if support_result.visual_diagnostic_findings:
                parts.append(f"\n**Visual Diagnostic Findings**: {support_result.visual_diagnostic_findings}")
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
                        system_instruction="You are the CalmWork MOVE Agent. Provide high-clarity operational guidance. Format using clean Markdown without raw HTML tags like <br>. Finish all sentences and tables cleanly. Keep all timestamps and deadlines strictly in IST 24-hour clock notation.",
                        max_tokens=1200
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

            try:
                customer_update_draft = self.deliver_agent.generate_customer_update(
                    engagement_id=engagement_id,
                    customer_name=customer_name,
                    engagement_name=customer_name,
                    outcome_statement=outcome_statement,
                    success_criteria=crit_items,
                    current_work_cycle=current_work_cycle
                )
            except Exception as e:
                logger.warning(f"DELIVER Agent draft generation error: {e}")
                customer_update_draft = CustomerUpdateDraft(
                    engagement_id=engagement_id,
                    customer_name=customer_name,
                    format_type="EXECUTIVE_SUMMARY",
                    subject=f"Customer Update: {customer_name}",
                    executive_summary=f"Engineering progress update for {customer_name}. Core delivery objectives for {current_work_cycle} are on track.",
                    key_milestones_achieved=[c.get("title", "") for c in crit_items if c.get("completed")] or ["Project delivery milestone achieved according to specifications"],
                    next_milestone_target="Next milestone target scheduled for review.",
                    customer_action_items=["Review milestone outcomes and provide confirmation."],
                    status="DRAFT",
                    generated_at=datetime.now(IST_TZ).isoformat(),
                    privacy_scrubbed=True,
                    approval_required=True
                )

            parts = [
                f"### {customer_update_draft.subject}\n",
                f"**Executive Summary**:\n{customer_update_draft.executive_summary}\n",
                "**Key Milestones Achieved**:"
            ]
            for m in customer_update_draft.key_milestones_achieved:
                parts.append(f"- {m}")
            parts.append(f"\n**Next Milestone Target**: {customer_update_draft.next_milestone_target}")
            if customer_update_draft.customer_action_items:
                parts.append("\n**Customer Action Items**:")
                for a in customer_update_draft.customer_action_items:
                    parts.append(f"- {a}")
            parts.append("\n*Note: Customer updates can be modified and submitted for Manager approval. Once approved, the report can be downloaded by either the Manager or FDE.*")
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
                f"**1. Scope & Requirements (PLAN)**:",
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
        if intent in ("PLAN", "UNDERSTAND"):
            suggested_followups = [
                "What success criteria are still incomplete?",
                "Reassess plan with recent evidence",
                "What should I do next?"
            ]
        elif intent == "SUPPORT":
            suggested_followups = [
                "Investigate error logs and stack traces",
                "Search technical runbooks with KNOW",
                "What is the recommended next action?"
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
            "PLAN": DelegatedAgentInfo(
                id="PLAN",
                name="PLAN Agent",
                role="Planning & Delivery Intelligence",
                badge_label="Planning & Delivery Specialist",
                color="purple"
            ),
            "UNDERSTAND": DelegatedAgentInfo(
                id="PLAN",
                name="PLAN Agent",
                role="Planning & Delivery Intelligence",
                badge_label="Planning & Delivery Specialist",
                color="purple"
            ),
            "SUPPORT": DelegatedAgentInfo(
                id="SUPPORT",
                name="SUPPORT Agent",
                role="Production Support & Screenshot Intelligence",
                badge_label="Incident & Diagnostic Specialist",
                color="emerald"
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
                name="CalmWork Supervisor",
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
            customer_update=customer_update_draft,
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
        2. PLAN -> Outcome changes & scope risks
        3. KNOW -> Guided retrieval of evidence & history based on PLAN findings
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
        # STEP 1: Invoke PLAN Agent (Identify Outcome & Scope Drift)
        # -------------------------------------------------------------
        if progress_callback:
            progress_callback({
                "type": "progress",
                "agent": "PLAN",
                "stage": "SCOPE_ANALYSIS",
                "message": "PLAN Agent analyzing requirement changes & scope drift...",
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

        plan_findings = None
        try:
            crit_titles = [c.get("title", "") if isinstance(c, dict) else str(c) for c in (success_criteria or [])]
            plan_findings = self.plan_agent.analyze_change(
                raw_change_text=raw_change,
                current_outcome_statement=outcome_statement or f"Deliver active outcome for {customer_name}.",
                current_success_criteria=crit_titles
            )
        except Exception as e:
            logger.warning(f"PLAN agent execution warning in Morning Brief: {str(e)}")
            warnings.append("PLAN analysis completed with partial scope evidence.")

        # -------------------------------------------------------------
        # STEP 2: Invoke KNOW Agent (Guided RAG Retrieval using PLAN findings)
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
            capabilities_invoked=["PLAN", "KNOW", "MOVE", "SUPERVISOR"],
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
        Runs Supervisor orchestration across all agents for complete 360-degree synthesis.
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
                agent_name="PLAN",
                role_description="Planning & Delivery Intelligence",
                status="RECOMMENDATION_PENDING" if status == "NEEDS_REASSESSMENT" else "ACTIVE",
                last_output_summary="Evaluates requirement changes and structured delivery milestones."
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
            ),
            AgentStatusSummary(
                agent_name="SUPPORT",
                role_description="Production Support & Screenshot Intelligence",
                status="ACTIVE",
                last_output_summary="Triages production incidents and diagnoses visual screenshot errors."
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
        Supervisor Work Planning Orchestration:
        Delegates exclusively to dedicated PLAN Agent without duplicating planning logic.
        """
        return self.plan_agent.generate_natural_language_work_plan(
            engagement_id=engagement_id,
            customer_name=customer_name,
            natural_language_description=natural_language_description,
            existing_plan_edits=existing_plan_edits,
            current_outcome_statement=current_outcome_statement,
            current_success_criteria=current_success_criteria,
            session_id=session_id,
            progress_callback=progress_callback
        )



