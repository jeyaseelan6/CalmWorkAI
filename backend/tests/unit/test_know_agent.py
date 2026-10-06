"""
Unit test suite for KNOW Agent & Grounded RAG Pipeline.
"""

from app.agents.know_agent import KnowAgent
from app.privacy import PrivacyPolicyEngine


def test_know_agent_grounded_rag():
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = KnowAgent(privacy_engine=privacy_engine)

    engagement_id = "eng-acme-001"
    doc_title = "Acme Corp Architecture & Security Guidelines"
    doc_content = (
        "Acme Corp requires all microservices to authenticate via Enterprise SSO with OAuth2/OIDC protocols. "
        "Production deployment is gated by security contact John Smith (+94771234567)."
    )

    # 1. Ingest document
    ingest_result = agent.ingest_document(
        engagement_id=engagement_id,
        title=doc_title,
        raw_text=doc_content
    )
    assert ingest_result["chunks_created"] > 0

    # 2. Query KNOW Agent
    question = "What authentication protocol is required by Acme Corp?"
    answer_result = agent.answer_question(
        engagement_id=engagement_id,
        raw_question=question
    )

    assert answer_result.tenant_isolated is True
    assert len(answer_result.citations) > 0
    assert answer_result.citations[0].document_title == doc_title
    assert "SSO" in answer_result.answer or "OAuth2" in answer_result.answer
    print("KNOW Agent unit test passed successfully!")


if __name__ == "__main__":
    test_know_agent_grounded_rag()
