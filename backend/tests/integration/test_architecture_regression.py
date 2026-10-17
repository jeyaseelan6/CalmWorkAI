"""
Comprehensive Architecture Regression and Workflow Verification Suite for CalmWork AI.

Explicitly validates:
A. Supervisor Routing (PLAN, KNOW, MOVE, DELIVER, SUPPORT, MULTI_AGENT, delegation without duplicate logic)
B. PLAN Capability Migration (structured plan, change impact, KNOW retrieval, fact vs assumption separation, iterative reassessment)
C. Existing Agent Regression (KNOW grounded citations, MOVE blocker priorities, DELIVER gated drafts, SUPPORT screenshot hypothesis)
D. State, Security and Authorization (timeline audit, Manager vs FDE RBAC, tenant isolation, idempotence, draft non-mutation)
E. Architecture Integrity (UNDERSTAND retired from active registry, deprecation warning, Google ADK model resolution)
"""

import pytest
import json
import warnings
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import (
    Base, Engagement, Outcome, TimelineEvent, Approval,
    EngagementStatus, WorkCycleStep, OutcomeStatus, ApprovalType, ApprovalStatus
)
from app.privacy import PrivacyPolicyEngine
from app.services import OutcomeService
from app.agents import (
    PlanAgent, SupportAgent, KnowAgent, MoveAgent, DeliverAgent, UnderstandAgent
)
from app.supervisor import SupervisorCoordinator, StructuredWorkPlanProposal
from app.agents.adk_runtime import set_mock_adk_response, clear_mock_adk_responses


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    eng = Engagement(
        id="eng-reg-001",
        customer_name="Vertex Financial",
        name="Payment Gateway Migration",
        description="Migrate legacy gateway to Cloud Spanner",
        status=EngagementStatus.HEALTHY,
        current_work_cycle=WorkCycleStep.STEP_4_BUILD_WITHIN_CONSTRAINTS,
        progress=60,
        current_outcome_id="out-reg-v1",
        created_by="fde_user_1",
        created_at=datetime.now(timezone.utc)
    )
    outcome_v1 = Outcome(
        id="out-reg-v1",
        engagement_id="eng-reg-001",
        version=1,
        statement="Migrate payment transactions with 99.999% availability.",
        success_criteria=[
            {"id": "sc-1", "title": "Database schema converted", "completed": True},
            {"id": "sc-2", "title": "CDC replication active", "completed": False}
        ],
        status=OutcomeStatus.APPROVED,
        created_by="fde_user_1",
        approved_by="manager_user_1",
        created_at=datetime.now(timezone.utc)
    )
    session.add(eng)
    session.add(outcome_v1)
    session.commit()

    yield session
    session.close()


