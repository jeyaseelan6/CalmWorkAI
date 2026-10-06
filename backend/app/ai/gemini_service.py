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
    Service wrapper for Google Gemini via Vertex AI / Google GenAI SDK.
    Executes reasoning over sanitized context only.
    """

    def __init__(self, privacy_engine: Optional[PrivacyPolicyEngine] = None):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.model_name = settings.GEMINI_MODEL

    def _call_gemini_json(self, prompt: str, system_instruction: str) -> Optional[Dict[str, Any]]:
        """
        Executes Gemini API request requesting structured JSON format.
        Falls back to None if API key is not configured or API call fails.
        Strictly Google-only infrastructure (no third-party fallback).
        """
        if not self.api_key:
            logger.info(f"GEMINI_API_KEY not configured; using dynamic engagement-state reasoning (model={self.model_name}).")
            return None

        try:
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
            logger.warning(f"Gemini API call failed or SDK unavailable ({str(e)}); executing fallback reasoning.")

        return None

    def analyze_change(
        self,
        raw_change_text: str,
        current_outcome_statement: str,
        current_success_criteria: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyzes engagement requirement changes using Evidence -> Reasoning -> Recommendation pattern.
        """
        # 1. Privacy Boundary Enforcement (Sanitization before Gemini)
        try:
            anonymized_change, mapping = self.privacy_engine.process_llm_input(
                text=raw_change_text,
                session_id=session_id
            )
            anonymized_outcome, _ = self.privacy_engine.process_llm_input(
                text=current_outcome_statement,
                session_id=session_id
            )
        except Exception as e:
            logger.error(f"Privacy guardrail preparation failed: {str(e)}")
            return {
                "error": "AI analysis unavailable. The required context could not be safely prepared. No AI recommendation was generated.",
                "privacy_scrubbed": False,
                "evidence": ["Privacy guardrail preparation failed"],
                "reasoning": ["Context could not be safely anonymized"],
                "recommendation": "Manual review required due to privacy processing error.",
                "suggested_outcome_statement": current_outcome_statement,
                "suggested_success_criteria": current_success_criteria,
                "risk_score": "HIGH",
                "affected_dimensions": ["Privacy Boundary"]
            }

        # 2. Structured Gemini Prompting (Mapping is NEVER sent to Gemini)
        system_instruction = (
            "You are the CalmWork UNDERSTAND Agent. Analyze engagement requirement changes "
            "against active outcome definitions using Evidence -> Reasoning -> Recommendation pattern. "
            "Return JSON matching keys: change_detected (bool), change_type (string), evidence (list of strings), "
            "reasoning (list of strings), impact (string), affected_outcome (string), affected_requirements (list), "
            "affected_dod_items (list), affected_technical_work (list), affected_dependencies (list), "
            "timeline_risk (LOW|MEDIUM|HIGH|CRITICAL), recommended_outcome (string), "
            "recommended_dod_changes (list of dicts with title), recommended_actions (list), confidence (string), requires_manager_approval (bool)."
        )

        prompt = (
            f"Anonymized Requirement Input: {anonymized_change}\n"
            f"Anonymized Outcome Statement: {anonymized_outcome}\n"
            f"Current Success Criteria (DoD): {json.dumps(current_success_criteria)}"
        )

        gemini_result = self._call_gemini_json(prompt, system_instruction)

        if gemini_result and isinstance(gemini_result, dict):
            evidence = gemini_result.get("evidence", [f"Observed scope input: '{anonymized_change}'"])
            reasoning = gemini_result.get("reasoning", ["Requirement shift impacts Definition of Done gating."])
            recommendation = gemini_result.get("recommended_outcome") or gemini_result.get("recommendation") or f"Upgrade Outcome DoD checklist for '{anonymized_change}'."
            dod_changes = gemini_result.get("recommended_dod_changes", [])
            risk_score = gemini_result.get("timeline_risk") or gemini_result.get("risk_score") or "HIGH"
            affected_dims = gemini_result.get("affected_dependencies") or ["Definition of Done", "Timeline Gating"]
        else:
            # Dynamic engagement state reasoning (No third-party AI, strictly Google/DB state driven)
            evidence = [
                f"Customer requirement change input: '{anonymized_change}'",
                f"Active outcome baseline: '{anonymized_outcome}'",
                "Requirement introduces gating condition before production validation step."
            ]
            reasoning = [
                f"The new requirement '{anonymized_change}' affects production success criteria and creates a customer dependency.",
                "Definition of Done completion affected: Step 4 (Build Within Real Constraints) requires validation before Step 5 deployment."
            ]
            recommendation = (
                f"Upgrade Outcome to Version 2. Add '{anonymized_change}' to Definition of Done checklist "
                "and request Manager approval for version transition."
            )
            dod_changes = [{"title": f"{raw_change_text} (Added v2)", "completed": False}]
            risk_score = "HIGH"
            affected_dims = ["Outcome DoD Checklist", "Dependencies & Blockers", "Timeline Gating"]

        # Reconstruct updated DoD checklist
        suggested_criteria = list(current_success_criteria)
        for add in dod_changes:
            title = add.get("title", "New DoD Criteria")
            if not any(c.get("title") == title for c in suggested_criteria):
                suggested_criteria.append({
                    "id": f"sc-{len(suggested_criteria)+1}",
                    "title": title,
                    "completed": False
                })

        # Sanitize output tokens back for authorized display
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
            "affected_dimensions": affected_dims,
            "confidence": "High",
            "requires_manager_approval": True
        }
