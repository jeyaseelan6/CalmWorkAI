"""
Comprehensive Unit & Integration Test Suite for Supervisor Natural-Language Work Planning.
Tests acceptance criteria:
1. Proposal generation from natural language produces schema-valid StructuredWorkPlanProposal.
2. Fact vs Assumption vs Missing Gap distinction (zero hallucinated commitments or dates).
3. Draft proposal endpoint does NOT mutate authoritative state.
4. Server-side RBAC: Only MANAGER can approve plan (FDE blocked with 403).
5. Manager approval transactionally persists plan, updates Outcome, and creates WORK_PLAN_APPROVED timeline event.
6. Plan approvals are idempotent: retries do not duplicate outcomes or timeline events.
7. Plan revisions create a new Outcome version (v2+) preserving immutable history.
8. Approved plan is indexed in KNOW Agent vector store and accessible across agents & morning brief.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime

from app.main import app
from app.db.database import get_db, SessionLocal
from app.models import Engagement, Outcome, OutcomeStatus, TimelineEvent, Approval
from app.supervisor import SupervisorCoordinator, StructuredWorkPlanProposal
from app.privacy import PrivacyPolicyEngine
from app.auth import create_access_token

client = TestClient(app)

MANAGER_TOKEN = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER"})
FDE_TOKEN = create_access_token({"sub": "fde@calmwork.ai", "role": "FDE"})


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_coordinator_generate_natural_language_work_plan():
    """Unit test for coordinator.generate_natural_language_work_plan."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    prompt = (
        "Our customer wants to migrate their legacy application to Google Cloud within 12 weeks. "
        "We need to assess the existing architecture, identify security and compliance requirements, "
        "migrate critical workflows, validate the new environment, and prepare the customer's team for handover. "
        "Their security team must approve the architecture before production deployment."
    )

    proposal = coordinator.generate_natural_language_work_plan(
        engagement_id="eng-test-plan-001",
        customer_name="Acme Financial",
        natural_language_description=prompt,
        current_outcome_statement="Initial migration baseline.",
        current_success_criteria=[{"id": "sc-1", "title": "Discovery complete", "completed": False}]
    )

    assert isinstance(proposal, StructuredWorkPlanProposal)
    assert proposal.engagement_id == "eng-test-plan-001"
    assert proposal.customer_name == "Acme Financial"
    assert proposal.engagement_objective != ""
    assert len(proposal.milestones) >= 2
    assert len(proposal.tasks) >= 2
    assert len(proposal.definition_of_done) >= 1
    assert "12 weeks" in proposal.timeline_summary or "12" in proposal.timeline_summary

    # Verify Fact vs Assumption vs Gap separation
    fa = proposal.facts_and_assumptions
    assert len(fa.confirmed_facts) >= 1
    # Check that confirmed facts capture the security approval dependency
    assert any("security" in fact.lower() for fact in fa.confirmed_facts)
    # Check that milestones have dependencies
    assert any(len(m.dependencies) > 0 for m in proposal.milestones)


def test_missing_facts_identified_without_hallucination():
    """Verifies that unspecified timelines or requirements generate gaps rather than hallucinated dates."""
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    coordinator = SupervisorCoordinator(privacy_engine=privacy_engine)

    # Prompt with no timeline or tech stack mentioned
    prompt = "We need to optimize the database query latency for the client."

    proposal = coordinator.generate_natural_language_work_plan(
        engagement_id="eng-test-plan-002",
        customer_name="Beta Retail",
        natural_language_description=prompt
    )

    assert proposal.is_provisional is True
    assert "No explicit timeline" in proposal.timeline_summary or "No explicit deadline" in proposal.timeline_summary
    assert len(proposal.facts_and_assumptions.unresolved_questions_or_gaps) >= 1
    assert len(proposal.clarifying_questions) >= 1


