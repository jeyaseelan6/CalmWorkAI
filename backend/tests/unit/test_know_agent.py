import pytest
from app.agents.know_agent import KnowAgent
from app.agents.adk_runtime import set_mock_adk_response, clear_mock_adk_responses

from app.db.database import SessionLocal

@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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

def test_document_upload_file_endpoint(test_db):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.auth import create_access_token
    from app.models import Engagement, EngagementStatus

    eng = Engagement(
        id="eng-acme-001",
        customer_name="Acme Corp",
        name="Acme Migration",
        status=EngagementStatus.HEALTHY,
        created_by="manager@calmwork.ai"
    )
    test_db.merge(eng)
    test_db.commit()

    token = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
    headers = {"Authorization": f"Bearer {token}"}
    client = TestClient(app)

    file_content = (
        "Enterprise Architecture Policy:\n"
        "All data at rest in PostgreSQL must be encrypted using AES-256 keys managed in Google Cloud KMS."
    ).encode("utf-8")

    res = client.post(
        "/api/v1/engagements/eng-acme-001/documents/upload-file",
        headers=headers,
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
        headers=headers,
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


def test_know_agent_answers_from_worknotes_and_customer_inputs():
    from datetime import datetime
    agent = KnowAgent()
    # Note: No documents uploaded to vector store for this engagement
    ctx = {
        "timeline_events": [
            {
                "id": "evt-wn-01",
                "event_type": "WORKNOTE",
                "title": "Kafka Partition Verification",
                "description": "Verified Kafka cluster partition count is set to 12 partitions with replication factor 3.",
                "actor_type": "FDE",
                "created_at": datetime(2026, 10, 14, 10, 30)
            },
            {
                "id": "evt-ci-01",
                "event_type": "CUSTOMER_INPUT",
                "title": "Strict Latency Constraint",
                "description": "Customer requested P99 latency SLA must remain below 150ms under peak load.",
                "actor_type": "CUSTOMER",
                "created_at": datetime(2026, 10, 14, 11, 0)
            }
        ]
    }
    res = agent.answer_question(
        engagement_id="eng-ctx-01",
        raw_question="What did the customer input regarding latency SLA?",
        engagement_context=ctx
    )
    assert res.evidence_sufficient is True
    assert len(res.citations) > 0
    source_types = [c.source_type for c in res.citations]
    assert "CUSTOMER_INPUT" in source_types
    matching_cit = next(c for c in res.citations if c.source_type == "CUSTOMER_INPUT")
    assert "Strict Latency Constraint" in matching_cit.document_title
    assert "150ms" in matching_cit.snippet


def test_know_agent_answers_from_decisions_and_approvals():
    from datetime import datetime
    agent = KnowAgent()
    ctx = {
        "timeline_events": [
            {
                "id": "evt-dec-01",
                "event_type": "DECISION",
                "title": "PostgreSQL Logical Replication Approved",
                "description": "Architects approved PostgreSQL logical replication over Debezium for Phase 1.",
                "actor_type": "MANAGER",
                "created_at": datetime(2026, 10, 14, 14, 0)
            }
        ],
        "pending_approvals": [
            {
                "id": "appr-01",
                "type": "WORK_PLAN_CHANGE",
                "description": "Production cutover date shift to Sunday 15:30 IST",
                "requested_by": "FDE Alice",
                "created_at": datetime(2026, 10, 14, 15, 0)
            }
        ]
    }
    res = agent.answer_question(
        engagement_id="eng-dec-01",
        raw_question="What architectural decision was approved for replication?",
        engagement_context=ctx
    )
    assert res.evidence_sufficient is True
    assert any(c.source_type == "DECISION" for c in res.citations)
    cit = next(c for c in res.citations if c.source_type == "DECISION")
    assert "PostgreSQL Logical Replication" in cit.document_title


def test_know_agent_answers_from_observations_and_work_plan():
    agent = KnowAgent()
    ctx = {
        "timeline_events": [
            {
                "id": "evt-obs-01",
                "event_type": "OBSERVATION",
                "title": "High Memory Consumption During Bulk Sync",
                "description": "Observed worker node memory spiking to 88% during bulk table sync.",
                "actor_type": "FDE",
                "created_at": "2026-10-14T12:00:00Z"
            }
        ],
        "approved_work_plan": {
            "tasks": [
                {
                    "id": "task-01",
                    "title": "Tune JDBC Batch Size",
                    "description": "Adjust batch size from 5000 to 1000 to reduce memory pressure.",
                    "status": "IN_PROGRESS",
                    "owner": "Engineer Bob",
                    "due_date": "15 Oct 2026, 17:00 IST"
                }
            ]
        }
    }
    res = agent.answer_question(
        engagement_id="eng-obs-01",
        raw_question="What observations were recorded about memory and what is the work plan task?",
        engagement_context=ctx
    )
    assert res.evidence_sufficient is True
    source_types = [c.source_type for c in res.citations]
    assert "OBSERVATION" in source_types
    assert "WORK_PLAN" in source_types


def test_know_agent_prioritizes_uploaded_documents_over_context():
    from datetime import datetime
    agent = KnowAgent()
    # 1. Ingest document (Tier 1)
    agent.ingest_document(
        engagement_id="eng-prio-01",
        title="Official Migration Spec",
        raw_text="The authorized migration batch window is 20 minutes maximum."
    )
    # 2. Add engagement context (Tier 2)
    ctx = {
        "timeline_events": [
            {
                "id": "evt-wn-02",
                "event_type": "WORKNOTE",
                "title": "Informal Batch Discussion",
                "description": "FDE noted team discussed trying 30 minute batch window in dev.",
                "actor_type": "FDE",
                "created_at": datetime(2026, 10, 14, 9, 0)
            }
        ]
    }
    res = agent.answer_question(
        engagement_id="eng-prio-01",
        raw_question="What is the authorized migration batch window in the specification?",
        engagement_context=ctx
    )
    assert res.evidence_sufficient is True
    # Tier 1 document citation MUST be present and listed first
    assert res.citations[0].source_type == "DOCUMENT"
    assert res.citations[0].document_title == "Official Migration Spec"


def test_know_agent_context_insufficient_evidence_when_unrelated():
    agent = KnowAgent()
    ctx = {
        "timeline_events": [
            {
                "id": "evt-unrelated",
                "event_type": "WORKNOTE",
                "title": "Lunch Break",
                "description": "Team out for lunch.",
                "created_at": "2026-10-14T13:00:00Z"
            }
        ]
    }
    res = agent.answer_question(
        engagement_id="eng-empty-01",
        raw_question="What is the cryptographic cipher suite for the payment gateway?",
        engagement_context=ctx
    )
    assert res.evidence_sufficient is False
    assert "don't have enough verified engagement evidence" in res.answer
    assert len(res.citations) == 0


def test_know_agent_timeline_mentions_only_single_specific_record_instead_of_all():
    from datetime import datetime
    agent = KnowAgent()
    ctx = {
        "timeline_events": [
            # Automated morning brief records that should NOT be cited
            {
                "id": "evt-mb-01",
                "event_type": "MORNING_BRIEF_GENERATED",
                "title": "Morning Brief Generated (v3)",
                "description": "Supervisor synthesized sequential Morning Brief (UNDERSTAND -> KNOW -> MOVE). Proposed Plan: Review Outcome Goals criteria for Acme Corp.. DELIVER excluded.",
                "actor_type": "SUPERVISOR",
                "created_at": datetime(2026, 10, 14, 9, 0)
            },
            {
                "id": "evt-mb-02",
                "event_type": "MORNING_BRIEF_GENERATED",
                "title": "Morning Brief Generated (v3)",
                "description": "Supervisor synthesized sequential Morning Brief (UNDERSTAND -> KNOW -> MOVE). Proposed Plan: Schedule a short approval sync with the designated approver.",
                "actor_type": "SUPERVISOR",
                "created_at": datetime(2026, 10, 14, 9, 30)
            },
            # Real specific milestone event
            {
                "id": "evt-tl-specific",
                "event_type": "TIMELINE",
                "title": "Production VPN Tunnel Provisioned",
                "description": "DevOps team completed IPSec VPN tunnel handshake between GCP VPC and customer datacenter.",
                "actor_type": "DEVOPS",
                "created_at": datetime(2026, 10, 14, 15, 0)
            },
            # Another general timeline event
            {
                "id": "evt-tl-general",
                "event_type": "TIMELINE",
                "title": "Initial Kickoff Complete",
                "description": "General kickoff meeting with stakeholders.",
                "actor_type": "MANAGER",
                "created_at": datetime(2026, 10, 10, 10, 0)
            }
        ]
    }
    res = agent.answer_question(
        engagement_id="eng-tl-test",
        raw_question="When was the production VPN tunnel provisioned in the timeline?",
        engagement_context=ctx
    )
    assert res.evidence_sufficient is True
    # Filter citations to TIMELINE source_type
    timeline_citations = [c for c in res.citations if c.source_type == "TIMELINE"]
    # MUST contain exactly ONE specific timeline record, NOT multiple or all timelines
    assert len(timeline_citations) == 1
    assert "Production VPN Tunnel Provisioned" in timeline_citations[0].document_title
    assert "IPSec VPN" in timeline_citations[0].snippet
    # Automated Morning Brief events must NOT be listed
    assert not any("Morning Brief Generated" in c.document_title for c in res.citations)



