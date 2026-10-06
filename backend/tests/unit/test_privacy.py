import unittest
from app.privacy.detector import SensitiveDataDetector
from app.privacy.anonymizer import TextAnonymizer
from app.privacy.policy import PrivacyPolicyEngine


class TestPrivacyGuardrail(unittest.TestCase):
    
    def test_sensitive_data_detection(self):
        detector = SensitiveDataDetector()
        text = "Contact Alice at alice@example.com or call +1-555-0199 for Account CUST-9921. Secret key: sk-proj-1234567890abcdef12345678"
        entities = detector.detect(text)
        
        types = [e.entity_type for e in entities]
        self.assertIn("EMAIL_ADDRESS", types)
        self.assertIn("PHONE_NUMBER", types)
        self.assertIn("CUSTOMER_ID", types)
        self.assertIn("CREDENTIAL", types)

    def test_anonymization_and_stable_reference_reuse(self):
        policy = PrivacyPolicyEngine()
        text = "Send update to alice@example.com. Verification code sent to alice@example.com."
        
        anonymized, mapping = policy.process_llm_input(text)
        
        self.assertNotIn("alice@example.com", anonymized)
        self.assertIn("[EMAIL_ADDRESS_001]", anonymized)
        # Ensure stable token reuse for multiple occurrences
        self.assertEqual(anonymized.count("[EMAIL_ADDRESS_001]"), 2)
        
        # De-anonymize test
        restored = policy.sanitize_output(anonymized, mapping, authorized=True)
        self.assertEqual(restored, text)

    def test_unauthorized_de_anonymization(self):
        policy = PrivacyPolicyEngine()
        text = "Customer email is john@example.com"
        
        anonymized, mapping = policy.process_llm_input(text)
        
        # Unauthorized output remains pseudonymized
        output = policy.sanitize_output(anonymized, mapping, authorized=False)
        self.assertNotIn("john@example.com", output)
        self.assertIn("[EMAIL_ADDRESS_001]", output)


if __name__ == "__main__":
    unittest.main()