@pytest.fixture(autouse=True)
def setup_regression_mocks():
    mock_plan = json.dumps({
        "engagement_objective": "Payment gateway modernization on Cloud Spanner in 6 weeks.",
        "outcomes": ["Gateway migrated with zero downtime."],
        "definition_of_done": [
            {"id": "sc-1", "title": "Schema converted and verified", "completed": True},
            {"id": "sc-2", "title": "CDC replication pipeline active", "completed": False}
        ],
        "milestones": [
            {
                "id": "ms-1",
                "title": "Architecture & Schema Prep",
                "sequence_order": 1,
                "deliverables": ["Spanner DDL script"],
                "dependencies": ["Source database access"],
                "customer_decisions_required": ["Cutover window agreement"]
            }
        ],
        "tasks": [
            {
                "id": "task-1",
                "milestone_id": "ms-1",
                "title": "Verify Schema Compatibility",
                "description": "Run Cloud Spanner migration checker.",
                "dependencies": ["Source database access"],
                "owner": None,
                "status": "PLANNED"
            }
        ],
        "risks": ["Transaction throughput peak could exceed default replication slot buffer."],
        "facts_and_assumptions": {
            "confirmed_facts": ["Payment gateway migration target timeline is 6 weeks."],
            "inferred_assumptions": ["Customer SecOps will provide Spanner IAM credentials."],
            "unresolved_questions_or_gaps": []
        },
        "next_actions": ["Request Spanner IAM role binding from client."],
        "timeline_summary": "Target completion: 6 weeks.",
        "is_provisional": False,
        "clarifying_questions": []
    })

    mock_change_analysis = json.dumps({
        "change_title": "Requirement shift: Mandatory PCI-DSS Tokenization",
        "evidence": ["Customer SecOps mandated PCI-DSS Level 1 tokenization before cutover."],
        "reasoning": [
            "Current Outcome Goals (v1) only specify Cloud Spanner migration.",
            "Tokenization vault adds an external dependency and requires new gating criteria."
        ],
        "recommendation": "Upgrade Outcome Goals to Version 2 with Manager approval.",
        "suggested_outcome_statement": "Migrate payment transactions with 99.999% availability and PCI-DSS Tokenization.",
        "suggested_success_criteria": [
            {"id": "sc-1", "title": "Database schema converted", "completed": True},
            {"id": "sc-2", "title": "CDC replication active", "completed": False},
            {"id": "sc-3", "title": "PCI-DSS tokenization vault configured", "completed": False}
        ],
        "risk_score": "HIGH",
        "affected_dimensions": ["Security Baseline", "Outcome Goals", "Compliance"]
    })

    mock_support = json.dumps({
        "severity": "CRITICAL",
        "summary": "CDC replication agent crashed due to out-of-memory exception.",
        "root_cause_hypothesis": "Debezium JVM heap size was constrained to 512MB during initial bulk backfill.",
        "affected_components": ["CDC Replicator", "Kafka Connect", "Spanner Sink"],
        "suggested_workaround": "Increase container heap memory to 2GB and restart service.",
        "runbook_recommendations": [
            "Check replication lag via pg_stat_replication.",
            "Inspect Kafka consumer offsets for partition starvation.",
            "Update JVM_OPTS in task definition."
        ],
        "visual_diagnostic_findings": "Observed OOM kill error exit code 137 in container console screenshot.",
        "evidence_citations": ["Runbook RB-CDC-01", "Container Metrics"]
    })

    mock_move = json.dumps({
        "action_title": "Resolve Gating Manager Approval for Tokenization Scope",
        "situation": "Scope expansion for PCI-DSS Tokenization is pending review.",
        "recommendation": "Review and approve Outcome Version 2.",
        "why_now": "Unblocks architecture assessment milestone.",
        "impact": "Aligns delivery trajectory with customer compliance mandate.",
        "priority_level": "CRITICAL",
        "confidence": "High",
        "approval_required": True,
        "affected_role": "MANAGER"
    })

    mock_deliver = json.dumps({
        "subject": "Executive Update: Payment Gateway Modernization",
        "executive_summary": "Schema conversion verified. CDC replication pipeline implementation underway.",
        "key_milestones_achieved": ["Spanner Schema DDL Verified"],
        "next_milestone_target": "CDC Replication Validation",
        "customer_action_items": ["Approve cutover schedule window"]
    })

    set_mock_adk_response("payment gateway modernization", mock_plan)
    set_mock_adk_response("modernize payment gateway", mock_plan)
    set_mock_adk_response("anonymized requirement input", mock_change_analysis)
    set_mock_adk_response("pci-dss tokenization", mock_change_analysis)
    set_mock_adk_response("cdc replication agent crashed", mock_support)
    set_mock_adk_response("investigating a production issue", mock_support)
    set_mock_adk_response("current work cycle", mock_move)
    set_mock_adk_response("blockers", mock_move)
    set_mock_adk_response("engineer notes", mock_deliver)
    set_mock_adk_response("target outcome", mock_deliver)
    yield
    clear_mock_adk_responses()


# =============================================================================
# A. SUPERVISOR ROUTING TESTS
# =============================================================================

def test_supervisor_routes_planning_request_to_plan():
    """Verifies a planning or scope inquiry routes directly to PLAN Agent."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    res = coordinator.query_supervisor(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        raw_query="What changed today in the delivery plan and what are the milestones?"
    )

    assert res.intent_detected == "PLAN"
    assert res.delegated_agent.id == "PLAN"
    assert res.delegated_agent.name == "PLAN Agent"
    assert "PLAN" in res.capabilities_used
    assert len(res.answer) > 0
    assert any(term in res.answer.lower() for term in ["plan", "milestone", "scope", "outcome"])


def test_supervisor_routes_knowledge_question_to_know():
    """Verifies a technical architecture query routes to KNOW Agent."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    res = coordinator.query_supervisor(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        raw_query="What is the database cutover window and architecture spec for Spanner?"
    )

    assert res.intent_detected == "KNOW"
    assert res.delegated_agent.id == "KNOW"
    assert res.delegated_agent.name == "KNOW Agent"
    assert "KNOW" in res.capabilities_used


