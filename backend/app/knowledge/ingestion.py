"""
Document Ingestion & Chunking Engine for KNOW Agent.
Extracts, cleans, anonymizes via Privacy Guardrail, and chunks documents into searchable context vectors.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import uuid
import logging
from datetime import datetime, timezone

from app.privacy import PrivacyPolicyEngine

logger = logging.getLogger(__name__)


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    engagement_id: str
    title: str
    content: str
    anonymized_content: str
    chunk_index: int
    metadata: Dict[str, Any]
    created_at: str


class IngestionEngine:
    def __init__(self, privacy_engine: Optional[PrivacyPolicyEngine] = None, chunk_size: int = 400, overlap: int = 50):
        self.privacy_engine = privacy_engine or PrivacyPolicyEngine()
        self.chunk_size = chunk_size
        self.overlap = overlap

    def process_document(
        self,
        engagement_id: str,
        title: str,
        raw_text: str,
        document_id: Optional[str] = None
    ) -> List[DocumentChunk]:
        """
        Ingests a document, anonymizes sensitive data, and creates overlap chunks.
        """
        doc_id = document_id or f"doc-{uuid.uuid4().hex[:8]}"

        # 1. Anonymize sensitive text before chunking/indexing
        anonymized_text, mapping = self.privacy_engine.process_llm_input(
            text=raw_text,
            session_id=engagement_id
        )

        # 2. Text Chunking Algorithm
        chunks: List[DocumentChunk] = []
        text_length = len(raw_text)
        start = 0
        chunk_idx = 0

        while start < text_length:
            end = min(start + self.chunk_size, text_length)
            raw_chunk = raw_text[start:end]
            anon_chunk = anonymized_text[start:end]

            chunks.append(DocumentChunk(
                chunk_id=f"{doc_id}-c{chunk_idx}",
                document_id=doc_id,
                engagement_id=engagement_id,
                title=title,
                content=raw_chunk,
                anonymized_content=anon_chunk,
                chunk_index=chunk_idx,
                metadata={"title": title, "tokens_scrubbed": len(mapping.reference_to_original)},
                created_at=datetime.now(timezone.utc).isoformat()
            ))

            chunk_idx += 1
            start += (self.chunk_size - self.overlap)
            if start >= text_length or end == text_length:
                break

        logger.info(f"Ingested document '{title}' ({doc_id}) into {len(chunks)} chunks for engagement {engagement_id}")
        return chunks
