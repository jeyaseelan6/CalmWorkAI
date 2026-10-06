from typing import Tuple, Dict, Any, Optional
from app.privacy.detector import SensitiveDataDetector
from app.privacy.anonymizer import TextAnonymizer
from app.privacy.reference_manager import ReferenceManager, ReferenceMapping
import logging

logger = logging.getLogger(__name__)


class PrivacyPolicyEngine:
    """
    Pre-boundary enforcement policy engine.
    Ensures raw sensitive data is anonymized prior to entering LLM boundary.
    Logs are scrubbed of raw PII/secrets.
    """
    
    def __init__(self, use_cloud_dlp: bool = False, gcp_project_id: str = None):
        self.detector = SensitiveDataDetector(use_cloud_dlp=use_cloud_dlp, gcp_project_id=gcp_project_id)
        self.anonymizer = TextAnonymizer(detector=self.detector)
        self.reference_manager = ReferenceManager()

    def process_llm_input(self, text: str, session_id: Optional[str] = None) -> Tuple[str, ReferenceMapping]:
        """
        Process user text before LLM boundary transit.
        Returns (anonymized_text, reference_mapping).
        If processing fails, raises a PrivacyViolationError.
        """
        try:
            mapping = self.reference_manager.create_session(session_id=session_id)
            anonymized_text, changed = self.anonymizer.anonymize(text, mapping)
            return anonymized_text, mapping
        except Exception as e:
            logger.error(f"Privacy Policy Enforcement Failed: {str(e)}")
            raise PrivacyViolationError("AI analysis unavailable — CalmWork could not safely prepare context for processing.")

    def sanitize_output(self, llm_output: str, mapping: ReferenceMapping, authorized: bool = True) -> str:
        """
        De-anonymize LLM output only when authorized and required for user display.
        """
        if not authorized:
            return llm_output
        return mapping.restore_text(llm_output)


class PrivacyViolationError(Exception):
    pass