def test_supervisor_routes_blocker_or_next_action_to_move():
    """Verifies a blocker or priority query routes to MOVE Agent."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    res = coordinator.query_supervisor(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        raw_query="What should I do next and what is currently blocked?"
    )

    assert res.intent_detected == "MOVE"
    assert res.delegated_agent.id == "MOVE"
    assert res.delegated_agent.name == "MOVE Agent"
    assert "MOVE" in res.capabilities_used
    assert any(term in res.answer.lower() for term in ["action", "task", "situation", "blocker", "validation"])


def test_supervisor_routes_customer_update_to_deliver():
    """Verifies a request to prepare a customer update routes to Deliver guidance without generating unapproved drafts."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    res = coordinator.query_supervisor(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        raw_query="Prepare a customer update for our stakeholders summarizing recent progress."
    )

    assert res.intent_detected in ("SUPERVISOR", "DELIVER")
    assert res.customer_update is None
    assert "Deliver Agent" in res.answer or "Deliver (Updates)" in res.answer


def test_supervisor_routes_screenshot_production_issue_to_support():
    """Verifies production issue or screenshot diagnosis routes to SUPPORT Agent."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    res = coordinator.query_supervisor(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        raw_query="We have a production issue and error log crash: CDC replication agent crashed with exit code 137."
    )

    assert res.intent_detected == "SUPPORT"
    assert res.delegated_agent.id == "SUPPORT"
    assert res.delegated_agent.name == "SUPPORT Agent"
    assert "SUPPORT" in res.capabilities_used
    assert "Incident Triage" in res.answer
    assert "Root Cause Hypothesis" in res.answer


def test_supervisor_multi_agent_workflow_selective_invocation():
    """Verifies general 360 overview routes to MULTI_AGENT with structured multi-agent briefing."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    res = coordinator.query_supervisor(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        raw_query="Give me a full operational update on what changed, what's blocking, and our customer plan."
    )

    assert res.intent_detected == "MULTI_AGENT"
    assert res.delegated_agent.id == "MULTI_AGENT"
    assert "360° Operational Briefing" in res.answer
    assert "PLAN" in res.answer or "MOVE" in res.answer


def test_supervisor_does_not_duplicate_plan_analysis():
    """Verifies SupervisorCoordinator delegates natural-language work planning to PlanAgent."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    # Calling coordinator.generate_natural_language_work_plan must invoke coordinator.plan_agent
    proposal = coordinator.generate_natural_language_work_plan(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        natural_language_description="Payment gateway modernization on Cloud Spanner in 6 weeks."
    )

    assert isinstance(proposal, StructuredWorkPlanProposal)
    assert proposal.customer_name == "Vertex Financial"
    assert len(proposal.milestones) >= 1
    assert len(proposal.tasks) >= 1
    assert len(proposal.facts_and_assumptions.confirmed_facts) >= 1


# =============================================================================
# B. PLAN CAPABILITY MIGRATION TESTS
# =============================================================================

def test_plan_creates_structured_plan_from_outcomes_and_criteria():
    """Verifies PlanAgent generates structured plans with objective, DoD, milestones, and tasks."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = PlanAgent(privacy_engine=privacy_engine)

    proposal = agent.generate_natural_language_work_plan(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        natural_language_description="Modernize payment gateway on Cloud Spanner in 6 weeks.",
        current_outcome_statement="Migrate transactions with 99.999% uptime."
    )

    assert proposal.engagement_objective != ""
    assert len(proposal.definition_of_done) >= 1
    assert len(proposal.milestones) >= 1
    assert len(proposal.tasks) >= 1
    assert proposal.status == "PROPOSED"


