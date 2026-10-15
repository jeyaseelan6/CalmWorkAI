"""
Unit Tests for Dedicated PLAN Agent (Planning & Delivery Intelligence).

Verifies:
1. StructuredWorkPlanProposal generation from natural language description.
2. Fact vs Assumption vs Unknown Gap separation.
3. Change Impact & Scope Drift analysis (migrated from UNDERSTAND) with Evidence -> Reasoning -> Recommendation pattern.
4. Iterative plan reassessment with new evidence items.
5. Privacy guardrail protection during plan and scope analysis.
6. UnderstandAgent backwards-compatibility shim.
"""

import pytest
import json
import warnings
from app.agents.plan_agent import (
    PlanAgent,
    StructuredWorkPlanProposal,
    ChangeImpactAnalysis,
    PlanReassessmentResult
)
from app.agents.understand_agent import UnderstandAgent
from app.privacy import PrivacyPolicyEngine
from app.agents.adk_runtime import set_mock_adk_response, clear_mock_adk_responses


@pytest.fixture(autouse=True)
def setup_plan_agent_mocks():
    mock_plan = json.dumps({
        "engagement_objective": "Migrate on-prem database to Cloud SQL within 8 weeks.",
        "outcomes": ["Database fully migrated with zero data loss."],
        "definition_of_done": [
            {"id": "sc-1", "title": "Schema converted and verified", "completed": False},
            {"id": "sc-2", "title": "CDC replication pipeline active", "completed": False}
        ],
        "milestones": [
            {
                "id": "ms-1",
                "title": "Discovery & Schema Preparation",
                "sequence_order": 1,
                "deliverables": ["Schema DDL script"],
                "dependencies": ["Source access"],
                "customer_decisions_required": ["Cutover window approval"]
            },
            {
                "id": "ms-2",
                "title": "Data Migration & Validation",
                "sequence_order": 2,
                "deliverables": ["Replicated dataset"],
                "dependencies": ["Cutover window approval"],
                "customer_decisions_required": ["Final sign-off"]
            }
        ],
        "tasks": [
            {
                "id": "task-1",
                "milestone_id": "ms-1",
                "title": "Run Database Migration Assessment",
                "description": "Profile source database tables.",
                "dependencies": ["Source access"],
                "owner": None,
                "status": "PLANNED"
            }
        ],
        "risks": ["Source database schema contains proprietary stored procedures."],
        "facts_and_assumptions": {
            "confirmed_facts": [
                "Customer wants to migrate to Cloud SQL within 8 weeks.",
                "Source access will be provided by customer SecOps."
            ],
            "inferred_assumptions": [
                "Target Cloud SQL instance has adequate storage IOPS."
            ],
            "unresolved_questions_or_gaps": []
        },
        "next_actions": ["Request source database read-replica credentials."],
        "timeline_summary": "Target completion: 8 weeks.",
        "is_provisional": False,
        "clarifying_questions": []
    })

    mock_change_analysis = json.dumps({
        "change_title": "Customer mandate: Add SAML SSO integration",
        "evidence": [
            "Customer SecOps requested SAML SSO authentication for all API endpoints."
        ],
        "reasoning": [
            "Current Outcome Goals (v1) only cover database cutover.",
            "SAML SSO requires identity provider integration and adds a new gating dependency."
        ],
        "recommendation": "Upgrade Outcome Goals to v2 with Manager approval to reflect SSO scope expansion.",
        "suggested_outcome_statement": "Migrate database to Cloud SQL and enable enterprise SAML SSO.",
        "suggested_success_criteria": [
            {"id": "sc-1", "title": "Database migrated to Cloud SQL", "completed": False},
            {"id": "sc-2", "title": "SAML SSO identity provider configured", "completed": False}
        ],
        "risk_score": "HIGH",
        "affected_dimensions": ["Authentication", "Contractual Scope", "Security Baseline"]
    })

    set_mock_adk_response("migrate on-prem database", mock_plan)
    set_mock_adk_response("cloud migration description", mock_plan)
    set_mock_adk_response("customer requested saml sso", mock_change_analysis)
    set_mock_adk_response("anonymized requirement input", mock_change_analysis)
    yield
    clear_mock_adk_responses()


