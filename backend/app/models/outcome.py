from sqlalchemy import Column, String, Integer, DateTime, Enum, Text, ForeignKey, JSON
from datetime import datetime
from app.models.engagement import Base
import enum


class OutcomeStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    RECOMMENDED = "RECOMMENDED"
    PENDING_APPROVAL = "PENDING_APPROVAL"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUPERSEDED = "SUPERSEDED"


class Outcome(Base):
    __tablename__ = "outcomes"

    id = Column(String(50), primary_key=True)
    engagement_id = Column(String(50), ForeignKey("engagements.id"), nullable=False)
    version = Column(Integer, default=1, nullable=False)
    statement = Column(Text, nullable=False)
    success_criteria = Column(JSON, nullable=False)  # List of DoD criteria objects [{title: str, completed: bool}]
    status = Column(Enum(OutcomeStatus), default=OutcomeStatus.APPROVED, nullable=False)
    created_by = Column(String(100), nullable=False)
    approved_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    approved_at = Column(DateTime, nullable=True)
