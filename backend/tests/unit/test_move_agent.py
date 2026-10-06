import pytest
from app.agents.move_agent import MoveAgent

def test_move_agent_next_best_action():
    agent = MoveAgent()
    res = agent.determine_next_action(
        engagement_id="eng-acme-001",
        customer_name="Acme Corp",
        current_work_cycle="Step 4: Build Within Real Constraints",
        status="NEEDS_REASSESSMENT",
        outcome_version=1,
        pending_approvals=1
    )
    assert res.situation is not None
    assert res.recommendation is not None
    assert res.why_now is not None
    assert res.impact is not None
    assert res.confidence in ["High", "Medium", "Low"]
    assert res.approval_required is True

def test_move_agent_no_unverified_completion():
    agent = MoveAgent()
    res = agent.determine_next_action(
        engagement_id="eng-globex-002",
        customer_name="Globex Corp",
        current_work_cycle="Step 5: Deploy Into Production",
        status="HEALTHY",
        outcome_version=1,
        pending_approvals=0
    )
    # Recommends action without claiming unverified completion
    assert "dry-run" in res.recommendation.lower() or "checklist" in res.recommendation.lower()