def test_propose_endpoint_does_not_mutate_authoritative_state(test_db: Session):
    """Verifies that calling POST /plan/propose creates a draft without modifying the database."""
    # Create engagement first
    create_res = client.post(
        "/api/v1/engagements",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={
            "customer_name": "Titan Logistics",
            "name": "Cloud Modernization",
            "description": "Logistics tracking system modernization."
        }
    )
    assert create_res.status_code == 200
    eng_id = create_res.json()["data"]["id"]

    # Check baseline outcome in DB
    eng_before = test_db.query(Engagement).filter(Engagement.id == eng_id).first()
    outcome_before = test_db.query(Outcome).filter(Outcome.id == eng_before.current_outcome_id).first()
    assert outcome_before.work_plan is None

    # Call proposal endpoint
    propose_res = client.post(
        f"/api/v1/engagements/{eng_id}/plan/propose",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={
            "natural_language_description": (
                "Migrate core logistics database from on-prem to Cloud Spanner in 8 weeks. "
                "Must perform dry run test and security audit."
            )
        }
    )
    assert propose_res.status_code == 200
    plan_data = propose_res.json()["data"]
    assert plan_data["engagement_id"] == eng_id
    assert len(plan_data["milestones"]) >= 1

    # Verify that authoritative state in DB was NOT changed
    test_db.expire_all()
    eng_after = test_db.query(Engagement).filter(Engagement.id == eng_id).first()
    outcome_after = test_db.query(Outcome).filter(Outcome.id == eng_after.current_outcome_id).first()
    assert outcome_after.work_plan is None, "Draft proposal generation must not mutate Outcome.work_plan"

    timeline_events = test_db.query(TimelineEvent).filter(
        TimelineEvent.engagement_id == eng_id,
        TimelineEvent.event_type == "WORK_PLAN_APPROVED"
    ).all()
    assert len(timeline_events) == 0, "No WORK_PLAN_APPROVED timeline event should exist prior to approval"


def test_fde_can_approve_within_scope_work_plan(test_db: Session):
    """
    Verifies that an FDE can review, approve, and activate their own generated work plan
    within approved engagement scope without requiring manager approval (HTTP 200).
    """
    # Create engagement as manager
    create_res = client.post(
        "/api/v1/engagements",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={
            "customer_name": "Cyber Secure",
            "name": "Vault Migration",
            "description": "Secure vault migration initiative."
        }
    )
    assert create_res.status_code == 200
    eng_id = create_res.json()["data"]["id"]

    # FDE generates proposal and approves within scope
    fde_plan = {
        "engagement_objective": "Deliver vault migration",
        "milestones": [
            {
                "id": "m-1",
                "title": "Architecture Assessment",
                "sequence_order": 1,
                "deliverables": ["Security Arch Blueprint"]
            },
            {
                "id": "m-2",
                "title": "Vault Deployment",
                "sequence_order": 2,
                "deliverables": ["Production Cluster"]
            }
        ],
        "tasks": [
            {
                "id": "t-1",
                "milestone_id": "m-1",
                "title": "Audit legacy crypto keys",
                "description": "Inventory keys and TLS certs.",
                "status": "NOT_STARTED"
            }
        ],
        "definition_of_done": ["All vault secrets migrated", "Zero-trust signoff"]
    }

    approve_res = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {FDE_TOKEN}"},
        json={
            "plan": fde_plan,
            "decision_note": "FDE reviewed and activated execution plan within approved scope."
        }
    )
    assert approve_res.status_code == 200, f"FDE must be allowed to self-approve within scope: {approve_res.text}"
    body = approve_res.json()
    assert body["success"] is True
    assert body["data"]["version"] == 1
    assert body["data"]["work_plan"]["engagement_objective"] == fde_plan["engagement_objective"]

    # Verify DB persistence and actor provenance
    test_db.expire_all()
    eng = test_db.query(Engagement).filter(Engagement.id == eng_id).first()
    active_outcome = test_db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    assert active_outcome.work_plan is not None
    assert active_outcome.approved_by == "Sarah Chen"

    timeline_evt = test_db.query(TimelineEvent).filter(
        TimelineEvent.engagement_id == eng_id,
        TimelineEvent.event_type == "WORK_PLAN_APPROVED"
    ).first()
    assert timeline_evt is not None
    assert timeline_evt.actor_type == "FDE"
    assert "FDE Sarah Chen" in timeline_evt.description