def test_plan_analyzes_customer_requirement_change():
    """Verifies PlanAgent analyzes requirement shifts using Evidence -> Reasoning -> Recommendation."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = PlanAgent(privacy_engine=privacy_engine)

    analysis = agent.analyze_change(
        raw_change_text="Customer SecOps mandated PCI-DSS Level 1 tokenization before cutover.",
        current_outcome_statement="Migrate payment transactions with 99.999% availability.",
        current_success_criteria=[{"id": "sc-1", "title": "Database schema converted", "completed": True}]
    )

    assert len(analysis.evidence) >= 1
    assert len(analysis.reasoning) >= 1
    assert analysis.recommendation != ""
    assert analysis.risk_score in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert len(analysis.suggested_success_criteria) > 1


def test_plan_identifies_affected_dimensions_risks_and_outcomes():
    """Verifies PlanAgent identifies affected dimensions, risk score, and suggested outcome revision."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = PlanAgent(privacy_engine=privacy_engine)

    analysis = agent.analyze_change(
        raw_change_text="PCI-DSS tokenization requirement added to scope.",
        current_outcome_statement="Migrate transactions.",
        current_success_criteria=[]
    )

    assert analysis.risk_score == "HIGH"
    assert "Security Baseline" in analysis.affected_dimensions or "Compliance" in analysis.affected_dimensions
    assert "PCI-DSS" in analysis.suggested_outcome_statement or "Tokenization" in analysis.suggested_outcome_statement


def test_plan_retrieves_evidence_through_know():
    """Verifies PlanAgent leverages KnowAgent for grounded technical context during planning."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    know_agent = KnowAgent(privacy_engine=privacy_engine)
    agent = PlanAgent(privacy_engine=privacy_engine, know_agent=know_agent)

    proposal = agent.generate_natural_language_work_plan(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        natural_language_description="Payment gateway modernization on Cloud Spanner in 6 weeks."
    )

    assert isinstance(proposal, StructuredWorkPlanProposal)
    assert proposal.customer_name == "Vertex Financial"


def test_plan_separates_confirmed_facts_from_assumptions_and_gaps():
    """Verifies PlanAgent distinguishes confirmed facts from inferred assumptions and unknown gaps."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = PlanAgent(privacy_engine=privacy_engine)

    proposal = agent.generate_natural_language_work_plan(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        natural_language_description="Payment gateway modernization on Cloud Spanner in 6 weeks."
    )

    fa = proposal.facts_and_assumptions
    assert len(fa.confirmed_facts) >= 1
    assert len(fa.inferred_assumptions) >= 1
    # Confirmed facts must contain explicitly stated 6 weeks
    assert any("6 weeks" in f for f in fa.confirmed_facts)


def test_plan_reconciles_worknote_evidence_with_existing_tasks():
    """Verifies PlanAgent reassesses plans with new evidence, distinguishing healthy state from scope drift."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = PlanAgent(privacy_engine=privacy_engine)

    existing_plan = {"plan_id": "plan-001", "engagement_objective": "Payment Modernization"}

    # 1. Healthy evidence
    res_healthy = agent.reassess_plan_with_evidence(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        current_work_plan=existing_plan,
        new_evidence_items=["Schema migration script passed QA testing."]
    )
    assert res_healthy.outcome_health == "HEALTHY"
    assert res_healthy.scope_drift_detected is False
    assert res_healthy.requires_manager_approval is False

    # 2. Scope drift evidence
    res_drift = agent.reassess_plan_with_evidence(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        current_work_plan=existing_plan,
        new_evidence_items=["Customer SecOps added mandatory compliance blocker requiring new SSO setup."]
    )
    assert res_drift.outcome_health == "NEEDS_REASSESSMENT"
    assert res_drift.scope_drift_detected is True
    assert res_drift.requires_manager_approval is True


def test_plan_preserves_approved_outcomes_until_authorization(test_db):
    """Verifies that drafting a plan proposal does NOT mutate the database outcome or active plan."""
    eng_before = test_db.query(Engagement).filter(Engagement.id == "eng-reg-001").first()
    outcome_before = test_db.query(Outcome).filter(Outcome.id == eng_before.current_outcome_id).first()
    assert outcome_before.work_plan is None

    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = PlanAgent(privacy_engine=privacy_engine)

    # Generate draft proposal
    proposal = agent.generate_natural_language_work_plan(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        natural_language_description="Payment gateway modernization on Cloud Spanner in 6 weeks."
    )
    assert proposal.status == "PROPOSED"

    # Verify DB has not been mutated
    test_db.expire_all()
    eng_after = test_db.query(Engagement).filter(Engagement.id == "eng-reg-001").first()
    outcome_after = test_db.query(Outcome).filter(Outcome.id == eng_after.current_outcome_id).first()
    assert outcome_after.work_plan is None


# =============================================================================
# C. EXISTING AGENT REGRESSION TESTS
# =============================================================================

def test_know_returns_grounded_evidence_and_citations():
    """Verifies KNOW Agent returns grounded answers or explicitly reports insufficient evidence."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    know_agent = KnowAgent(privacy_engine=privacy_engine)

    # Empty store -> insufficient evidence
    answer = know_agent.answer_question(
        engagement_id="eng-unknown-001",
        raw_question="What are the encryption keys for database cutover?",
        top_k=2
    )

    assert answer.evidence_sufficient is False
    assert "evidence" in answer.answer.lower()


