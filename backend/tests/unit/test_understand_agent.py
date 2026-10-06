import pytest
from app.agents.understand_agent import UnderstandAgent

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