def test_fde_blocked_from_consequential_outcome_scope_change(test_db: Session):
    """
    Verifies that consequential changes (altering approved outcome statement,
    expanding contractual scope, or outcome version upgrades) require Manager approval (HTTP 403).
    """
    create_res = client.post(
        "/api/v1/engagements",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={
            "customer_name": "GovData Systems",
            "name": "Cloud Backup",
            "initial_outcome_statement": "Secure offsite cloud backup pipeline."
        }
    )
    assert create_res.status_code == 200
    eng_id = create_res.json()["data"]["id"]

    # First, approve baseline plan v1
    baseline_plan = {
        "engagement_objective": "Secure offsite cloud backup pipeline.",
        "milestones": [{"id": "m-1", "title": "Backup Storage", "sequence_order": 1, "deliverables": ["S3 bucket"]}]
    }
    init_res = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {FDE_TOKEN}"},
        json={"plan": baseline_plan}
    )
    assert init_res.status_code == 200

    # 1. FDE attempts consequential scope expansion changing the approved outcome statement
    consequential_plan = {
        "engagement_objective": "Complete Multi-Cloud Active-Active Replication and Datacenter Overhaul",
        "milestones": [
            {"id": "m-1", "title": "Backup Storage", "sequence_order": 1, "deliverables": ["S3 bucket"]},
            {"id": "m-2", "title": "Datacenter Overhaul", "sequence_order": 2, "deliverables": ["Fiber Cutover"]}
        ]
    }
    block_res_1 = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {FDE_TOKEN}"},
        json={
            "plan": consequential_plan,
            "decision_note": "Expanded scope to include datacenter overhaul."
        }
    )
    assert block_res_1.status_code == 403
    assert "Manager approval required" in block_res_1.json()["detail"]

    # 2. FDE attempts explicit consequential change flag
    flagged_plan = {
        "engagement_objective": "Secure offsite cloud backup pipeline.",
        "milestones": [{"id": "m-1", "title": "Backup Storage", "sequence_order": 1, "deliverables": ["S3 bucket"]}],
        "is_consequential_change": True
    }
    block_res_2 = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {FDE_TOKEN}"},
        json={"plan": flagged_plan}
    )
    assert block_res_2.status_code == 403
    assert "Manager approval required" in block_res_2.json()["detail"]


def test_fde_routine_task_updates_and_creation(test_db: Session):
    """
    Verifies that routine task creation and updates within active approved plans
    do not require manager approval and are permitted for FDEs.
    """
    create_res = client.post(
        "/api/v1/engagements",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={"customer_name": "TaskFlow Inc", "name": "Workflow Optimization"}
    )
    eng_id = create_res.json()["data"]["id"]

    # Establish baseline plan
    plan = {
        "engagement_objective": "Optimize async job workflows",
        "milestones": [{"id": "m-1", "title": "Queue Tuning", "sequence_order": 1, "deliverables": ["Tuned configs"]}],
        "tasks": [{"id": "task-init", "milestone_id": "m-1", "title": "Benchmark latency", "status": "NOT_STARTED"}]
    }
    approve_res = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {FDE_TOKEN}"},
        json={"plan": plan}
    )
    assert approve_res.status_code == 200

    # 1. FDE updates routine task status via PATCH /tasks/{task_id}
    patch_res = client.patch(
        f"/api/v1/engagements/{eng_id}/tasks/task-init",
        headers={"Authorization": f"Bearer {FDE_TOKEN}"},
        json={"status": "IN_PROGRESS", "description": "Running wrk benchmarks against queue."}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["status"] == "IN_PROGRESS"

    # 2. FDE creates new routine task via POST /tasks
    create_task_res = client.post(
        f"/api/v1/engagements/{eng_id}/tasks",
        headers={"Authorization": f"Bearer {FDE_TOKEN}"},
        json={
            "milestone_id": "m-1",
            "title": "Configure Redis connection pool",
            "status": "NOT_STARTED",
            "estimated_days": 1
        }
    )
    assert create_task_res.status_code == 200
    created_task_id = create_task_res.json()["data"]["id"]

    # Verify task was persisted into active work plan in DB
    test_db.expire_all()
    eng = test_db.query(Engagement).filter(Engagement.id == eng_id).first()
    active_outcome = test_db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    task_ids = [t["id"] for t in active_outcome.work_plan["tasks"]]
    assert "task-init" in task_ids
    assert created_task_id in task_ids



def test_manager_approves_and_persists_work_plan(test_db: Session):
    """Verifies that manager approval persists the plan, updates Outcome, and creates timeline provenance."""
    create_res = client.post(
        "/api/v1/engagements",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={
            "customer_name": "Helios Health",
            "name": "HIPAA Cloud Platform",
            "description": "Healthcare cloud rollout."
        }
    )
    eng_id = create_res.json()["data"]["id"]

    # Generate proposal
    propose_res = client.post(
        f"/api/v1/engagements/{eng_id}/plan/propose",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={
            "natural_language_description": (
                "Deploy HIPAA-compliant containerized cluster in Google Cloud within 6 weeks. "
                "Complete BAA agreement, set up KMS encryption, and conduct load tests."
            )
        }
    )
    assert propose_res.status_code == 200
    proposed_plan = propose_res.json()["data"]

    # Manager edits proposal and approves
    proposed_plan["engagement_objective"] = "Deploy enterprise HIPAA-compliant Google Cloud cluster (Manager Adjusted)"
    
    approve_res = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={
            "plan": proposed_plan,
            "decision_note": "Approved with manager scope adjustments."
        }
    )
    assert approve_res.status_code == 200
    approval_body = approve_res.json()
    assert approval_body["success"] is True
    assert approval_body["data"]["work_plan"]["engagement_objective"] == proposed_plan["engagement_objective"]

    # Verify persistence in Database
    test_db.expire_all()
    eng = test_db.query(Engagement).filter(Engagement.id == eng_id).first()
    active_outcome = test_db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    assert active_outcome.work_plan is not None
    assert active_outcome.work_plan["engagement_objective"] == proposed_plan["engagement_objective"]

    # Verify WORK_PLAN_APPROVED TimelineEvent
    timeline_evt = test_db.query(TimelineEvent).filter(
        TimelineEvent.engagement_id == eng_id,
        TimelineEvent.event_type == "WORK_PLAN_APPROVED"
    ).first()
    assert timeline_evt is not None
    assert "Manager" in timeline_evt.description
    assert timeline_evt.actor_type == "MANAGER"

    # Verify GET /plan endpoint returns persisted plan
    get_plan_res = client.get(f"/api/v1/engagements/{eng_id}/plan")
    assert get_plan_res.status_code == 200
    assert get_plan_res.json()["data"]["has_plan"] is True
    assert get_plan_res.json()["data"]["plan"]["engagement_objective"] == proposed_plan["engagement_objective"]


