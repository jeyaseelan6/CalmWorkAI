import pytest
from app.agents.know_agent import KnowAgent
from app.agents.adk_runtime import set_mock_adk_response, clear_mock_adk_responses

@pytest.fixture(autouse=True)
def setup_know_mock():
    set_mock_adk_response("verified engagement evidence", "Based on verified documentation, Cloud SQL cutover window is 15 minutes and AES-256 keys are managed in KMS.")
    yield
    clear_mock_adk_responses()

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

def test_know_agent_offline_raises_error():
    clear_mock_adk_responses()
    agent = KnowAgent()
    agent.ingest_document(
        engagement_id="eng-offline-k01",
        title="Offline Guide",
        raw_text="Offline guide content for testing."
    )
    with pytest.raises(RuntimeError) as exc_info:
        agent.answer_question(
            engagement_id="eng-offline-k01",
            raw_question="What is the offline content?"
        )
    assert "AI service is currently unavailable" in str(exc_info.value)


def test_vector_store_cold_start_rehydration():
    from unittest.mock import MagicMock
    from app.knowledge.vector_store import VectorStore
    from app.models.document import DocumentModel, DocumentStatus

    store = VectorStore()
    mock_db = MagicMock()
    mock_doc = MagicMock(spec=DocumentModel)
    mock_doc.id = "doc-rehydrate-001"
    mock_doc.engagement_id = "eng-rehydrate-test"
    mock_doc.title = "Disaster Recovery Runbook"
    mock_doc.content = "In disaster recovery failover mode, RTO is 15 minutes and RPO is 0 data loss."
    mock_doc.status = DocumentStatus.INDEXED

    mock_db.query.return_value.filter.return_value.all.return_value = [mock_doc]

    # Vector store is initially empty for this engagement
    assert "eng-rehydrate-test" not in store._chunks_by_engagement

    # Rehydrate explicitly
    added = store.rehydrate_engagement("eng-rehydrate-test", db=mock_db)
    assert added > 0
    assert "eng-rehydrate-test" in store._chunks_by_engagement

    # Search should successfully match rehydrated content
    results = store.search("eng-rehydrate-test", "disaster recovery RTO failover", top_k=2)
    assert len(results) > 0
    assert results[0][0].title == "Disaster Recovery Runbook"
    assert "RTO is 15 minutes" in results[0][0].content

