"""
Unit test suite for DELIVER Agent & Customer Communication Engine.
"""

from app.agents.deliver_agent import DeliverAgent
from app.privacy import PrivacyPolicyEngine


def test_deliver_agent_customer_update():
    privacy_engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    agent = DeliverAgent(privacy_engine=privacy_engine)

    engagement_id = "eng-acme-001"
    customer_name = "Acme Corp"
    engagement_name = "Onboarding Modernization"
    statement = "Reduce manual customer onboarding time from 30 minutes to under 5 minutes."
    criteria = [
        {"id": "sc-1", "title": "Automated onboarding workflow implemented", "completed": True},
        {"id": "sc-2", "title": "API integration complete", "completed": True},
        {"id": "sc-3", "title": "Production validation complete", "completed": False}
    ]

    draft = agent.generate_customer_update(
        engagement_id=engagement_id,
        customer_name=customer_name,
        engagement_name=engagement_name,
        outcome_statement=statement,
        success_criteria=criteria,
        current_work_cycle="Step 4: Build Within Real Constraints",
        raw_notes="Contact John Smith (+94771234567) regarding SSO requirements."
    )

    assert draft.status == "DRAFT"
    assert "Acme Corp" in draft.customer_name
    assert len(draft.key_milestones_achieved) >= 2
    assert "Executive Update" in draft.subject
    print("DELIVER Agent unit test passed successfully!")


if __name__ == "__main__":
    test_deliver_agent_customer_update()
