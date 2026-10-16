"""
Tenant-Isolated Vector Store for KNOW Agent.
Provides semantic similarity search & grounded context retrieval partitioned strictly by engagement_id.
"""

from typing import List, Dict, Any, Tuple, Optional
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

    def delete_document_chunks(
        self,
        engagement_id: str,
        document_id: Optional[str] = None,
        title: Optional[str] = None
    ) -> int:
        """
        Removes all chunks belonging to a deleted document from the tenant in-memory vector index.
        """
        if engagement_id not in self._chunks_by_engagement:
            return 0

        initial_len = len(self._chunks_by_engagement[engagement_id])
        self._chunks_by_engagement[engagement_id] = [
            c for c in self._chunks_by_engagement[engagement_id]
            if not (
                (document_id and getattr(c, "document_id", None) == document_id) or
                (title and getattr(c, "title", None) == title)
            )
        ]
        removed_count = initial_len - len(self._chunks_by_engagement[engagement_id])
        logger.info(
            f"Removed {removed_count} chunks from vector store for engagement {engagement_id} "
            f"(doc_id={document_id}, title={title})"
        )
        return removed_count

    def rehydrate_engagement(self, engagement_id: str, db: Any = None) -> int:
        """
        Cold-start recovery: pulls all indexed DocumentModel records for engagement
        from PostgreSQL and re-chunks them into the in-memory tenant vector index.
        """
        from app.db.database import SessionLocal
        from app.models.document import DocumentModel, DocumentStatus
        from app.knowledge.ingestion import IngestionEngine

        close_session = False
        session = db
        if session is None:
            try:
                session = SessionLocal()
                close_session = True
            except Exception as e:
                logger.warning(f"Could not open database session for rehydration: {e}")
                return 0

        try:
            docs = (
                session.query(DocumentModel)
                .filter(
                    DocumentModel.engagement_id == engagement_id,
                    DocumentModel.status == DocumentStatus.INDEXED,
                    DocumentModel.content.isnot(None)
                )
                .all()
            )
            if not docs:
                return 0

            ingestion_engine = IngestionEngine()
            total_added = 0
            for doc in docs:
                if not doc.content or not doc.content.strip():
                    continue
                chunks = ingestion_engine.process_document(
                    engagement_id=engagement_id,
                    title=doc.title,
                    raw_text=doc.content,
                    document_id=doc.id
                )
                self.add_chunks(engagement_id, chunks)
                total_added += len(chunks)

            logger.info(f"Rehydrated {total_added} chunks for engagement {engagement_id} from PostgreSQL.")
            return total_added
        except Exception as e:
            logger.warning(f"Error during vector store rehydration for engagement {engagement_id}: {e}")
            return 0
        finally:
            if close_session and session:
                session.close()

    def rehydrate_all(self, db: Any = None) -> int:
        """
        Rehydrates vector store for all engagements present in database.
        """
        from app.db.database import SessionLocal
        from app.models.document import DocumentModel

        close_session = False
        session = db
        if session is None:
            try:
                session = SessionLocal()
                close_session = True
            except Exception as e:
                logger.warning(f"Could not open database session for full rehydration: {e}")
                return 0

        try:
            engagement_ids = [
                r[0] for r in session.query(DocumentModel.engagement_id).distinct().all()
            ]
            total = 0
            for eng_id in engagement_ids:
                total += self.rehydrate_engagement(eng_id, db=session)
            return total
        except Exception as e:
            logger.warning(f"Error during full vector store rehydration: {e}")
            return 0
        finally:
            if close_session and session:
                session.close()

    def search(
        self,
        engagement_id: str,
        query: str,
        top_k: int = 3
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Perform grounded vector search for query within tenant engagement boundary.
        Automatically rehydrates tenant index from database on cold start if empty.
        Returns List[(DocumentChunk, similarity_score)].
        """
        tenant_chunks = self._chunks_by_engagement.get(engagement_id, [])
        if not tenant_chunks:
            # Cold-start rehydration attempt from PostgreSQL
            self.rehydrate_engagement(engagement_id)
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

