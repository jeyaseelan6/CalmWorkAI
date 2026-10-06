from sqlalchemy import Column, String, DateTime, Enum, Text, ForeignKey, Integer
from datetime import datetime
from app.models.engagement import Base
import enum


class DocumentCategory(str, enum.Enum):
    CUSTOMER_REQUIREMENTS = "Customer Requirements"
    ARCHITECTURE = "Architecture"
    TECHNICAL_DOCUMENTATION = "Technical Documentation"
    DECISIONS = "Decisions"
    CUSTOMER_NOTES = "Customer Notes"
    OTHER = "Other"


class DocumentStatus(str, enum.Enum):
    UPLOADING = "Uploading"
    PROCESSING = "Processing"
    INDEXED = "Indexed"
    FAILED = "Failed"


class DocumentModel(Base):
    __tablename__ = "documents"

    id = Column(String(50), primary_key=True)
    engagement_id = Column(String(50), ForeignKey("engagements.id"), nullable=False)
    title = Column(String(255), nullable=False)
    category = Column(Enum(DocumentCategory), default=DocumentCategory.OTHER, nullable=False)
    status = Column(Enum(DocumentStatus), default=DocumentStatus.INDEXED, nullable=False)
    content = Column(Text, nullable=True)
    chunks_count = Column(Integer, default=0, nullable=False)
    uploaded_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
