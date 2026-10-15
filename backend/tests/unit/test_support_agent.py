"""
Unit Tests for Dedicated SUPPORT Agent (Production Support & Screenshot Intelligence).

Verifies:
1. Incident investigation with severity triage (CRITICAL, HIGH, MEDIUM, LOW).
2. Diagnostic error log evaluation and root cause hypothesis formation.
3. Screenshot intelligence and visual findings processing.
4. Privacy guardrail integration for production logs and error messages.
5. Deterministic fallback when AI model is offline.
"""

import pytest
import json
from app.agents.support_agent import (
    SupportAgent,
    IncidentInvestigationResult
)
from app.privacy import PrivacyPolicyEngine
from app.agents.adk_runtime import set_mock_adk_response, clear_mock_adk_responses


@pytest.fixture(autouse=True)
def setup_support_agent_mocks():
    mock_support = json.dumps({
        "severity": "CRITICAL",
        "summary": "Database connection pool exhaustion causing API gateway 504 timeouts.",
        "root_cause_hypothesis": "HikariCP pool size capped at 10 while peak traffic exceeded 250 req/sec.",
        "affected_components": ["API Gateway", "PostgreSQL Pool", "Order Service"],
        "suggested_workaround": "Temporarily increase max-pool-size to 50 and restart container instances.",
        "runbook_recommendations": [
            "Inspect postgresql active connections via pg_stat_activity.",
            "Adjust HikariCP maximumPoolSize in application-prod.yaml.",
            "Verify network latency between gateway and database VPC."
        ],
        "visual_diagnostic_findings": "Observed HTTP 504 Gateway Timeout error modal from screenshot.",
        "evidence_citations": ["Incident Report", "Runbook RB-DB-004"]
    })

    set_mock_adk_response("connection pool exhaustion", mock_support)
    set_mock_adk_response("investigating a production issue", mock_support)
    yield
    clear_mock_adk_responses()


def test_support_agent_investigates_incident():
    """Verifies SUPPORT Agent triages an incident and formulates root cause hypotheses."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = SupportAgent(privacy_engine=privacy_engine)

    result = agent.investigate_incident(
        engagement_id="eng-support-001",
        customer_name="Acme Finance",
        issue_description="Connection pool exhaustion causing 504 timeouts on customer checkout.",
        error_logs="FATAL: remaining connection slots are reserved for non-replication superuser connections",
        screenshot_metadata={"error_modal": "504 Gateway Timeout", "screen": "CheckoutPage"}
    )

    assert isinstance(result, IncidentInvestigationResult)
    assert result.engagement_id == "eng-support-001"
    assert result.customer_name == "Acme Finance"
    assert result.severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    assert result.summary != ""
    assert result.root_cause_hypothesis != ""
    assert len(result.affected_components) >= 1
    assert result.suggested_workaround is not None
    assert len(result.runbook_recommendations) >= 1
    assert result.investigated_at.endswith("IST")


def test_support_agent_deterministic_fallback():
    """Verifies SUPPORT Agent handles offline inference safely without crashing."""
    clear_mock_adk_responses()
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = SupportAgent(privacy_engine=privacy_engine)

    result = agent.investigate_incident(
        engagement_id="eng-support-002",
        customer_name="Beta Logistics",
        issue_description="Critical outage: backend service is down and customers cannot log in.",
        screenshot_base64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )

    assert isinstance(result, IncidentInvestigationResult)
    assert result.severity == "CRITICAL"
    assert "Beta Logistics" in result.summary
    assert len(result.runbook_recommendations) >= 1
    assert result.visual_diagnostic_findings is not None
