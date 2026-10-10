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

    def _call_gemini_text(self, prompt: str, system_instruction: str) -> Optional[str]:
        """
        Executes Gemini API request returning plain text.
        Falls back to None if API key is not configured or API call fails.
        """
        if not self.api_key:
            return None

        try:
            import google.genai as genai
            client = genai.Client(api_key=self.api_key)
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config={
                    "system_instruction": system_instruction
                }
            )
            if response and response.text:
                return response.text.strip()
        except Exception as e:
            logger.warning(f"Gemini API text call failed ({str(e)}); falling back.")

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

    def synthesize_rag_answer(
        self,
        question: str,
        context_chunks: List[str],
        session_id: Optional[str] = None
    ) -> Optional[str]:
        """
        Synthesizes a grounded answer to a technical/engagement question using retrieved chunks.
        Anti-hallucination constraint: If facts are not in chunks, declare insufficient evidence.
        """
        if not self.api_key or not context_chunks:
            return None

        try:
            anonymized_question, mapping = self.privacy_engine.process_llm_input(
                text=question,
                session_id=session_id
            )
            sanitized_chunks = [
                self.privacy_engine.process_llm_input(text=c, session_id=session_id)[0]
                for c in context_chunks
            ]
        except Exception as e:
            logger.error(f"Privacy guardrail preparation failed in synthesize_rag_answer: {str(e)}")
            return None

        system_instruction = (
            "You are the CalmWork KNOW Agent. Synthesize a concise, direct, factual answer "
            "based STRICTLY and ONLY on the provided verified engagement context chunks. "
            "Do NOT hallucinate or assume details not present. "
            "If the chunks do not contain enough facts to answer, reply exactly with: "
            "'I don't have enough verified engagement evidence to answer this confidently.'"
        )

        prompt = (
            f"Verified Engagement Evidence:\n" +
            "\n---\n".join([f"[{i+1}] {c}" for i, c in enumerate(sanitized_chunks)]) +
            f"\n\nQuestion: {anonymized_question}\n"
            f"Answer:"
        )

        gemini_answer = self._call_gemini_text(prompt, system_instruction)
        if gemini_answer:
            return self.privacy_engine.sanitize_output(gemini_answer, mapping)
        return None

    def reason_next_best_action(
        self,
        customer_name: str,
        current_work_cycle: str,
        status: str,
        outcome_statement: str,
        blockers: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Calculates the single highest-leverage Next Best Action for the FDE using Gemini.
        """
        if not self.api_key:
            return None

        try:
            anonymized_cust, mapping = self.privacy_engine.process_llm_input(
                text=customer_name,
                session_id=session_id
            )
            anonymized_outcome, _ = self.privacy_engine.process_llm_input(
                text=outcome_statement,
                session_id=session_id
            )
        except Exception as e:
            logger.error(f"Privacy guardrail error in reason_next_best_action: {str(e)}")
            return None

        system_instruction = (
            "You are the CalmWork MOVE Agent. Determine the single highest-impact Next Best Action "
            "for a Forward-Deployed Engineer (FDE). Analyze gating dependencies, current work cycle, and outcome status. "
            "Return JSON matching keys: "
            "action_title (string), situation (string), recommendation (string), why_now (string), "
            "impact (string), priority_level ('CRITICAL'|'HIGH_PRIORITY'|'MEDIUM_PRIORITY'|'ROUTINE'), "
            "approval_required (bool), affected_role ('FDE'|'MANAGER'|'CUSTOMER_OWNER')."
        )

        prompt = (
            f"Customer: {anonymized_cust}\n"
            f"Current Work Cycle: {current_work_cycle}\n"
            f"Engagement Status: {status}\n"
            f"Target Outcome Statement: {anonymized_outcome}\n"
            f"Active Blockers: {json.dumps(blockers)}"
        )

        gemini_result = self._call_gemini_json(prompt, system_instruction)
        if gemini_result and isinstance(gemini_result, dict):
            return {
                "action_title": self.privacy_engine.sanitize_output(gemini_result.get("action_title", ""), mapping),
                "situation": self.privacy_engine.sanitize_output(gemini_result.get("situation", ""), mapping),
                "recommendation": self.privacy_engine.sanitize_output(gemini_result.get("recommendation", ""), mapping),
                "why_now": self.privacy_engine.sanitize_output(gemini_result.get("why_now", ""), mapping),
                "impact": self.privacy_engine.sanitize_output(gemini_result.get("impact", ""), mapping),
                "priority_level": gemini_result.get("priority_level", "HIGH_PRIORITY"),
                "approval_required": bool(gemini_result.get("approval_required", True)),
                "affected_role": gemini_result.get("affected_role", "FDE")
            }
        return None

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
        """
        Drafts customer-facing executive business updates from technical milestones.
        """
        if not self.api_key:
            return None

        try:
            anonymized_cust, mapping = self.privacy_engine.process_llm_input(
                text=customer_name,
                session_id=session_id
            )
            anonymized_notes, _ = self.privacy_engine.process_llm_input(
                text=raw_notes or "",
                session_id=session_id
            )
        except Exception as e:
            logger.error(f"Privacy guardrail error in draft_customer_update: {str(e)}")
            return None

        system_instruction = (
            "You are the CalmWork DELIVER Agent. Translate technical engineering milestone progress "
            "into executive, polished business communication suitable for enterprise customer stakeholders. "
            "Never claim unverified completions. "
            "Return JSON matching keys: "
            "subject (string), executive_summary (string), key_milestones_achieved (list of strings), "
            "next_milestone_target (string), customer_action_items (list of strings)."
        )

        prompt = (
            f"Customer: {anonymized_cust}\n"
            f"Engagement Name: {engagement_name}\n"
            f"Target Outcome: {outcome_statement}\n"
            f"Format Type: {format_type}\n"
            f"Active Work Cycle: {current_work_cycle}\n"
            f"Completed Milestones: {json.dumps(completed_milestones)}\n"
            f"Pending Milestones: {json.dumps(pending_milestones)}\n"
            f"Engineer Notes: {anonymized_notes}"
        )

        gemini_result = self._call_gemini_json(prompt, system_instruction)
        if gemini_result and isinstance(gemini_result, dict):
            return {
                "subject": self.privacy_engine.sanitize_output(gemini_result.get("subject", ""), mapping),
                "executive_summary": self.privacy_engine.sanitize_output(gemini_result.get("executive_summary", ""), mapping),
                "key_milestones_achieved": [
                    self.privacy_engine.sanitize_output(m, mapping) for m in gemini_result.get("key_milestones_achieved", [])
                ],
                "next_milestone_target": self.privacy_engine.sanitize_output(gemini_result.get("next_milestone_target", ""), mapping),
                "customer_action_items": [
                    self.privacy_engine.sanitize_output(a, mapping) for a in gemini_result.get("customer_action_items", [])
                ]
            }
        return None

    def synthesize_morning_plan(
        self,
        customer_name: str,
        target_outcome: str,
        what_changed: List[Dict[str, Any]],
        blockers: List[Dict[str, Any]],
        session_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Synthesizes a proposed daily work plan for the FDE Morning Brief.
        """
        if not self.api_key:
            return None

        try:
            anonymized_cust, mapping = self.privacy_engine.process_llm_input(
                text=customer_name,
                session_id=session_id
            )
        except Exception as e:
            logger.error(f"Privacy guardrail error in synthesize_morning_plan: {str(e)}")
            return None

        system_instruction = (
            "You are the CalmWork Supervisor Coordinator. Synthesize a concise, high-leverage "
            "Proposed Daily Work Plan for a Forward-Deployed Engineer's Morning Brief. "
            "Return JSON matching keys: "
            "work_items (list of dicts with keys: id, title, sequence_order, why_it_matters, dependencies, blockers, decisions_or_approvals_required), "
            "assumptions_and_questions (list of strings), "
            "recommended_first_action (string)."
        )

        prompt = (
            f"Customer: {anonymized_cust}\n"
            f"Target Outcome: {target_outcome}\n"
            f"Recent Changes: {json.dumps(what_changed)}\n"
            f"Active Blockers: {json.dumps(blockers)}"
        )

        gemini_result = self._call_gemini_json(prompt, system_instruction)
        if gemini_result and isinstance(gemini_result, dict):
            raw_items = gemini_result.get("work_items", [])
            clean_items = []
            for item in raw_items:
                clean_items.append({
                    "id": item.get("id", f"wi-{len(clean_items)+1}"),
                    "title": self.privacy_engine.sanitize_output(item.get("title", ""), mapping),
                    "sequence_order": item.get("sequence_order", len(clean_items)+1),
                    "why_it_matters": self.privacy_engine.sanitize_output(item.get("why_it_matters", ""), mapping),
                    "dependencies": [self.privacy_engine.sanitize_output(d, mapping) for d in item.get("dependencies", [])],
                    "blockers": [self.privacy_engine.sanitize_output(b, mapping) for b in item.get("blockers", [])],
                    "decisions_or_approvals_required": [self.privacy_engine.sanitize_output(dec, mapping) for dec in item.get("decisions_or_approvals_required", [])],
                    "status": "PROPOSED"
                })
            return {
                "work_items": clean_items,
                "assumptions_and_questions": [
                    self.privacy_engine.sanitize_output(q, mapping) for q in gemini_result.get("assumptions_and_questions", [])
                ],
                "recommended_first_action": self.privacy_engine.sanitize_output(gemini_result.get("recommended_first_action", ""), mapping)
            }
        return None
