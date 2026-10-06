import pytest
from app.privacy import PrivacyPolicyEngine

def test_privacy_guardrail_anonymization():
    engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    raw_text = "Acme Corp contact John Smith john@acme.com +15550199 secret bearer sk-12345678901234567890123"
    anon_text, mapping = engine.process_llm_input(raw_text, session_id="test-session")
    
    assert "john@acme.com" not in anon_text
    assert "+15550199" not in anon_text
    assert "sk-12345678901234567890123" not in anon_text
    assert len(mapping.reference_to_original) > 0

def test_privacy_guardrail_restoration():
    engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    raw_text = "Acme Corp requirement update for john@acme.com."
    anon_text, mapping = engine.process_llm_input(raw_text, session_id="test-session")
    restored = engine.sanitize_output(anon_text, mapping)
    
    assert "john@acme.com" in restored

def test_privacy_error_handling_fallback():
    engine = PrivacyPolicyEngine(use_cloud_dlp=False)
    anon_text, mapping = engine.process_llm_input("Test input payload", session_id="test-session")
    assert isinstance(mapping.reference_to_original, dict)