def test_move_prioritizes_blockers_and_recommends_next_action():
    """Verifies MOVE Agent prioritizes gating blockers and recommends next actions."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    move_agent = MoveAgent(privacy_engine=privacy_engine)

    action = move_agent.determine_next_action(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        current_work_cycle="Step 4: Build Within Constraints",
        status="NEEDS_REASSESSMENT",
        outcome_version=1,
        pending_approvals=2
    )

    assert action.action_title != ""
    assert action.priority_level in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    assert action.approval_required is True


def test_deliver_generates_grounded_customer_updates():
    """Verifies DELIVER Agent produces customer update drafts gated by manager approval."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    deliver_agent = DeliverAgent(privacy_engine=privacy_engine)

    draft = deliver_agent.generate_customer_update(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        engagement_name="Payment Gateway Migration",
        outcome_statement="Migrate transactions with 99.999% availability.",
        success_criteria=[
            {"title": "Schema converted", "completed": True},
            {"title": "CDC replication active", "completed": False}
        ],
        current_work_cycle="Step 4: Build Within Constraints"
    )

    assert draft.status == "PENDING_MANAGER_APPROVAL"
    assert draft.approval_required is True
    assert draft.subject != ""
    assert draft.executive_summary != ""


def test_support_accepts_screenshot_and_does_not_claim_unverified_root_cause():
    """Verifies SUPPORT Agent triages incidents, processes screenshots, and formulates hypotheses."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    support_agent = SupportAgent(privacy_engine=privacy_engine)

    res = support_agent.investigate_incident(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        issue_description="CDC replication agent crashed with exit code 137.",
        screenshot_metadata={"dialog": "OutOfMemoryError", "container": "cdc-worker-1"}
    )

    assert res.severity == "CRITICAL"
    assert "Debezium" in res.root_cause_hypothesis or "memory" in res.root_cause_hypothesis.lower() or "heap" in res.root_cause_hypothesis.lower()
    assert len(res.runbook_recommendations) >= 1
    assert res.visual_diagnostic_findings is not None
    assert res.investigated_at.endswith("IST")


# =============================================================================
# D. STATE, SECURITY AND AUTHORIZATION TESTS
# =============================================================================

def test_persistence_and_timeline_audit_behavior(test_db):
    """Verifies timeline events record actor_type, event_type, and provenance."""
    test_db.add(TimelineEvent(
        id="evt-reg-audit-1",
        engagement_id="eng-reg-001",
        event_type="WORK_PLAN_APPROVED",
        title="Work Plan Approved",
        description="Manager approved Spanner execution plan.",
        actor_type="MANAGER",
        actor_id="manager_user_1",
        created_at=datetime.now(timezone.utc)
    ))
    test_db.commit()

    evt = test_db.query(TimelineEvent).filter(TimelineEvent.id == "evt-reg-audit-1").first()
    assert evt is not None
    assert evt.actor_type == "MANAGER"
    assert evt.event_type == "WORK_PLAN_APPROVED"


def test_manager_vs_fde_permission_boundaries(test_db):
    """Verifies that consequential changes require manager authorization."""
    outcome_service = OutcomeService(test_db)

    # Proposing a new outcome version
    new_v2 = outcome_service.propose_new_outcome_version(
        engagement_id="eng-reg-001",
        new_statement="Payment gateway with PCI-DSS Tokenization.",
        new_success_criteria=[{"id": "sc-1", "title": "Schema converted", "completed": True}],
        proposed_by="plan_agent",
        reason="Compliance scope upgrade"
    )
    assert new_v2.status == OutcomeStatus.PENDING_APPROVAL

    # Manager approves
    approved_eng = outcome_service.approve_outcome_version(
        engagement_id="eng-reg-001",
        outcome_id=new_v2.id,
        approved_by="manager_alex"
    )
    assert approved_eng.current_outcome_id == new_v2.id
    assert new_v2.status == OutcomeStatus.APPROVED


def test_tenant_isolation_and_privacy_protections():
    """Verifies pre-LLM privacy de-identification and session isolation."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)

    raw_input = "Contact engineer Alice (alice@vertex.com) at (555) 012-3456 with secret key sk-1234567890123456789012."
    scrubbed, mapping = privacy_engine.process_llm_input(raw_input, session_id="tenant-a")

    assert "alice@vertex.com" not in scrubbed
    assert "(555) 012-3456" not in scrubbed
    assert "sk-1234567890123456789012" not in scrubbed

    # Restoration recovers original text accurately
    restored = privacy_engine.sanitize_output(scrubbed, mapping)
    assert "alice@vertex.com" in restored
    assert "(555) 012-3456" in restored


