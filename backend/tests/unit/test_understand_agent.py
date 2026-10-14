import pytest
import json
from app.agents.understand_agent import UnderstandAgent
from app.agents.adk_runtime import set_mock_adk_response, clear_mock_adk_responses

@pytest.fixture(autouse=True)
def setup_understand_mock():
    mock_resp = json.dumps({
        "evidence": ["Customer requirement change observed in input."],
        "reasoning": ["Requirement shift affects gating."],
        "recommendation": "Upgrade Outcome to Version 2.",
        "risk_score": "HIGH",
        "affected_dimensions": ["Outcome Goals"],
        "suggested_outcome_statement": "Automate onboarding workflow with SSO",
        "suggested_success_criteria": [{"id": "sc-1", "title": "API complete", "completed": True}]
    })
    set_mock_adk_response("anonymized requirement input", mock_resp)
    yield
    clear_mock_adk_responses()

def test_understand_agent_analyzes_change():
    agent = UnderstandAgent()
    res = agent.analyze_change(
        raw_change_text="Enterprise SSO is mandatory before cutover",
        current_outcome_statement="Automate onboarding workflow",
        current_success_criteria=[{"id": "sc-1", "title": "API complete", "completed": True}]
    )
    
    assert res.change_title is not None
    assert len(res.evidence) > 0
    assert len(res.reasoning) > 0
    assert res.recommendation is not None
    assert res.risk_score in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]

def test_understand_agent_does_not_silently_modify_state():
    agent = UnderstandAgent()
    initial_criteria = [{"id": "sc-1", "title": "API complete", "completed": True}]
    res = agent.analyze_change(
        raw_change_text="New security requirement",
        current_outcome_statement="Automate onboarding",
        current_success_criteria=initial_criteria
    )
    # Output is a recommendation only
    assert res.recommendation is not None
    assert initial_criteria[0]["completed"] is True

def test_understand_agent_offline_raises_error():
    clear_mock_adk_responses()
    agent = UnderstandAgent()
    with pytest.raises(RuntimeError) as exc_info:
        agent.analyze_change(
            raw_change_text="Some requirement change",
            current_outcome_statement="Automate onboarding",
            current_success_criteria=[]
        )
    assert "AI service is currently unavailable" in str(exc_info.value)
