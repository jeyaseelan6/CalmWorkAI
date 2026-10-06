from typing import Tuple
from app.privacy.detector import SensitiveDataDetector
from app.privacy.reference_manager import ReferenceMapping
import logging

logger = logging.getLogger(__name__)


class TextAnonymizer:
    """
    Anonymizes sensitive entities in text by substituting stable reference tokens.
    """
    
    def __init__(self, detector: SensitiveDataDetector):
        self.detector = detector

    def anonymize(self, text: str, mapping: ReferenceMapping) -> Tuple[str, bool]:
        """
        Anonymize sensitive data in text payload.
        Returns (anonymized_text, whether_entities_were_detected).
        """
        if not text:
            return text, False

        entities = self.detector.detect(text)
        if not entities:
            return text, False

        # Reconstruct text from back to front to preserve string indices
        anonymized_text = text
        for entity in reversed(entities):
            ref_token = mapping.get_or_create_reference(entity.text, entity.entity_type)
            anonymized_text = (
                anonymized_text[:entity.start] + 
                ref_token + 
                anonymized_text[entity.end:]
            )

        return anonymized_text, True
