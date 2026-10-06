import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, Engagement, Outcome, EngagementStatus, WorkCycleStep, OutcomeStatus
from app.services.outcome_service import OutcomeService

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed engagement and outcome v1
    eng = Engagement(
        id="eng-test-approval",
        customer_name="Test Corp",
        name="Test Engagement",
        status=EngagementStatus.HEALTHY,
        current_work_cycle=WorkCycleStep.STEP_4_BUILD_WITHIN_CONSTRAINTS,
        progress=50,
        current_outcome_id="out-v1",
        created_by="fde_1"
    )
    outcome_v1 = Outcome(
        id="out-v1",
        engagement_id="eng-test-approval",
        version=1,
        statement="Initial outcome v1",
        success_criteria=[{"id": "sc-1", "title": "Base feature", "completed": True}],
        status=OutcomeStatus.APPROVED,
        created_by="fde_1"
    )
    session.add(eng)
    session.add(outcome_v1)
    session.commit()

    yield session
    session.close()

def test_unapproved_outcome_change_does_not_mutate_active_outcome(db_session):
    outcome_service = OutcomeService(db_session)
    proposed_v2 = outcome_service.propose_new_outcome_version(
        engagement_id="eng-test-approval",
        new_statement="Proposed outcome v2",
        new_success_criteria=[{"id": "sc-2", "title": "New feature", "completed": False}],
        proposed_by="understand_agent",
        reason="Scope shift proposed"
    )
    
    eng = db_session.query(Engagement).filter(Engagement.id == "eng-test-approval").first()
    # Active outcome remains v1 until approved
    assert eng.current_outcome_id == "out-v1"
    assert proposed_v2.status == OutcomeStatus.PENDING_APPROVAL

def test_approved_outcome_change_creates_new_version(db_session):
    outcome_service = OutcomeService(db_session)
    proposed_v2 = outcome_service.propose_new_outcome_version(
        engagement_id="eng-test-approval",
        new_statement="Approved outcome v2",
        new_success_criteria=[{"id": "sc-2", "title": "New feature", "completed": False}],
        proposed_by="understand_agent",
        reason="Manager approved change"
    )
    
    updated_eng = outcome_service.approve_outcome_version(
        engagement_id="eng-test-approval",
        outcome_id=proposed_v2.id,
        approved_by="manager_1"
    )
    
    assert updated_eng.current_outcome_id == proposed_v2.id
    assert proposed_v2.version == 2
    assert proposed_v2.status == OutcomeStatus.APPROVED
