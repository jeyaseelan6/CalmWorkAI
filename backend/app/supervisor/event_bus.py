"""
Event Bus for Supervisor Orchestration.
Centralized event routing mechanism for engagement state changes.
"""

from typing import List, Dict, Any, Callable, Optional
from pydantic import BaseModel
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class EngagementEvent(BaseModel):
    event_id: str
    engagement_id: str
    event_type: str  # "REQUIREMENT_CHANGED" | "BLOCKER_ADDED font" | "DOD_COMPLETED" | "QUERY_SUBMITTED"
    payload: Dict[str, Any]
    actor_id: str
    timestamp: str


class EventBus:
    """
    Event Bus logging and dispatching engagement events to subscribers.
    """

    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[EngagementEvent], None]]] = {}

    def subscribe(self, event_type: str, callback: Callable[[EngagementEvent], None]) -> None:
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(callback)

    def publish(self, event: EngagementEvent) -> int:
        callbacks = self._subscribers.get(event.event_type, [])
        logger.info(f"EventBus publishing '{event.event_type}' for engagement {event.engagement_id} to {len(callbacks)} listeners.")
        for cb in callbacks:
            try:
                cb(event)
            except Exception as e:
                logger.error(f"Error in EventBus listener for {event.event_type}: {str(e)}")
        return len(callbacks)
