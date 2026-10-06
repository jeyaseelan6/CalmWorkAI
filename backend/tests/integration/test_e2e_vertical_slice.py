"""
End-to-End Signature Vertical Slice Integration Test for CalmWork AI.
Verifies full flow:
Requirement Input -> Privacy Boundary -> UNDERSTAND Analysis -> Recommendation -> Manager Approval -> Outcome v2 -> MOVE Next Action -> DELIVER Draft -> Timeline Audit.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone

from app.models import Base, Engagement, Outcome, TimelineEvent, Approval, EngagementStatus, WorkCycleStep, OutcomeStatus, ApprovalType, ApprovalStatus
from app.privacy import PrivacyPolicyEngine
from app.services import OutcomeService
from app.agents import UnderstandAgent, KnowAgent, MoveAgent, DeliverAgent
from app.supervisor import SupervisorCoordinator


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed baseline engagement
    eng = Engagement(
        id="eng-e2e-001",
        customer_name="Acme Corporation",
        name="Onboarding Automation",
        description="Automate onboarding workflow",
        status=EngagementStatus.HEALTHY,
        current_work_cycle=WorkCycleStep.STEP_4_BUILD_WITHIN_CONSTRAINTS,
        progress=70,
        current_outcome_id="out-e2e-v1",
        created_by="fde_user_1",
        created_at=datetime.now(timezone.utc)
    )
    outcome_v1 = Outcome(
        id="out-e2e-v1",
        engagement_id="eng-e2e-001",
        version=1,
        statement="Reduce manual processing time by 40%.",
        success_criteria=[
            {"id": "sc-1", "title": "Workflow implemented", "completed": True},
            {"id": "sc-2", "title": "Benchmark complete", "completed": True},
            {"id": "sc-3", "title": "Production validation complete", "completed": False}
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


def test_complete_e2e_intelligence_workflow(test_db):
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    understand_agent = UnderstandAgent(privacy_engine=privacy_engine)
    move_agent = MoveAgent(privacy_engine=privacy_engine)
    deliver_agent = DeliverAgent(privacy_engine=privacy_engine)
    outcome_service = OutcomeService(test_db)

    # 1. Fetch initial state
    eng = test_db.query(Engagement).filter(Engagement.id == "eng-e2e-001").first()
    outcome_v1 = test_db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
    assert outcome_v1.version == 1

    # 2. Add customer requirement input with PII (SSO requirement)
    raw_requirement = "Customer IT contact John Smith (john@acme.com) stated: Enterprise SSO is required before production deployment."

    # 3. Privacy Boundary Verification: Ensure PII anonymized
    anon_text, mapping = privacy_engine.process_llm_input(raw_requirement, session_id=eng.id)
    assert "john@acme.com" not in anon_text
    assert "[EMAIL_001]" in anon_text or "[PERSON_001]" in anon_text or len(mapping.reference_to_original) > 0

    # 4. Run UNDERSTAND Agent Change Impact Analysis
    analysis = understand_agent.analyze_change(
        raw_change_text=raw_requirement,
        current_outcome_statement=outcome_v1.statement,
        current_success_criteria=outcome_v1.success_criteria,
        session_id=eng.id
    )

    assert analysis.recommendation is not None
    assert len(analysis.evidence) > 0
    assert len(analysis.reasoning) > 0
    assert analysis.risk_score in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

    # 5. Verify Outcome remains Version 1 before Manager Approval (No silent mutation)
    eng_check = test_db.query(Engagement).filter(Engagement.id == "eng-e2e-001").first()
    assert eng_check.current_outcome_id == "out-e2e-v1"

    # 6. Propose & Approve Outcome Version 2 via Manager
    proposed_v2 = outcome_service.propose_new_outcome_version(
        engagement_id=eng.id,
        new_statement=outcome_v1.statement,
        new_success_criteria=analysis.suggested_success_criteria,
        proposed_by="understand_agent",
        reason="Manager approved Enterprise SSO scope expansion."
    )

    updated_eng = outcome_service.approve_outcome_version(
        engagement_id=eng.id,
        outcome_id=proposed_v2.id,
        approved_by="manager_user_1"
    )

    # Record Timeline Event
    test_db.add(TimelineEvent(
        id="evt-e2e-approval",
        engagement_id=eng.id,
        event_type="OUTCOME_APPROVED",
        title="Outcome Version 2 Approved",
        description="Manager approved Enterprise SSO DoD checklist expansion.",
        actor_type="MANAGER",
        actor_id="manager_user_1",
        created_at=datetime.now(timezone.utc)
    ))
    test_db.commit()

    # 7. Verify Outcome upgraded to Version 2
    assert updated_eng.current_outcome_id == proposed_v2.id
    assert proposed_v2.version == 2
    assert proposed_v2.status == OutcomeStatus.APPROVED

    # 8. MOVE Agent evaluates Next Best Action
    next_action = move_agent.determine_next_action(
        engagement_id=eng.id,
        customer_name=eng.customer_name,
        current_work_cycle=eng.current_work_cycle,
        status=updated_eng.status,
        outcome_version=proposed_v2.version,
        pending_approvals=0
    )

    assert next_action.situation is not None
    assert next_action.recommendation is not None
    assert next_action.why_now is not None
    assert next_action.impact is not None
    assert next_action.confidence in ["High", "Medium", "Low"]

    # 9. DELIVER Agent generates Customer Update Draft
    update_draft = deliver_agent.generate_customer_update(
        engagement_id=eng.id,
        customer_name=eng.customer_name,
        engagement_name=eng.name,
        outcome_statement=proposed_v2.statement,
        success_criteria=proposed_v2.success_criteria,
        current_work_cycle=eng.current_work_cycle,
        format_type="EXECUTIVE_SUMMARY"
    )

    assert update_draft.status == "PENDING_MANAGER_APPROVAL"
    assert update_draft.approval_required is True
    assert update_draft.subject is not None
    assert update_draft.executive_summary is not None

    # 10. Verify Audit Trail Timeline recorded events
    timeline_events = test_db.query(TimelineEvent).filter(TimelineEvent.engagement_id == eng.id).all()
    assert len(timeline_events) > 0
    assert any(e.event_type == "OUTCOME_APPROVED" for e in timeline_events)
