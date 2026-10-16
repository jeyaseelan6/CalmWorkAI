"""
Unit tests for the Morning Brief Agentic Skill.
Tests manifest metadata, execution engine, persistence, latest retrieval,
batch execution, and API endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime

from app.main import app
from app.db.database import get_db, SessionLocal
from app.models import Engagement, Outcome, OutcomeStatus, TimelineEvent, WorkCycleStep
from app.skills import (
    morning_brief_skill,
    morning_brief_manifest,
    start_morning_brief_scheduler,
    stop_morning_brief_scheduler
)
from app.skills.morning_brief.scheduler import compute_seconds_until_8am_ist
from app.auth.security import create_access_token

client = TestClient(app)
FDE_TOKEN = create_access_token({"sub": "fde@calmwork.ai", "role": "FDE", "name": "Sarah Chen"})
MGR_TOKEN = create_access_token({"sub": "manager@calmwork.ai", "role": "MANAGER", "name": "David Miller"})


@pytest.fixture
def test_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def sample_engagement(test_db: Session):
    import uuid
    uid = uuid.uuid4().hex[:8]
    eng_id = f"eng-test-skill-{uid}"
    out_id = f"out-test-skill-{uid}"

    eng = Engagement(
        id=eng_id,
        customer_name="SkillCorp",
        name="Agentic Skill Deployment",
        description="Testing Morning Brief Agentic Skill.",
        status="HEALTHY",
        current_work_cycle=WorkCycleStep.STEP_4_BUILD_WITHIN_CONSTRAINTS,
        progress=60,
        current_outcome_id=out_id,
        created_by="Sarah Chen",
        created_at=datetime.utcnow()
    )
    test_db.add(eng)

    outcome = Outcome(
        id=out_id,
        engagement_id=eng_id,
        version=1,
        statement="Deliver modular agentic skill with 8:00 AM IST automation.",
        success_criteria=[
            {"id": "sc-1", "title": "Implement skill manifest and procedure", "completed": True},
            {"id": "sc-2", "title": "Configure 8am IST scheduler", "completed": False}
        ],
        status=OutcomeStatus.APPROVED,
        created_by="Sarah Chen",
        created_at=datetime.utcnow()
    )
    test_db.add(outcome)
    test_db.commit()

    return eng


def test_morning_brief_manifest():
    """Verify that skill manifest contains declarative metadata and 08:00 AM IST schedule."""
    manifest = morning_brief_manifest
    assert manifest.skill_id == "skill_morning_brief"
    assert manifest.name == "Morning Brief Skill"
    assert manifest.execution_mode == "MANUAL_ON_DEMAND"
    assert manifest.schedule_timezone == "Asia/Kolkata"
    assert "ON_DEMAND" in manifest.supported_triggers
    assert "CHAT_INTENT" in manifest.supported_triggers
    assert set(["PLAN", "KNOW", "MOVE", "SUPERVISOR"]).issubset(set(manifest.participating_agents))


def test_compute_seconds_until_8am_ist():
    """Verify calculation of seconds until next 08:00 AM IST."""
    seconds = compute_seconds_until_8am_ist()
    assert isinstance(seconds, float)
    assert 0 <= seconds <= 86400  # Within 24 hours


def test_morning_brief_skill_execute_and_persist(test_db: Session, sample_engagement: Engagement):
    """Verify on-demand execution and automatic persistence into timeline."""
    brief = morning_brief_skill.execute_and_persist(
        engagement_id=sample_engagement.id,
        db=test_db,
        trigger_source="ON_DEMAND_TEST"
    )

    assert brief.engagement_id == sample_engagement.id
    assert brief.customer_name == "SkillCorp"
    assert brief.what_matters_today_outcome == "Deliver modular agentic skill with 8:00 AM IST automation."
    assert len(brief.proposed_work_plan.work_items) > 0
    assert "IST" in brief.proposed_work_plan.work_items[0].due_date

    # Verify persistence in timeline_events
    evt = test_db.query(TimelineEvent).filter(
        TimelineEvent.engagement_id == sample_engagement.id,
        TimelineEvent.event_type == "MORNING_BRIEF_GENERATED"
    ).order_by(TimelineEvent.created_at.desc()).first()

    assert evt is not None
    assert evt.actor_type == "SKILL"
    assert evt.actor_id == "skill_morning_brief"
    assert evt.metadata_json is not None
    assert evt.metadata_json["brief_id"] == brief.brief_id


def test_morning_brief_skill_get_latest_brief(test_db: Session, sample_engagement: Engagement):
    """Verify that get_latest_brief returns pre-computed brief with zero latency."""
    # First persist
    brief = morning_brief_skill.execute_and_persist(
        engagement_id=sample_engagement.id,
        db=test_db,
        trigger_source="PRE_COMPUTED"
    )

    latest = morning_brief_skill.get_latest_brief(sample_engagement.id, test_db)
    assert latest is not None
    assert latest["brief_id"] == brief.brief_id
    assert latest["customer_name"] == "SkillCorp"
    assert "persisted_at" in latest


def test_skills_api_endpoints(sample_engagement: Engagement):
    """Verify /api/v1/skills endpoints."""
    # 1. List skills
    res = client.get("/api/v1/skills")
    assert res.status_code == 200
    skills = res.json()["data"]
    assert any(s["skill_id"] == "skill_morning_brief" for s in skills)

    res_man = client.get("/api/v1/skills/morning-brief/manifest")
    assert res_man.status_code == 200
    assert res_man.json()["data"]["execution_mode"] == "MANUAL_ON_DEMAND"
    assert "ON_DEMAND" in res_man.json()["data"]["supported_triggers"]

    # 3. Execute on-demand via API
    res_exec = client.post(
        f"/api/v1/skills/morning-brief/execute/{sample_engagement.id}",
        headers={"Authorization": f"Bearer {FDE_TOKEN}"}
    )
    assert res_exec.status_code == 200
    assert res_exec.json()["data"]["customer_name"] == "SkillCorp"

    # 4. Get latest via API
    res_lat = client.get(f"/api/v1/skills/morning-brief/latest/{sample_engagement.id}")
    assert res_lat.status_code == 200
    assert res_lat.json()["has_brief"] is True

    # 5. Get latest via supervisor compatibility endpoint
    res_sup_lat = client.get(f"/api/v1/engagements/{sample_engagement.id}/supervisor/brief/latest")
    assert res_sup_lat.status_code == 200
    assert res_sup_lat.json()["has_brief"] is True

    # 6. Trigger batch (simulating Cloud Scheduler webhook)
    res_batch = client.post("/api/v1/skills/morning-brief/trigger-batch")
    assert res_batch.status_code == 200
    assert res_batch.json()["processed_count"] > 0
