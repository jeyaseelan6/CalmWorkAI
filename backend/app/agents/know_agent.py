from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import json
import logging

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import BaseSessionService

from app.config import settings
from app.knowledge import IngestionEngine, VectorStore, DocumentChunk
from app.privacy import PrivacyPolicyEngine
from app.ai.groq_service import groq_service
from app.agents.adk_runtime import (
    get_adk_model,
    get_session_service,
    create_privacy_guardrail_callback,
    create_adk_runner,
    execute_adk_runner,
    is_live_inference_enabled,
    _MOCK_ADK_RESPONSES
)

logger = logging.getLogger(__name__)

IST_TZ = timezone(timedelta(hours=5, minutes=30))


def format_ist_timestamp(dt: Any) -> str:
    """Formats any datetime or ISO string to standard IST 24-hour format."""
    if isinstance(dt, datetime):
        dt_ist = dt.replace(tzinfo=timezone.utc).astimezone(IST_TZ) if dt.tzinfo is None else dt.astimezone(IST_TZ)
        return dt_ist.strftime("%d %b %Y, %H:%M IST")
    elif isinstance(dt, str) and dt:
        try:
            parsed_dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            dt_ist = parsed_dt.replace(tzinfo=timezone.utc).astimezone(IST_TZ) if parsed_dt.tzinfo is None else parsed_dt.astimezone(IST_TZ)
            return dt_ist.strftime("%d %b %Y, %H:%M IST")
        except Exception:
            return str(dt)[:16]
    return str(dt)[:16] if dt else ""


def calculate_token_relevance(text: str, query_tokens: set) -> float:
    """Computes lexical token overlap relevance score."""
    if not text or not query_tokens:
        return 0.0
    text_words = set(w.lower() for w in text.replace("-", " ").replace("_", " ").split() if len(w) > 2)
    overlap = query_tokens.intersection(text_words)
    return len(overlap) / max(len(query_tokens), 1)


class GroundedCitation(BaseModel):
    document_title: str
    chunk_id: str
    snippet: str
    relevance_score: float
    source_type: str = "DOCUMENT"  # "DOCUMENT" | "WORKNOTE" | "CUSTOMER_INPUT" | "DECISION" | "OBSERVATION" | "TIMELINE" | "OUTCOME" | "WORK_PLAN"


class GroundedAnswer(BaseModel):
    question: str
    answer: str
    citations: List[GroundedCitation]
    confidence_score: float
    tenant_isolated: bool = True
    privacy_scrubbed: bool = True
    evidence_sufficient: bool = True

    @property
    def verified_evidence_found(self) -> bool:
        """Alias for backward compatibility."""
        return self.evidence_sufficient


KNOW_INSTRUCTION = (
    "You are the CalmWork KNOW Agent. You synthesize concise, authoritative, factual answers "
    "based STRICTLY on verified engagement evidence.\n"
    "EVIDENCE HIERARCHY:\n"
    "1. Primary: Use Uploaded Technical Documents for architecture, specs, runbooks, schemas, and configurations.\n"
    "2. Secondary: Use Verified Engagement Operational Context for worknotes, customer inputs, decisions, observations, outcomes, and work plan tasks.\n"
    "RULES:\n"
    "- Do NOT hallucinate or assume details not present in the evidence.\n"
    "- Keep all dates and hours strictly in Indian Standard Time (IST) 24-hour clock notation (e.g. '14 Oct 2026, 16:30 IST').\n"
    "- Attribute facts to their verified sources.\n"
    "- If the evidence does not contain enough facts to answer, reply exactly with: "
    "'I don't have enough verified engagement evidence to answer this confidently.'"
)


