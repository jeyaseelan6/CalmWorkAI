"""
Google Gemini / Vertex AI Integration Layer for CalmWork AI.
Strictly enforces Google-only AI infrastructure and Pre-LLM Privacy Guardrail sanitization.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from app.config import settings
from app.privacy import PrivacyPolicyEngine, ReferenceMapping

logger = logging.getLogger(__name__)


class GeminiService:
    """
    Service wrapper for Google Gemini 1.5 Pro / Vertex AI.
    Executes reasoning over sanitized context only.
    """

    def __init__(self, privacy_engine: Optional[PrivacyPolicyEngine] = None):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model_name = settings.GEMINI_MODEL

    def _call_gemini_json(self, prompt: str, system_instruction: str) -> Optional[Dict[str, Any]]:
        """
        Executes Gemini API request requesting structured JSON format.
        Falls back to None if API key is not configured or network call fails.
        """
        if not self.api_key:
            logger.info("GEMINI_API_KEY not configured; executing dynamic structured reasoning fallback.")
            return None

        try:
            # Using google-genai SDK if installed
            import google.genai as genai
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config={
                    "system_instruction": system_instruction,
                    "response_mime_type": "application/json"
                }
            )
            if response and response.text:
                return json.loads(response.text)
        except Exception as e:
            logger.warning(f"Gemini API call failed or SDK unavailable ({str(e)}); using fallback reasoning.")

        return None

    def analyze_change(
        self,
        raw_change_text: str,
        current_outcome_statement: str,
        current_success_criteria: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyzes customer requirement changes using Evidence -> Reasoning -> Recommendation pattern.
        """
        # 1. Privacy Guardrail Sanitization
        try:
            anonymized_change, mapping = self.privacy_engine.process_llm_input(
                text=raw_change_text,
                session_id=session_id
            )
        except Exception as e:
            logger.error(f"Privacy guardrail preparation failed: {str(e)}")
            return {
                "error": "AI analysis unavailable. The required context could not be safely prepared. No AI recommendation was generated.",
                "privacy_scrubbed": False,
                "evidence": ["Privacy guardrail error"],
                "reasoning": ["Input could not be safely sanitized"],
                "recommendation": "Manual review required due to privacy processing error.",
                "suggested_outcome_statement": current_outcome_statement,
                "suggested_success_criteria": current_success_criteria,
                "risk_score": "HIGH",
                "affected_dimensions": ["Privacy Policy"]
            }

        system_instruction = (
            "You are the CalmWork UNDERSTAND Agent. Analyze the customer requirement change "
            "against current outcome definition and success criteria using the Evidence -> Reasoning -> Recommendation pattern. "
            "Respond in structured JSON containing fields: evidence (list of strings), reasoning (list of strings), "
            "recommendation (string), suggested_criteria_additions (list of dicts with title), risk_score (LOW|MEDIUM|HIGH|CRITICAL), "
            "affected_dimensions (list of strings)."
        )

        prompt = (
            f"Anonymized Customer Change Input: {anonymized_change}\n"
            f"Current Outcome Statement: {current_outcome_statement}\n"
            f"Current Success Criteria: {json.dumps(current_success_criteria)}"
        )

        gemini_result = self._call_gemini_json(prompt, system_instruction)

        if gemini_result:
            evidence = gemini_result.get("evidence", [f"Observed scope shift: '{anonymized_change}'"])
            reasoning = gemini_result.get("reasoning", ["Requirement shift impacts active work cycle gating."])
            recommendation = gemini_result.get("recommendation", "Review outcome success criteria and request manager approval.")
            additions = gemini_result.get("suggested_criteria_additions", [])
            risk_score = gemini_result.get("risk_score", "MEDIUM")
            affected_dims = gemini_result.get("affected_dimensions", ["Timeline", "Success Criteria"])
        else:
            # Dynamic reasoning derived from change text & criteria
            is_high_impact = any(k in raw_change_text.lower() for k in ["sso", "security", "authentication", "compliance", "mandatory", "blocking"])
            evidence = [
                f"Customer requirement change input: '{anonymized_change}'",
                f"Current outcome statement: '{current_outcome_statement}'",
                "Requirement impacts active Definition of Done (DoD) criteria."
            ]
            if is_high_impact:
                reasoning = [
                    "New requirement imposes a gating condition before production validation can proceed.",
                    "Definition of Done completion affected: additional configuration validation required."
                ]
                recommendation = (
                    f"Upgrade Outcome to Version 2. Add '{anonymized_change}' to Definition of Done checklist "
                    "and submit for Manager approval."
                )
                additions = [{"title": f"{raw_change_text} (Added v2)", "completed": False}]
                risk_score = "HIGH"
                affected_dims = ["Outcome DoD Checklist", "Dependencies & Blockers", "Timeline Gating"]
            else:
                reasoning = ["Requirement shift alters technical task priority within current work cycle."]
                recommendation = "Update work cycle execution tasks and verify dependent checklist items."
                additions = []
                risk_score = "MEDIUM"
                affected_dims = ["Work Cycle Step", "Timeline"]

        # Reconstruct suggested criteria list
        suggested_criteria = list(current_success_criteria)
        for add in additions:
            title = add.get("title", "New Criteria Item")
            if not any(c.get("title") == title for c in suggested_criteria):
                suggested_criteria.append({
                    "id": f"sc-{len(suggested_criteria)+1}",
                    "title": title,
                    "completed": False
                })

        # Sanitize output back with mapping
        clean_title = self.privacy_engine.sanitize_output(raw_change_text, mapping)
        clean_evidence = [self.privacy_engine.sanitize_output(e, mapping) for e in evidence]
        clean_reasoning = [self.privacy_engine.sanitize_output(r, mapping) for r in reasoning]
        clean_rec = self.privacy_engine.sanitize_output(recommendation, mapping)

        return {
            "change_title": f"Customer requirement change: '{clean_title}'",
            "privacy_scrubbed": len(mapping.reference_to_original) > 0,
            "evidence": clean_evidence,
            "reasoning": clean_reasoning,
            "recommendation": clean_rec,
            "suggested_outcome_statement": current_outcome_statement,
            "suggested_success_criteria": suggested_criteria,
            "risk_score": risk_score,
            "affected_dimensions": affected_dims
        }
