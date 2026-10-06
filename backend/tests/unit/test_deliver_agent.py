import pytest
from app.agents.deliver_agent import DeliverAgent

def test_deliver_agent_generates_draft_for_approval():
    agent = DeliverAgent()
    draft = agent.generate_customer_update(
        engagement_id="eng-acme-001",
        customer_name="Acme Corp",
        engagement_name="Onboarding Modernization",
        outcome_statement="Reduce onboarding time to under 5 min.",
        success_criteria=[{"title": "API integration", "completed": True}],
        current_work_cycle="Step 4: Build Within Real Constraints",
        format_type="EXECUTIVE_SUMMARY"
    )
    
    assert draft.status == "PENDING_MANAGER_APPROVAL"
    assert draft.approval_required is True
    assert draft.subject is not None
    assert draft.executive_summary is not None
