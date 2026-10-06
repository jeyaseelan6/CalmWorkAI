import pytest
from app.agents.know_agent import KnowAgent

def test_know_agent_insufficient_evidence():
    agent = KnowAgent()
    res = agent.answer_question(
        engagement_id="eng-nonexistent",
        raw_question="What is the secret key for unknown system?"
    )
    assert res.evidence_sufficient is False
    assert "don't have enough verified engagement evidence" in res.answer

def test_know_agent_grounded_answer():
    agent = KnowAgent()
    agent.ingest_document(
        engagement_id="eng-test-01",
        title="Architecture Guide",
        raw_text="Cloud SQL database cutover window is 15 minutes."
    )
    res = agent.answer_question(
        engagement_id="eng-test-01",
        raw_question="What is the cutover window?"
    )
    assert res.evidence_sufficient is True
    assert len(res.citations) > 0
    assert res.citations[0].document_title == "Architecture Guide"