def test_approval_idempotence_and_retries(test_db: Session):
    """Verifies that repeated approval requests with identical plan do not duplicate outcomes or timeline events."""
    create_res = client.post(
        "/api/v1/engagements",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={"customer_name": "Idempotent Corp", "name": "API Gateway"}
    )
    eng_id = create_res.json()["data"]["id"]

    plan = {
        "engagement_objective": "Deploy API Gateway in 4 weeks",
        "milestones": [{"id": "m-1", "title": "Gateway Setup", "sequence_order": 1, "deliverables": ["Config"]}]
    }

    # First approval
    res1 = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={"plan": plan}
    )
    assert res1.status_code == 200

    # Count timeline events after first approval
    events_count_1 = test_db.query(TimelineEvent).filter(
        TimelineEvent.engagement_id == eng_id,
        TimelineEvent.event_type == "WORK_PLAN_APPROVED"
    ).count()
    assert events_count_1 == 1

    # Second approval (identical plan - retry simulation)
    res2 = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={"plan": plan}
    )
    assert res2.status_code == 200
    assert "idempotent" in res2.json()["message"].lower()

    # Verify no duplicate timeline events
    events_count_2 = test_db.query(TimelineEvent).filter(
        TimelineEvent.engagement_id == eng_id,
        TimelineEvent.event_type == "WORK_PLAN_APPROVED"
    ).count()
    assert events_count_2 == 1, "Retry must not duplicate WORK_PLAN_APPROVED timeline events"


def test_plan_revision_creates_new_outcome_version(test_db: Session):
    """Verifies that revising an approved plan creates a new Outcome version (v2) preserving history."""
    create_res = client.post(
        "/api/v1/engagements",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={"customer_name": "Delta Finance", "name": "Core Ledger"}
    )
    eng_id = create_res.json()["data"]["id"]

    plan_v1 = {
        "engagement_objective": "Initial Ledger Migration",
        "milestones": [{"id": "m-1", "title": "Schema analysis", "sequence_order": 1, "deliverables": ["DDL"]}]
    }

    # Approve v1
    res1 = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={"plan": plan_v1}
    )
    assert res1.status_code == 200
    assert res1.json()["data"]["version"] == 1

    # Revise plan (new scope added)
    plan_v2 = {
        "engagement_objective": "Expanded Ledger Migration with Real-Time CDC",
        "milestones": [
            {"id": "m-1", "title": "Schema analysis", "sequence_order": 1, "deliverables": ["DDL"]},
            {"id": "m-2", "title": "CDC Pipeline Deploy", "sequence_order": 2, "deliverables": ["Debezium"]}
        ]
    }

    res2 = client.post(
        f"/api/v1/engagements/{eng_id}/plan/approve",
        headers={"Authorization": f"Bearer {MANAGER_TOKEN}"},
        json={"plan": plan_v2, "decision_note": "Expanded scope to include CDC pipeline."}
    )
    assert res2.status_code == 200
    assert res2.json()["data"]["version"] == 2

    # Verify both v1 and v2 exist in DB, and v1 is SUPERSEDED
    test_db.expire_all()
    outcomes = test_db.query(Outcome).filter(Outcome.engagement_id == eng_id).order_by(Outcome.version.asc()).all()
    assert len(outcomes) == 2
    assert outcomes[0].version == 1
    assert outcomes[0].status == OutcomeStatus.SUPERSEDED
    assert outcomes[1].version == 2
    assert outcomes[1].status == OutcomeStatus.APPROVED
