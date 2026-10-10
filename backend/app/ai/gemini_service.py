"""
Google ADK Compatibility Bridge & Migration Adapter.
Deprecates monolithic custom model wrapper in favor of the Google Agent Development Kit (ADK) architecture.
Delegates operations to specialized ADK agents (UNDERSTAND, KNOW, MOVE, DELIVER) without duplicating model logic.
"""

import logging
from typing import Dict, Any, List, Optional
from app.config import settings
from app.privacy import PrivacyPolicyEngine

logger = logging.getLogger(__name__)


class GeminiService:
    """
    Backward-compatibility adapter for legacy GeminiService callers.
    Routes requests to the underlying Google ADK specialized agents rather than bypassing ADK.
    """

    def __init__(self, privacy_engine: Optional[PrivacyPolicyEngine] = None):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL

        # Lazy initialize ADK agents
        from app.agents.understand_agent import UnderstandAgent
        from app.agents.know_agent import KnowAgent
        from app.agents.move_agent import MoveAgent
        from app.agents.deliver_agent import DeliverAgent

        self._understand_agent = UnderstandAgent(privacy_engine=self.privacy_engine)
        self._know_agent = KnowAgent(privacy_engine=self.privacy_engine)
        self._move_agent = MoveAgent(privacy_engine=self.privacy_engine)
        self._deliver_agent = DeliverAgent(privacy_engine=self.privacy_engine)

        logger.info("GeminiService initialized in ADK-delegation mode.")

    def analyze_change(
        self,
        raw_change_text: str,
        current_outcome_statement: str,
        current_success_criteria: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Delegates change analysis to Google ADK UnderstandAgent."""
        result = self._understand_agent.analyze_change(
            raw_change_text=raw_change_text,
            current_outcome_statement=current_outcome_statement,
            current_success_criteria=current_success_criteria,
            session_id=session_id
        )
        return {
            "change_title": result.change_title,
            "privacy_scrubbed": result.privacy_scrubbed,
            "evidence": result.evidence,
            "reasoning": result.reasoning,
            "recommendation": result.recommendation,
            "suggested_outcome_statement": result.suggested_outcome_statement,
            "suggested_success_criteria": result.suggested_success_criteria,
            "risk_score": result.risk_score,
            "affected_dimensions": result.affected_dimensions,
            "confidence": "High",
            "requires_manager_approval": True
        }

    def synthesize_rag_answer(
        self,
        question: str,
        context_chunks: List[str],
        session_id: Optional[str] = None
    ) -> Optional[str]:
        """Delegates answer synthesis to Google ADK KnowAgent."""
        # Use KnowAgent vector search or grounded synthesis
        res = self._know_agent.answer_question(
            engagement_id=session_id or "default",
            raw_question=question,
            top_k=len(context_chunks) if context_chunks else 3
        )
        return res.answer if res.evidence_sufficient else None

    def reason_next_best_action(
        self,
        customer_name: str,
        current_work_cycle: str,
        status: str,
        outcome_statement: str,
        blockers: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Delegates action determination to Google ADK MoveAgent."""
        res = self._move_agent.determine_next_action(
            engagement_id=session_id or "default",
            customer_name=customer_name,
            current_work_cycle=current_work_cycle,
            status=status,
            outcome_version=1,
            blockers=blockers
        )
        return {
            "action_title": res.action_title,
            "situation": res.situation,
            "recommendation": res.recommendation,
            "why_now": res.why_now,
            "impact": res.impact,
            "priority_level": res.priority_level,
            "approval_required": res.approval_required,
            "affected_role": res.affected_role
        }

    def draft_customer_update(
        self,
        customer_name: str,
        engagement_name: str,
        outcome_statement: str,
        current_work_cycle: str,
        completed_milestones: List[str],
        pending_milestones: List[str],
        format_type: str = "EXECUTIVE_SUMMARY",
        raw_notes: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Delegates customer update drafting to Google ADK DeliverAgent."""
        success_criteria = [{"title": m, "completed": True} for m in completed_milestones] + [
            {"title": m, "completed": False} for m in pending_milestones
        ]
        draft = self._deliver_agent.generate_customer_update(
            engagement_id=session_id or "default",
            customer_name=customer_name,
            engagement_name=engagement_name,
            outcome_statement=outcome_statement,
            success_criteria=success_criteria,
            current_work_cycle=current_work_cycle,
            raw_notes=raw_notes,
            format_type=format_type
        )
        return {
            "subject": draft.subject,
            "executive_summary": draft.executive_summary,
            "key_milestones_achieved": draft.key_milestones_achieved,
            "next_milestone_target": draft.next_milestone_target,
            "customer_action_items": draft.customer_action_items
        }
