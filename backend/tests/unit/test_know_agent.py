import pytest
from app.agents.know_agent import KnowAgent

def test_know_agent_insufficient_evidence():
    agent = KnowAgent()
    res = agent.answer_question(
        engagement_id="eng-nonexistent",
        raw_question="What is the secret key for unknown system?"
    )
    assert res.evidence_sufficient is False
    assert "don't have enough verified engagement evidence" in res.answer

def test_know_agent_grounded_answer():
    agent = KnowAgent()
    agent.ingest_document(
        engagement_id="eng-test-01",
        title="Architecture Guide",
        raw_text="Cloud SQL database cutover window is 15 minutes."
    )
    res = agent.answer_question(
        engagement_id="eng-test-01",
        raw_question="What is the cutover window?"
    )
    assert res.evidence_sufficient is True
    assert len(res.citations) > 0
    assert res.citations[0].document_title == "Architecture Guide"


def test_document_processor_text():
    from app.services.document_processor import extract_text_from_file
    text = "# Security Guide\nAll endpoints require OAuth2 bearer token."
    extracted = extract_text_from_file("security.md", text.encode("utf-8"))
    assert "OAuth2 bearer token" in extracted


def test_document_upload_file_endpoint():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)

    file_content = (
        "Enterprise Architecture Policy:\n"
        "All data at rest in PostgreSQL must be encrypted using AES-256 keys managed in Google Cloud KMS."
    ).encode("utf-8")

    res = client.post(
        "/api/v1/engagements/eng-acme-001/documents/upload-file",
        data={"category": "Architecture", "title": "KMS Policy Spec"},
        files={"file": ("kms_policy.txt", file_content, "text/plain")}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["data"]["title"] == "KMS Policy Spec"
    assert data["data"]["chunks_count"] >= 1

    # Now verify Grounded RAG query retrieves it
    query_res = client.post(
        "/api/v1/engagements/eng-acme-001/knowledge/query",
        json={"question": "What encryption standard is required for data at rest?", "top_k": 3}
    )
    assert query_res.status_code == 200
    query_data = query_res.json()
    assert query_data["success"] is True
    assert query_data["data"]["evidence_sufficient"] is True
    assert len(query_data["data"]["citations"]) > 0
    assert any("KMS Policy Spec" in c["document_title"] for c in query_data["data"]["citations"])