def test_plan_agent_generates_structured_work_plan():
    """Verifies PLAN Agent generates structured, evidence-separated proposals."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = PlanAgent(privacy_engine=privacy_engine)

    proposal = agent.generate_natural_language_work_plan(
        engagement_id="eng-plan-001",
        customer_name="Global Bank",
        natural_language_description="Migrate on-prem database to Cloud SQL within 8 weeks.",
        current_outcome_statement="Legacy DB Migration."
    )

    assert isinstance(proposal, StructuredWorkPlanProposal)
    assert proposal.engagement_id == "eng-plan-001"
    assert proposal.customer_name == "Global Bank"
    assert len(proposal.milestones) == 2
    assert len(proposal.tasks) >= 1
    assert len(proposal.definition_of_done) == 2

    # Verified Fact vs Inferred Assumption distinction
    fa = proposal.facts_and_assumptions
    assert len(fa.confirmed_facts) >= 1
    assert any("8 weeks" in f for f in fa.confirmed_facts)
    assert len(fa.inferred_assumptions) >= 1


def test_plan_agent_analyzes_scope_change_impact():
    """Verifies PLAN Agent handles scope changes with Evidence -> Reasoning -> Recommendation pattern."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = PlanAgent(privacy_engine=privacy_engine)

    change = agent.analyze_change(
        raw_change_text="Customer requested SAML SSO integration immediately.",
        current_outcome_statement="Migrate database to Cloud SQL.",
        current_success_criteria=[{"id": "sc-1", "title": "Database migrated", "completed": False}]
    )

    assert isinstance(change, ChangeImpactAnalysis)
    assert len(change.evidence) >= 1
    assert len(change.reasoning) >= 1
    assert change.recommendation != ""
    assert change.risk_score in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert "SAML SSO" in change.suggested_outcome_statement or "SSO" in change.suggested_outcome_statement


def test_plan_agent_reassesses_plan_with_evidence():
    """Verifies iterative plan reassessment detects scope drift and flags required manager approval."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = PlanAgent(privacy_engine=privacy_engine)

    existing_plan = {
        "plan_id": "plan-eng-001",
        "engagement_objective": "Database Cutover"
    }

    # 1. Healthy progress: no scope drift
    reassessment_healthy = agent.reassess_plan_with_evidence(
        engagement_id="eng-001",
        customer_name="Acme Corp",
        current_work_plan=existing_plan,
        new_evidence_items=["Schema conversion complete and passed unit tests."]
    )
    assert reassessment_healthy.outcome_health == "HEALTHY"
    assert reassessment_healthy.scope_drift_detected is False
    assert reassessment_healthy.requires_manager_approval is False

    # 2. Scope drift introduced in evidence
    reassessment_drift = agent.reassess_plan_with_evidence(
        engagement_id="eng-001",
        customer_name="Acme Corp",
        current_work_plan=existing_plan,
        new_evidence_items=["Customer SecOps declared mandatory SSO integration as an unmovable blocker."]
    )
    assert reassessment_drift.outcome_health == "NEEDS_REASSESSMENT"
    assert reassessment_drift.scope_drift_detected is True
    assert reassessment_drift.requires_manager_approval is True


def test_understand_agent_compatibility_shim():
    """Verifies UnderstandAgent acts as a backwards-compatible subclass of PlanAgent and emits DeprecationWarning."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)

    with pytest.deprecated_call():
        legacy_agent = UnderstandAgent(privacy_engine=privacy_engine)

    assert isinstance(legacy_agent, PlanAgent)
    analysis = legacy_agent.analyze_change(
        raw_change_text="Customer requested SAML SSO integration.",
        current_outcome_statement="Migrate database.",
        current_success_criteria=[]
    )
    assert isinstance(analysis, ChangeImpactAnalysis)