class KnowAgent:
    """
    KNOW Agent: Google ADK-powered grounded Q&A engine over engagement documentation,
    customer specs, and architecture notes using tenant-isolated vector retrieval.
    Now extended with Two-Tier Context-Aware Retrieval over live engagement records
    (worknotes, customer inputs, decisions, observations, timeline, outcomes, and work plans).
    """

    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        ingestion_engine: Optional[IngestionEngine] = None,
        privacy_engine: Optional[PrivacyPolicyEngine] = None,
        session_service: Optional[BaseSessionService] = None,
        gemini_service: Optional[Any] = None  # retained for backward compatibility
    ):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.ingestion_engine = ingestion_engine or IngestionEngine(privacy_engine=self.privacy_engine)
        self.vector_store = vector_store or VectorStore()
        self.session_service = session_service or get_session_service()
        self.model = get_adk_model()

        # Build genuine Google ADK Agent
        self.adk_agent = Agent(
            name="know_agent",
            description="Performs tenant-isolated grounded retrieval and question answering strictly backed by engagement documentation and operational context.",
            model=self.model,
            instruction=KNOW_INSTRUCTION,
            before_model_callback=create_privacy_guardrail_callback(self.privacy_engine)
        )

        # ADK Runner for standalone execution
        self.runner = create_adk_runner(
            agent=self.adk_agent,
            session_service=self.session_service,
            app_name=settings.ADK_APP_NAME
        )

    def ingest_document(
        self,
        engagement_id: str,
        title: str,
        raw_text: str
    ) -> Dict[str, Any]:
        """Ingests a document into the tenant vector index."""
        chunks = self.ingestion_engine.process_document(
            engagement_id=engagement_id,
            title=title,
            raw_text=raw_text
        )
        total_chunks = self.vector_store.add_chunks(engagement_id, chunks)
        return {
            "engagement_id": engagement_id,
            "document_title": title,
            "chunks_created": len(chunks),
            "total_tenant_chunks": total_chunks
        }

    def answer_question(
        self,
        engagement_id: str,
        raw_question: str,
        top_k: int = 3,
        engagement_context: Optional[Dict[str, Any]] = None
    ) -> GroundedAnswer:
        """
        Answers user questions using Two-Tier Grounded Retrieval:
        Tier 1 (Primary): Uploaded technical documentation via tenant vector search.
        Tier 2 (Operational): Live engagement context (worknotes, customer inputs, decisions,
                              observations, timeline, outcomes, work plans).
        Enforces IST 24h clock, privacy anonymization, and zero-hallucination guardrail.
        """
        # 1. Privacy Guardrail Anonymization on incoming question
        anonymized_question, mapping = self.privacy_engine.process_llm_input(
            text=raw_question,
            session_id=engagement_id
        )
        q_lower = anonymized_question.lower()
        q_tokens = set(w for w in q_lower.replace("?", " ").replace(".", " ").replace(",", " ").replace(":", " ").split() if len(w) > 2)

        # -----------------------------------------------------------------
        # TIER 1: Vector Search over Uploaded Resources (Prioritized First)
        # -----------------------------------------------------------------
        search_results = self.vector_store.search(
            engagement_id=engagement_id,
            query=anonymized_question,
            top_k=top_k
        )
        valid_doc_results = [r for r in search_results if r[1] >= 0.15] if search_results else []

        # -----------------------------------------------------------------
        # TIER 2: Live Engagement Operational Context Extraction
        # -----------------------------------------------------------------
        matching_worknotes: List[Dict[str, Any]] = []
        matching_customer_inputs: List[Dict[str, Any]] = []
        matching_decisions: List[Dict[str, Any]] = []
        matching_observations: List[Dict[str, Any]] = []
        matching_tasks: List[Dict[str, Any]] = []
        matching_outcome: Optional[Dict[str, Any]] = None
        matching_timeline: List[Dict[str, Any]] = []

        context_has_evidence = False

        if engagement_context:
            events = engagement_context.get("timeline_events") or []
            outcome_stmt = engagement_context.get("outcome_statement") or ""
            success_criteria = engagement_context.get("success_criteria") or []
            outcome_version = engagement_context.get("outcome_version") or 1
            approved_work_plan = engagement_context.get("approved_work_plan") or {}
            pending_approvals = engagement_context.get("pending_approvals") or []

            # 2a. Categorize and evaluate timeline events
            for i, ev in enumerate(events):
                ev_id = getattr(ev, "id", None) or (ev.get("id") if isinstance(ev, dict) else f"evt-{i}")
                ev_type = (getattr(ev, "event_type", None) or (ev.get("event_type") if isinstance(ev, dict) else "TIMELINE")).upper()
                ev_title = getattr(ev, "title", None) or (ev.get("title") if isinstance(ev, dict) else "")
                ev_desc = getattr(ev, "description", None) or (ev.get("description") if isinstance(ev, dict) else "")
                ev_actor = getattr(ev, "actor_type", None) or (ev.get("actor_type") if isinstance(ev, dict) else "USER")
                ev_dt = getattr(ev, "created_at", None) or (ev.get("created_at") if isinstance(ev, dict) else None)
                ev_ist = format_ist_timestamp(ev_dt)

                full_text = f"{ev_title} {ev_desc}"
                relevance = calculate_token_relevance(full_text, q_tokens)

                # Domain query boosts
                is_decision = ev_type in ["DECISION", "ARCHITECTURAL_DECISION", "APPROVAL_DECISION", "SIGN_OFF"] or "decision" in ev_title.lower() or "approv" in ev_title.lower()
                is_customer = ev_type in ["CUSTOMER_INPUT", "CLIENT_FEEDBACK", "CLIENT_REQUEST", "CUSTOMER_NOTE", "REQUIREMENT_UPDATE"] or "customer" in ev_title.lower() or "client" in ev_title.lower()
                is_worknote = ev_type in ["WORKNOTE", "ENGINEERING_LOG", "DEV_UPDATE", "NOTE"] or "worknote" in ev_title.lower() or "note" in ev_title.lower()
                is_observation = ev_type in ["OBSERVATION", "SYSTEM_OBSERVATION", "FINDING", "BLOCKER_OBSERVED"] or "observation" in ev_title.lower() or "observed" in ev_title.lower()

                # Check if question explicitly targets this category
                category_requested = False
                if is_decision and any(w in q_lower for w in ["decision", "decide", "approved", "signoff", "choice", "tradeoff", "agreed"]):
                    category_requested = True
                    relevance = max(relevance, 0.40)
                elif is_customer and any(w in q_lower for w in ["customer", "client", "input", "feedback", "request", "asked", "mandate"]):
                    category_requested = True
                    relevance = max(relevance, 0.40)
                elif is_worknote and any(w in q_lower for w in ["worknote", "work note", "note", "logged", "engineer", "fde", "dev log"]):
                    category_requested = True
                    relevance = max(relevance, 0.40)
                elif is_observation and any(w in q_lower for w in ["observation", "observe", "finding", "test", "metric", "latency", "failure"]):
                    category_requested = True
                    relevance = max(relevance, 0.40)

                item_payload = {
                    "id": ev_id,
                    "type": ev_type,
                    "title": ev_title,
                    "description": ev_desc,
                    "actor": ev_actor,
                    "ist_time": ev_ist,
                    "score": round(max(relevance, 0.20 if category_requested else 0.0), 3)
                }

                if relevance >= 0.15 or category_requested:
                    context_has_evidence = True
                    if is_decision:
                        matching_decisions.append(item_payload)
                    elif is_customer:
                        matching_customer_inputs.append(item_payload)
                    elif is_worknote:
                        matching_worknotes.append(item_payload)
                    elif is_observation:
                        matching_observations.append(item_payload)
                    else:
                        matching_timeline.append(item_payload)
                elif len(events) <= 6 and (not valid_doc_results) and any(w in q_lower for w in ["history", "timeline", "event", "happened", "status", "context"]):
                    # General historical query when no docs exist
                    context_has_evidence = True
                    matching_timeline.append(item_payload)

            # 2b. Evaluate Decisions & Pending Approvals
            for a in pending_approvals:
                a_type = getattr(a, "type", None) or (a.get("type") if isinstance(a, dict) else "APPROVAL")
                a_req = getattr(a, "requested_by", None) or (a.get("requested_by") if isinstance(a, dict) else "FDE")
                a_desc = getattr(a, "description", None) or (a.get("description") if isinstance(a, dict) else f"{a_type} pending Manager approval")
                a_id = getattr(a, "id", None) or (a.get("id") if isinstance(a, dict) else "appr-pending")
                a_dt = getattr(a, "created_at", None) or (a.get("created_at") if isinstance(a, dict) else None)
                a_ist = format_ist_timestamp(a_dt)
                a_relevance = calculate_token_relevance(f"{a_type} {a_desc}", q_tokens)
                if any(w in q_lower for w in ["approval", "approve", "pending", "gate", "blocker"]):
                    a_relevance = max(a_relevance, 0.50)
                if a_relevance >= 0.15:
                    context_has_evidence = True
                    matching_decisions.append({
                        "id": a_id,
                        "type": "PENDING_APPROVAL",
                        "title": f"Pending Gate: {a_type}",
                        "description": f"{a_desc} (Requested by {a_req})",
                        "actor": a_req,
                        "ist_time": a_ist,
                        "score": round(a_relevance, 3)
                    })

            # 2c. Evaluate Outcome & Definition of Done
            if outcome_stmt or success_criteria:
                crit_lines = []
                for c in success_criteria:
                    if isinstance(c, dict):
                        crit_lines.append(f"- [{'x' if c.get('completed') else ' '}] {c.get('title', 'Criterion')}")
                    else:
                        crit_lines.append(f"- [ ] {str(c)}")
                full_outcome_text = f"Outcome Version {outcome_version}: {outcome_stmt}\nDefinition of Done:\n" + "\n".join(crit_lines)
                outcome_rel = calculate_token_relevance(full_outcome_text, q_tokens)
                if any(w in q_lower for w in ["outcome", "goal", "objective", "definition of done", "dod", "criteria", "success", "scope"]):
                    outcome_rel = max(outcome_rel, 0.50)
                if outcome_rel >= 0.15:
                    context_has_evidence = True
                    matching_outcome = {
                        "id": f"outcome-v{outcome_version}",
                        "text": full_outcome_text,
                        "snippet": f"Outcome (v{outcome_version}): {outcome_stmt[:160]}",
                        "score": round(outcome_rel, 3)
                    }

            # 2d. Evaluate Work Plan & Tasks
            wp_tasks = approved_work_plan.get("tasks", []) if isinstance(approved_work_plan, dict) else []
            for t in wp_tasks:
                if isinstance(t, dict):
                    t_id = t.get("id", "task")
                    t_title = t.get("title", "")
                    t_desc = t.get("description", "")
                    t_status = t.get("status", "TODO")
                    t_owner = t.get("owner", "Unassigned")
                    t_due = t.get("due_date", "Unscheduled")
                    t_rel = calculate_token_relevance(f"{t_title} {t_desc} {t_owner}", q_tokens)
                    if any(w in q_lower for w in ["task", "work plan", "workplan", "milestone", "assigned", "owner", "due date", "todo"]):
                        t_rel = max(t_rel, 0.35)
                    if t_rel >= 0.15:
                        context_has_evidence = True
                        matching_tasks.append({
                            "id": t_id,
                            "title": t_title,
                            "description": t_desc,
                            "status": t_status,
                            "owner": t_owner,
                            "due_date": t_due,
                            "score": round(t_rel, 3)
                        })

        # -----------------------------------------------------------------
        # INSUFFICIENT EVIDENCE GUARDRAIL
        # If neither Tier 1 documents nor Tier 2 engagement context have facts:
        # -----------------------------------------------------------------
        if not valid_doc_results and not context_has_evidence:
            return GroundedAnswer(
                question=raw_question,
                answer="I don't have enough verified engagement evidence to answer this confidently.",
                citations=[],
                confidence_score=0.0,
                tenant_isolated=True,
                privacy_scrubbed=len(mapping.reference_to_original) > 0,
                evidence_sufficient=False
            )

        # -----------------------------------------------------------------
        # TIER SYNTHESIS: Build Grounded Evidence & Multi-Source Citations
        # -----------------------------------------------------------------
        evidence_sections: List[str] = []
        citations: List[GroundedCitation] = []

        # 1. Primary: Uploaded Document Chunks
        if valid_doc_results:
            doc_lines = []
            for chunk, score in valid_doc_results:
                clean_snippet = self.privacy_engine.sanitize_output(chunk.content[:240], mapping)
                citations.append(GroundedCitation(
                    document_title=chunk.title,
                    chunk_id=chunk.chunk_id,
                    snippet=clean_snippet + ("..." if len(chunk.content) > 240 else ""),
                    relevance_score=round(score, 3),
                    source_type="DOCUMENT"
                ))
                doc_lines.append(f"Source Document: \"{chunk.title}\"\n{chunk.content}")
            evidence_sections.append("### PRIMARY EVIDENCE — UPLOADED TECHNICAL DOCUMENTS:\n" + "\n---\n".join(doc_lines))

        # 2. Secondary: Live Engagement Operational Context
        if matching_worknotes:
            wn_lines = []
            for w in matching_worknotes[:5]:
                clean_desc = self.privacy_engine.sanitize_output(w["description"], mapping)
                wn_lines.append(f"- [{w['ist_time']}] {w['title']}: {clean_desc} (Logged by {w['actor']})")
                citations.append(GroundedCitation(
                    document_title=f"Worknote: {w['title']}",
                    chunk_id=w["id"],
                    snippet=clean_desc[:200],
                    relevance_score=w["score"],
                    source_type="WORKNOTE"
                ))
            evidence_sections.append("### VERIFIED WORKNOTES & DEV LOGS (IST 24h):\n" + "\n".join(wn_lines))

        if matching_customer_inputs:
            ci_lines = []
            for c in matching_customer_inputs[:5]:
                clean_desc = self.privacy_engine.sanitize_output(c["description"], mapping)
                ci_lines.append(f"- [{c['ist_time']}] {c['title']}: {clean_desc}")
                citations.append(GroundedCitation(
                    document_title=f"Customer Input: {c['title']}",
                    chunk_id=c["id"],
                    snippet=clean_desc[:200],
                    relevance_score=c["score"],
                    source_type="CUSTOMER_INPUT"
                ))
            evidence_sections.append("### VERIFIED CUSTOMER INPUTS & FEEDBACK (IST 24h):\n" + "\n".join(ci_lines))

        if matching_decisions:
            dec_lines = []
            for d in matching_decisions[:5]:
                clean_desc = self.privacy_engine.sanitize_output(d["description"], mapping)
                dec_lines.append(f"- [{d['ist_time']}] {d['title']}: {clean_desc}")
                citations.append(GroundedCitation(
                    document_title=f"Decision: {d['title']}",
                    chunk_id=d["id"],
                    snippet=clean_desc[:200],
                    relevance_score=d["score"],
                    source_type="DECISION"
                ))
            evidence_sections.append("### VERIFIED DECISIONS & APPROVALS (IST 24h):\n" + "\n".join(dec_lines))

        if matching_observations:
            obs_lines = []
            for o in matching_observations[:5]:
                clean_desc = self.privacy_engine.sanitize_output(o["description"], mapping)
                obs_lines.append(f"- [{o['ist_time']}] {o['title']}: {clean_desc}")
                citations.append(GroundedCitation(
                    document_title=f"Observation: {o['title']}",
                    chunk_id=o["id"],
                    snippet=clean_desc[:200],
                    relevance_score=o["score"],
                    source_type="OBSERVATION"
                ))
            evidence_sections.append("### VERIFIED OPERATIONAL OBSERVATIONS (IST 24h):\n" + "\n".join(obs_lines))

        if matching_outcome:
            clean_outcome = self.privacy_engine.sanitize_output(matching_outcome["text"], mapping)
            evidence_sections.append("### TARGET OUTCOME & DEFINITION OF DONE:\n" + clean_outcome)
            citations.append(GroundedCitation(
                document_title="Target Outcome & Definition of Done",
                chunk_id=matching_outcome["id"],
                snippet=matching_outcome["snippet"],
                relevance_score=matching_outcome["score"],
                source_type="OUTCOME"
            ))

        if matching_tasks:
            wp_lines = []
            for t in matching_tasks[:6]:
                clean_desc = self.privacy_engine.sanitize_output(t["description"], mapping)
                wp_lines.append(f"- [{t['status']}] {t['title']} (Owner: {t['owner']}, Due: {t['due_date']}): {clean_desc}")
                citations.append(GroundedCitation(
                    document_title=f"Work Plan Task: {t['title']}",
                    chunk_id=t["id"],
                    snippet=f"[{t['status']}] {clean_desc[:140]} (Owner: {t['owner']}, Due: {t['due_date']})",
                    relevance_score=t["score"],
                    source_type="WORK_PLAN"
                ))
            evidence_sections.append("### APPROVED WORK PLAN & TASKS:\n" + "\n".join(wp_lines))

        if matching_timeline:
            tl_lines = []
            for ev in matching_timeline[:5]:
                clean_desc = self.privacy_engine.sanitize_output(ev["description"], mapping)
                tl_lines.append(f"- [{ev['ist_time']}] ({ev['type']}) {ev['title']}: {clean_desc}")
                citations.append(GroundedCitation(
                    document_title=f"Timeline: {ev['title']}",
                    chunk_id=ev["id"],
                    snippet=clean_desc[:200],
                    relevance_score=ev["score"],
                    source_type="TIMELINE"
                ))
            evidence_sections.append("### HISTORICAL TIMELINE EVENTS (IST 24h):\n" + "\n".join(tl_lines))

        full_evidence_context = "\n\n".join(evidence_sections)
        anonymized_evidence, _ = self.privacy_engine.process_llm_input(
            text=full_evidence_context,
            session_id=engagement_id
        )

        now_ist_str = datetime.now(IST_TZ).strftime("%d %b %Y, %H:%M IST")

        prompt = (
            f"VERIFIED ENGAGEMENT EVIDENCE (Strictly Grounded):\n{anonymized_evidence}\n\n"
            f"MANDATORY GUIDELINES:\n"
            f"- Current Platform Time: {now_ist_str}\n"
            f"- Keep all dates and hours strictly in Indian Standard Time (IST) 24-hour clock notation.\n"
            f"- First and foremost, ground answers in the Uploaded Technical Documents when answering specs, architectures, schemas, or procedures.\n"
            f"- Supplement and answer from the Verified Engagement Context (worknotes, customer inputs, decisions, observations, outcomes, work plans) for execution facts and project history.\n"
            f"- Explicitly attribute facts to their source (e.g. 'According to the Architecture Guide...', 'In the customer input on...', 'Per the decision recorded on...').\n"
            f"- Do NOT hallucinate details not present in the verified evidence above.\n\n"
            f"Question: {anonymized_question}\n"
            f"Answer:"
        )

        # -----------------------------------------------------------------
        # Model Inference with Fallback Layer
        # -----------------------------------------------------------------
        adk_answer = None
        has_credentials = bool(settings.GEMINI_API_KEY or settings.USE_VERTEX_AI or settings.GROQ_API_KEY or _MOCK_ADK_RESPONSES)
        if has_credentials:
            try:
                adk_answer = execute_adk_runner(
                    runner=self.runner,
                    user_id="fde_user",
                    session_id=engagement_id,
                    message_text=prompt,
                    system_instruction=KNOW_INSTRUCTION,
                    json_mode=False
                )
            except Exception as e:
                logger.warning(f"ADK KNOW runner synthesis failed: {str(e)}")

        # GroqService fallback if ADK runner returned None or is not active
        if not adk_answer and is_live_inference_enabled() and groq_service.is_configured():
            try:
                adk_answer = groq_service.generate_chat_completion(
                    prompt=prompt,
                    system_instruction=KNOW_INSTRUCTION,
                    max_tokens=600
                )
            except Exception as ex:
                logger.warning(f"Groq KNOW fallback failed: {ex}")

        if not adk_answer:
            raise RuntimeError(
                "AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
            )

        clean_answer = self.privacy_engine.sanitize_output(adk_answer, mapping)

        top_confidence = 0.85
        if valid_doc_results:
            top_confidence = max(top_confidence, valid_doc_results[0][1] * 1.5)
        top_confidence = min(round(top_confidence, 2), 0.98)

        return GroundedAnswer(
            question=raw_question,
            answer=clean_answer,
            citations=citations,
            confidence_score=top_confidence,
            tenant_isolated=True,
            privacy_scrubbed=len(mapping.reference_to_original) > 0,
            evidence_sufficient=True
        )
