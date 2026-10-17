from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.engagement import Base


class WorkspaceChatMessage(Base):
    """
    Persisted natural-language conversation message for 'Ask CalmWork AI'.
    Guarantees cross-session and cross-workspace history isolation.
    """
    __tablename__ = "workspace_chat_messages"

    id = Column(String(50), primary_key=True)
    engagement_id = Column(String(50), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String(20), nullable=False)  # 'USER' | 'SUPERVISOR'
    text = Column(Text, nullable=False)
    intent = Column(String(50), nullable=True)  # 'PLAN' | 'MOVE' | 'KNOW' | 'DELIVER' | 'SUPPORT' | 'MULTI_AGENT'
    delegated_agent = Column(JSON, nullable=True)  # { id, name, role, badge_label, color }
    capabilities_used = Column(JSON, nullable=True)  # ["PLAN", "KNOW", ...]
    sources = Column(JSON, nullable=True)  # [{ title, snippet, source_type }]
    suggested_followups = Column(JSON, nullable=True)  # ["What changed today?", ...]
    screenshot_preview = Column(Text, nullable=True)  # Optional data URL or storage ref
    support_result = Column(JSON, nullable=True)  # Structured diagnostic payload
    customer_update = Column(JSON, nullable=True)  # Structured executive customer update payload
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
