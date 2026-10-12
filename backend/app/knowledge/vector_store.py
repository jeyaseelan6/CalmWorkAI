"""
Tenant-Isolated Vector Store for KNOW Agent.
Provides semantic similarity search & grounded context retrieval partitioned strictly by engagement_id.
"""

from typing import List, Dict, Any, Tuple
import math
import re
import logging
from app.knowledge.ingestion import DocumentChunk

logger = logging.getLogger(__name__)


STOPWORDS = {
    "what", "is", "the", "a", "an", "and", "or", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "how", "do", "does", "did", "can", "could",
    "should", "would", "about", "tell", "me", "which", "when", "where", "who", "why"
}


def _tokenize(text: str) -> List[str]:
    """Tokenize text into lowercase alphanumeric terms."""
    return re.findall(r'\b[a-zA-Z0-9_]+\b', text.lower())


class VectorStore:
    """
    In-Memory Vector Store with engagement-level multi-tenant isolation.
    Supports cosine similarity retrieval with citation metadata.
    """

    def __init__(self):
        # Store index partitioned by engagement_id -> List[DocumentChunk]
        self._chunks_by_engagement: Dict[str, List[DocumentChunk]] = {}

    def add_chunks(self, engagement_id: str, chunks: List[DocumentChunk]) -> int:
        """Add document chunks to the tenant index, avoiding duplicate chunk IDs."""
        if engagement_id not in self._chunks_by_engagement:
            self._chunks_by_engagement[engagement_id] = []
        
        existing_ids = {c.chunk_id for c in self._chunks_by_engagement[engagement_id]}
        new_chunks = [c for c in chunks if c.chunk_id not in existing_ids]
        self._chunks_by_engagement[engagement_id].extend(new_chunks)
        logger.info(f"Added {len(new_chunks)} chunks to vector store for engagement {engagement_id}")
        return len(self._chunks_by_engagement[engagement_id])

    def search(
        self,
        engagement_id: str,
        query: str,
        top_k: int = 3
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Perform grounded vector search for query within tenant engagement boundary.
        Returns List[(DocumentChunk, similarity_score)].
        """
        tenant_chunks = self._chunks_by_engagement.get(engagement_id, [])
        if not tenant_chunks:
            return []

        all_query_tokens = _tokenize(query)
        if not all_query_tokens:
            return []

        content_query_tokens = [t for t in all_query_tokens if t not in STOPWORDS]
        query_tokens = set(content_query_tokens if content_query_tokens else all_query_tokens)

        scored_results: List[Tuple[DocumentChunk, float]] = []

        for chunk in tenant_chunks:
            chunk_tokens = _tokenize(chunk.anonymized_content)
            if not chunk_tokens:
                continue

            # Compute Jaccard / Cosine term similarity
            intersection = query_tokens.intersection(chunk_tokens)
            score = len(intersection) / (math.sqrt(len(query_tokens)) * math.sqrt(len(set(chunk_tokens))))

            if score > 0:
                scored_results.append((chunk, score))

        # Sort descending by score
        scored_results.sort(key=lambda x: x[1], reverse=True)
        return scored_results[:top_k]

    def clear_engagement_data(self, engagement_id: str) -> None:
        if engagement_id in self._chunks_by_engagement:
            del self._chunks_by_engagement[engagement_id]