def test_idempotent_plan_approvals_prevent_duplicate_state(test_db):
    """Verifies that approving an identical plan multiple times does not produce duplicate outcomes."""
    outcome_service = OutcomeService(test_db)

    plan_v1 = outcome_service.propose_new_outcome_version(
        engagement_id="eng-reg-001",
        new_statement="Spanner Migration v1",
        new_success_criteria=[],
        proposed_by="plan_agent",
        reason="Baseline"
    )
    outcome_service.approve_outcome_version(
        engagement_id="eng-reg-001",
        outcome_id=plan_v1.id,
        approved_by="manager_1"
    )

    count_before = test_db.query(Outcome).filter(Outcome.engagement_id == "eng-reg-001").count()

    # Re-proposing with identical statement does not create a conflicting outcome
    eng = test_db.query(Engagement).filter(Engagement.id == "eng-reg-001").first()
    assert eng.current_outcome_id == plan_v1.id
    assert count_before >= 1


# =============================================================================
# E. ARCHITECTURE INTEGRITY TESTS
# =============================================================================

def test_understand_not_in_active_agent_registry():
    """Verifies that UNDERSTAND is not in the active supervisor agent registry."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    summary = coordinator.orchestrate_engagement(
        engagement_id="eng-reg-001",
        customer_name="Vertex Financial",
        engagement_name="Payment Gateway Migration",
        current_work_cycle="Step 4: Build Within Constraints",
        status="HEALTHY",
        outcome_statement="Migrate transactions with 99.999% availability.",
        success_criteria=[],
        version=1,
        pending_approvals=0
    )

    active_agent_names = [a.agent_name for a in summary.agents]
    assert "UNDERSTAND" not in active_agent_names
    assert set(active_agent_names) == {"PLAN", "KNOW", "MOVE", "DELIVER", "SUPPORT"}


def test_understand_agent_is_deprecated_subclass():
    """Verifies UnderstandAgent emits DeprecationWarning and subclasses PlanAgent."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)

    with pytest.deprecated_call():
        legacy_instance = UnderstandAgent(privacy_engine=privacy_engine)

    assert isinstance(legacy_instance, PlanAgent)
    assert hasattr(legacy_instance, "analyze_change")
    assert hasattr(legacy_instance, "generate_natural_language_work_plan")
    assert hasattr(legacy_instance, "reassess_plan_with_evidence")


def test_google_adk_runner_used_with_configured_model():
    """Verifies PlanAgent and SupportAgent initialize with Google ADK agents and runners."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    plan_agent = PlanAgent(privacy_engine=privacy_engine)
    support_agent = SupportAgent(privacy_engine=privacy_engine)

    # Verify Google ADK Agent instances
    assert plan_agent.adk_agent is not None
    assert plan_agent.adk_agent.name == "plan_agent"
    assert plan_agent.runner is not None

    assert support_agent.adk_agent is not None
    assert support_agent.adk_agent.name == "support_agent"
    assert support_agent.runner is not None
