import pytest
import json
from app.agents.deliver_agent import DeliverAgent
from app.agents.adk_runtime import set_mock_adk_response, clear_mock_adk_responses

@pytest.fixture(autouse=True)
def setup_deliver_mock():
    mock_resp = json.dumps({
        "subject": "Executive Update: Acme Corp — Progress",
        "executive_summary": "We are actively advancing the onboarding modernization initiative for Acme Corp.",
        "key_milestones_achieved": ["API integration"],
        "next_milestone_target": "Final production validation.",
        "customer_action_items": ["Review milestone progress during next sync."]
    })
    set_mock_adk_response("engineer notes", mock_resp)
    set_mock_adk_response("target outcome", mock_resp)
    yield
    clear_mock_adk_responses()

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

def test_deliver_agent_offline_raises_error():
    clear_mock_adk_responses()
    agent = DeliverAgent()
    with pytest.raises(RuntimeError) as exc_info:
        agent.generate_customer_update(
            engagement_id="eng-offline-001",
            customer_name="Offline Corp",
            engagement_name="Offline Migration",
            outcome_statement="Migrate database.",
            success_criteria=[],
            current_work_cycle="Step 1: Understand the Business Reality",
            format_type="EXECUTIVE_SUMMARY"
        )
    assert "AI service is currently unavailable" in str(exc_info.value)
