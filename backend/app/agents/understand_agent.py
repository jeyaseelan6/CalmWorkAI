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
    """

    def __init__(self, privacy_engine: Optional[PrivacyPolicyEngine] = None):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()

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
        # 1. Mandatory Pre-LLM Privacy Boundary Enforcement
        anonymized_input, mapping = self.privacy_engine.process_llm_input(
            text=raw_change_text,
            session_id=session_id
        )

        logger.info(f"UNDERSTAND Agent processing change impact with anonymized input (tokens: {len(mapping.reference_to_original)})")

        # 2. Heuristic / LLM Reasoning Pipeline (Structured output)
        # Deterministic simulation matching domain scenario rules + LLM synthesis
        has_sso = "sso" in raw_change_text.lower() or "single sign-on" in raw_change_text.lower() or "security" in raw_change_text.lower()
        
        if has_sso:
            evidence = [
                f"Customer requirement added: '{anonymized_input}'",
                "Current Outcome v1 success criteria lacks enterprise authentication DoD clause.",
                "Production deployment gated on enterprise security compliance."
            ]
            reasoning = [
                "Adding Enterprise SSO is a mandatory gating requirement for customer IT security sign-off.",
                "DoD completion progress affected: Step 4 (Build Within Real Constraints) requires SSO validation item before Step 5 deployment."
            ]
            recommendation = (
                "Upgrade Outcome to Version 2. Add 'Enterprise SSO configuration & validation' to Definition of Done checklist "
                "and request manager approval for version transition."
            )
            suggested_criteria = list(current_success_criteria)
            suggested_criteria.append({
                "id": f"sc-{len(suggested_criteria)+1}",
                "title": "Enterprise SSO configuration & validation (Added v2)",
                "completed": False
            })
            risk = "HIGH"
            dimensions = ["Outcome DoD Checklist", "Dependencies & Blockers", "Timeline Gating"]
        else:
            evidence = [f"Observed scope shift: '{anonymized_input}'"]
            reasoning = ["Requirement change impacts active work cycle timeline."]
            recommendation = "Review current DoD checklist items and update current engagement work cycle tasks."
            suggested_criteria = list(current_success_criteria)
            risk = "MEDIUM"
            dimensions = ["Work Cycle Step", "Timeline"]

        # Restore human-readable tokens for final client presentation if authorized
        clean_change_title = self.privacy_engine.sanitize_output(raw_change_text, mapping)

        return ChangeImpactAnalysis(
            change_title=f"Customer requirement changed: '{clean_change_title}'",
            privacy_scrubbed=len(mapping.reference_to_original) > 0,
            evidence=[self.privacy_engine.sanitize_output(e, mapping) for e in evidence],
            reasoning=[self.privacy_engine.sanitize_output(r, mapping) for r in reasoning],
            recommendation=self.privacy_engine.sanitize_output(recommendation, mapping),
            suggested_outcome_statement=current_outcome_statement,
            suggested_success_criteria=suggested_criteria,
            risk_score=risk,
            affected_dimensions=dimensions
        )
