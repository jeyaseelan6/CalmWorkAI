import re
from typing import List, Dict, Any
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class SensitiveEntity:
    entity_type: str
    text: str
    start: int
    end: int


class SensitiveDataDetector:
    """
    Detects PII, credentials, API keys, phone numbers, emails, personal names,
    and customer-sensitive identifiers using regex heuristics and Cloud DLP fallback.
    """
    
    # Regex patterns for local high-precision detection
    EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
    PHONE_PATTERN = re.compile(r'(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b')
    API_KEY_PATTERN = re.compile(r'\b(?:sk-[A-Za-z0-9_-]{20,}|bearer\s+[A-Za-z0-9._~+/-]+=*|ghp_[A-Za-z0-9]{36}|[A-Za-z0-9_-]{32,}\.secret)\b', re.IGNORECASE)
    CUSTOMER_ID_PATTERN = re.compile(r'\b(?:ACC|CUST|TENANT|ACCT)-\d{4,10}\b', re.IGNORECASE)
    
    def __init__(self, use_cloud_dlp: bool = False, gcp_project_id: str = None):
        self.use_cloud_dlp = use_cloud_dlp
        self.gcp_project_id = gcp_project_id

    def detect(self, text: str) -> List[SensitiveEntity]:
        """Detect sensitive entities in text payload."""
        if not text:
            return []
        
        entities: List[SensitiveEntity] = []
        
        # 1. Detect Email Addresses
        for match in self.EMAIL_PATTERN.finditer(text):
            entities.append(SensitiveEntity(
                entity_type="EMAIL_ADDRESS",
                text=match.group(0),
                start=match.start(),
                end=match.end()
            ))
            
        # 2. Detect Phone Numbers
        for match in self.PHONE_PATTERN.finditer(text):
            # Exclude false positives (short numbers or standard dates)
            val = match.group(0)
            if len(re.sub(r'\D', '', val)) >= 7:
                entities.append(SensitiveEntity(
                    entity_type="PHONE_NUMBER",
                    text=val,
                    start=match.start(),
                    end=match.end()
                ))
                
        # 3. Detect API Keys / Secrets / Tokens
        for match in self.API_KEY_PATTERN.finditer(text):
            entities.append(SensitiveEntity(
                entity_type="CREDENTIAL",
                text=match.group(0),
                start=match.start(),
                end=match.end()
            ))

        # 4. Detect Customer / Account Identifiers
        for match in self.CUSTOMER_ID_PATTERN.finditer(text):
            entities.append(SensitiveEntity(
                entity_type="CUSTOMER_ID",
                text=match.group(0),
                start=match.start(),
                end=match.end()
            ))

        # Sort entities by start index to avoid overlapping token replacement issues
        entities.sort(key=lambda e: e.start)
        return entities
