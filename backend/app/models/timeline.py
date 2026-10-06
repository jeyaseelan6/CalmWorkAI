from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from datetime import datetime
from app.models.engagement import Base


class TimelineEvent(Base):
    __tablename__ = "timeline_events"

    id = Column(String(50), primary_key=True)
    engagement_id = Column(String(50), ForeignKey("engagements.id"), nullable=False)
    event_type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    actor_type = Column(String(50), nullable=False)  # FDE, MANAGER, AI_SYSTEM
    actor_id = Column(String(100), nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
