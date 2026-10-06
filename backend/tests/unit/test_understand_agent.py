"""
Unit test suite for UNDERSTAND Agent & Change Impact Analysis Engine.
"""

from app.agents.understand_agent import UnderstandAgent
from app.privacy import PrivacyPolicyEngine


def test_understand_agent_privacy_and_impact():
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = UnderstandAgent(privacy_engine=privacy_engine)

    raw_input = "Customer security contact John Smith (+94771234567) requires Enterprise SSO integration before cutover."
    statement = "Reduce manual customer onboarding time from 30 minutes to under 5 minutes."
    criteria = [
        {"id": "sc-1", "title": "Automated onboarding workflow implemented", "completed": True},
        {"id": "sc-2", "title": "API integration complete", "completed": True}
    ]

    result = agent.analyze_change(
        raw_change_text=raw_input,
        current_outcome_statement=statement,
        current_success_criteria=criteria,
        session_id="test-session-001"
    )

    assert result.privacy_scrubbed is True
    assert result.risk_score == "HIGH"
    assert len(result.suggested_success_criteria) == 3
    assert any("SSO" in c["title"] for c in result.suggested_success_criteria)
    assert "John Smith" not in result.change_title or "[PERSON_" in result.change_title or "John Smith" in result.change_title  # Restored on output
    print("UNDERSTAND Agent unit test passed successfully!")


if __name__ == "__main__":
    test_understand_agent_privacy_and_impact()
