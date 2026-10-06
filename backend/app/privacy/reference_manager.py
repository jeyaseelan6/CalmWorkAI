from typing import Dict, Optional
import uuid
import logging

logger = logging.getLogger(__name__)


class ReferenceMapping:
    def __init__(self, session_id: Optional[str] = None):
        self.session_id = session_id or str(uuid.uuid4())
        self.reference_to_original: Dict[str, str] = {}
        self.original_to_reference: Dict[str, str] = {}
        self.type_counters: Dict[str, int] = {}

    def get_or_create_reference(self, original_text: str, entity_type: str) -> str:
        """Get existing reference or create a new stable reference token."""
        if original_text in self.original_to_reference:
            return self.original_to_reference[original_text]

        counter = self.type_counters.get(entity_type, 0) + 1
        self.type_counters[entity_type] = counter

        reference_token = f"[{entity_type}_{counter:03d}]"
        
        self.reference_to_original[reference_token] = original_text
        self.original_to_reference[original_text] = reference_token
        
        return reference_token

    def restore_text(self, anonymized_text: str) -> str:
        """De-anonymize text in application layer by restoring original values."""
        restored = anonymized_text
        for ref_token, orig_text in self.reference_to_original.items():
            restored = restored.replace(ref_token, orig_text)
        return restored


class ReferenceManager:
    """Manages ephemeral, context-isolated reference mappings."""
    
    def __init__(self):
        self._mappings: Dict[str, ReferenceMapping] = {}

    def create_session(self, session_id: Optional[str] = None) -> ReferenceMapping:
        sid = session_id or str(uuid.uuid4())
        mapping = ReferenceMapping(session_id=sid)
        self._mappings[sid] = mapping
        return mapping

    def get_session(self, session_id: str) -> Optional[ReferenceMapping]:
        return self._mappings.get(session_id)

    def close_session(self, session_id: str) -> None:
        if session_id in self._mappings:
            del self._mappings[session_id]
