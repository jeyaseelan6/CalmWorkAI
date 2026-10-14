import pytest
import json
from app.agents.move_agent import MoveAgent
from app.agents.adk_runtime import set_mock_adk_response, clear_mock_adk_responses

@pytest.fixture(autouse=True)
def setup_move_mock():
    mock_resp = json.dumps({
        "situation": "Engagement is progressing in Step 4: Build Within Real Constraints.",
        "recommendation": "Execute staging deployment dry-run simulation and verification suite.",
        "why_now": "Maintains outcome delivery velocity.",
        "impact": "Advances progress towards validation readiness.",
        "evidence": ["Status: NEEDS_REASSESSMENT", "Current Work Cycle: Step 4"],
        "confidence": "High",
        "approval_required": True,
        "priority_level": "CRITICAL",
        "affected_role": "MANAGER"
    })
    set_mock_adk_response("current work cycle", mock_resp)
    set_mock_adk_response("blockers", mock_resp)
    yield
    clear_mock_adk_responses()

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

def test_move_agent_offline_raises_error():
    clear_mock_adk_responses()
    agent = MoveAgent()
    with pytest.raises(RuntimeError) as exc_info:
        agent.determine_next_action(
            engagement_id="eng-offline-001",
            customer_name="Offline Corp",
            current_work_cycle="Step 1: Understand the Business Reality",
            status="HEALTHY",
            outcome_version=1,
            pending_approvals=0
        )
    assert "AI service is currently unavailable" in str(exc_info.value)
