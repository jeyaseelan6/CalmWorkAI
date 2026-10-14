"""
KNOW Agent — Grounded Intelligence & RAG Q&A Engine.
Built on Google Agent Development Kit (ADK).
Retrieves engagement-isolated knowledge chunks, generates grounded answers with explicit citations,
and sanitizes output via AI Input Privacy Guardrail.
"""

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
from app.agents.adk_runtime import (
    get_adk_model,
    get_session_service,
    create_privacy_guardrail_callback,
    create_adk_runner,
    execute_adk_runner,
    _MOCK_ADK_RESPONSES
)

logger = logging.getLogger(__name__)


class GroundedCitation(BaseModel):
    document_title: str
    chunk_id: str
    snippet: str
    relevance_score: float


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
    "You are the CalmWork KNOW Agent. Synthesize a concise, direct, factual answer "
    "based STRICTLY and ONLY on the provided verified engagement context chunks. "
    "Do NOT hallucinate or assume details not present. "
    "If the chunks do not contain enough facts to answer, reply exactly with: "
    "'I don't have enough verified engagement evidence to answer this confidently.'"
)


class KnowAgent:
    """
    KNOW Agent: Google ADK-powered grounded Q&A engine over engagement documentation,
    customer specs, and architecture notes using tenant-isolated vector retrieval.
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
            description="Performs tenant-isolated grounded retrieval and question answering strictly backed by engagement documentation.",
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
        top_k: int = 3
    ) -> GroundedAnswer:
        """
        Answers user question strictly grounded on engagement documentation using Google ADK.
        Handles insufficient evidence explicitly without fabricating answers.
        """
        # 1. Privacy Guardrail Anonymization on incoming question
        anonymized_question, mapping = self.privacy_engine.process_llm_input(
            text=raw_question,
            session_id=engagement_id
        )

        # 2. Vector Search within engagement tenant boundary
        search_results = self.vector_store.search(
            engagement_id=engagement_id,
            query=anonymized_question,
            top_k=top_k
        )

        # Insufficient evidence check (similarity threshold or empty index)
        if not search_results or search_results[0][1] < 0.15:
            return GroundedAnswer(
                question=raw_question,
                answer="I don't have enough verified engagement evidence to answer this confidently.",
                citations=[],
                confidence_score=0.0,
                tenant_isolated=True,
                privacy_scrubbed=len(mapping.reference_to_original) > 0,
                evidence_sufficient=False
            )

        # 3. Build Grounded Citations
        citations: List[GroundedCitation] = []
        for chunk, score in search_results:
            clean_snippet = self.privacy_engine.sanitize_output(chunk.content[:200], mapping)
            citations.append(GroundedCitation(
                document_title=chunk.title,
                chunk_id=chunk.chunk_id,
                snippet=clean_snippet + ("..." if len(chunk.content) > 200 else ""),
                relevance_score=round(score, 3)
            ))

        top_score = search_results[0][1]

        # 4. Synthesize Answer using Google ADK Agent
        sanitized_chunks = [
            self.privacy_engine.process_llm_input(text=c.content, session_id=engagement_id)[0]
            for c, _ in search_results
        ]
        evidence_context = "\n---\n".join([f"[{i+1}] Source: {search_results[i][0].title}\n{c}" for i, c in enumerate(sanitized_chunks)])

        prompt = (
            f"Verified Engagement Evidence:\n{evidence_context}\n\n"
            f"Question: {anonymized_question}\n"
            f"Answer:"
        )

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

        if not adk_answer:
            raise RuntimeError(
                "AI service is currently unavailable. Please verify your AI service configuration or try again shortly."
            )

        clean_answer = self.privacy_engine.sanitize_output(adk_answer, mapping)

        return GroundedAnswer(
            question=raw_question,
            answer=clean_answer,
            citations=citations,
            confidence_score=min(round(top_score * 1.5, 2), 0.98),
            tenant_isolated=True,
            privacy_scrubbed=len(mapping.reference_to_original) > 0,
            evidence_sufficient=True
        )
