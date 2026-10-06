from sqlalchemy import Column, String, Integer, DateTime, Enum, Text, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime
import enum

Base = declarative_base()


class EngagementStatus(str, enum.Enum):
    HEALTHY = "HEALTHY"
    NEEDS_REASSESSMENT = "NEEDS_REASSESSMENT"
    BLOCKED = "BLOCKED"
    AT_RISK = "AT_RISK"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"


class Engagement(Base):
    __tablename__ = "engagements"

    id = Column(String(50), primary_key=True)
    customer_name = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(EngagementStatus), default=EngagementStatus.HEALTHY, nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    current_outcome_id = Column(String(50), nullable=True)
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
