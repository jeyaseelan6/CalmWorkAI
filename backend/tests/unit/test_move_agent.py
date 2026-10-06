"""
Unit test suite for MOVE Agent & Next Best Action Engine.
"""

from app.agents.move_agent import MoveAgent
from app.privacy import PrivacyPolicyEngine


def test_move_agent_next_action():
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = MoveAgent(privacy_engine=privacy_engine)

    # Scenario 1: Acme Corp with SSO blocker
    res1 = agent.determine_next_action(
        engagement_id="eng-acme-001",
        customer_name="Acme Corp",
        current_work_cycle="Step 4: Build Within Real Constraints",
        status="NEEDS_REASSESSMENT",
        outcome_version=1,
        blockers=[{"id": "blk-001", "title": "SSO Configuration"}]
    )

    assert res1.priority_level == "CRITICAL"
    assert "SSO" in res1.action_title
    assert res1.gating_blocker is not None

    # Scenario 2: Globex Corp in Step 5 deployment
    res2 = agent.determine_next_action(
        engagement_id="eng-globex-002",
        customer_name="Globex Corp",
        current_work_cycle="Step 5: Deploy Into Production",
        status="HEALTHY",
        outcome_version=1
    )

    assert res2.priority_level == "HIGH_PRIORITY"
    assert "cutover" in res2.action_title.lower() or "staging" in res2.action_title.lower()
    print("MOVE Agent unit test passed successfully!")


if __name__ == "__main__":
    test_move_agent_next_action()
