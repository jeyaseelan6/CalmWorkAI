"""
UNDERSTAND Agent — Outcome & Change Impact Intelligence.
Analyzes customer requirement changes using Evidence -> Reasoning -> Recommendation pattern,
strictly protected by the pre-LLM AI Input Privacy Guardrail.
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
import logging
from datetime import datetime, timezone

from app.privacy import PrivacyPolicyEngine
from app.ai.gemini_service import GeminiService

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


class UnderstandAgent:
    """
    UNDERSTAND Agent: Evaluates incoming engagement changes, scope shifts,
    and technical constraints against current outcome definitions.
    Does NOT silently modify database state; produces recommendations for Manager approval.
    """

    def __init__(self, privacy_engine: Optional[PrivacyPolicyEngine] = None):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.gemini_service = GeminiService(privacy_engine=self.privacy_engine)

    def analyze_change(
        self,
        raw_change_text: str,
        current_outcome_statement: str,
        current_success_criteria: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> ChangeImpactAnalysis:
        """
        Runs privacy guardrail anonymization and analyzes change impact.
        Returns Evidence -> Reasoning -> Recommendation payload.
        """
        res = self.gemini_service.analyze_change(
            raw_change_text=raw_change_text,
            current_outcome_statement=current_outcome_statement,
            current_success_criteria=current_success_criteria,
            session_id=session_id
        )

        return ChangeImpactAnalysis(
            change_title=res["change_title"],
            privacy_scrubbed=res["privacy_scrubbed"],
            evidence=res["evidence"],
            reasoning=res["reasoning"],
            recommendation=res["recommendation"],
            suggested_outcome_statement=res["suggested_outcome_statement"],
            suggested_success_criteria=res["suggested_success_criteria"],
            risk_score=res["risk_score"],
            affected_dimensions=res["affected_dimensions"]
        )
