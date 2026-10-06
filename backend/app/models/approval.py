from sqlalchemy import Column, String, DateTime, Enum, Text, ForeignKey
from datetime import datetime
from app.models.engagement import Base
import enum


class ApprovalType(str, enum.Enum):
    OUTCOME_CHANGE = "OUTCOME_CHANGE"
    DOD_CHANGE = "DOD_CHANGE"
    CONSEQUENTIAL_ACTION = "CONSEQUENTIAL_ACTION"
    CUSTOMER_UPDATE = "CUSTOMER_UPDATE"


class ApprovalStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class Approval(Base):
    __tablename__ = "approvals"

    id = Column(String(50), primary_key=True)
    engagement_id = Column(String(50), ForeignKey("engagements.id"), nullable=False)
    type = Column(Enum(ApprovalType), nullable=False)
    target_id = Column(String(50), nullable=True)
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING, nullable=False)
    requested_by = Column(String(100), nullable=False)
    reviewed_by = Column(String(100), nullable=True)
    decision_note = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
