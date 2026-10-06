"""
KNOW Agent — Grounded Intelligence & RAG Q&A Engine.
Retrieves engagement-isolated knowledge chunks, generates grounded answers with explicit citations,
and sanitizes output via AI Input Privacy Guardrail.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
import logging

from app.knowledge import IngestionEngine, VectorStore, DocumentChunk
from app.privacy import PrivacyPolicyEngine

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


class KnowAgent:
    """
    KNOW Agent: Performs evidence-grounded Q&A over engagement documentation, customer specs,
    and architecture notes using grounded vector retrieval.
    """

    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        ingestion_engine: Optional[IngestionEngine] = None,
        privacy_engine: Optional[PrivacyPolicyEngine] = None
    ):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.ingestion_engine = ingestion_engine or IngestionEngine(privacy_engine=self.privacy_engine)
        self.vector_store = vector_store or VectorStore()

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
        Answers user question strictly grounded on engagement documentation.
        Handles insufficient evidence explicitly without fabricating answers.
        """
        # 1. Privacy Guardrail Anonymization on incoming question
        anonymized_question, mapping = self.privacy_engine.process_llm_input(
            text=raw_question,
            session_id=engagement_id
        )

        # 2. Vector Search within engagement boundary
        search_results = self.vector_store.search(
            engagement_id=engagement_id,
            query=anonymized_question,
            top_k=top_k
        )

        # Insufficient evidence check
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

        # 3. Grounded Answer Synthesis with Explicit Citations
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
        synthesized_answer = (
            f"Based on verified engagement evidence in {citations[0].document_title}: "
            f"{search_results[0][0].content[:250]}..."
        )

        clean_answer = self.privacy_engine.sanitize_output(synthesized_answer, mapping)

        return GroundedAnswer(
            question=raw_question,
            answer=clean_answer,
            citations=citations,
            confidence_score=min(round(top_score * 1.5, 2), 0.98),
            tenant_isolated=True,
            privacy_scrubbed=len(mapping.reference_to_original) > 0,
            evidence_sufficient=True
        )
