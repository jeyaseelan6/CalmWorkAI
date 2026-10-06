"""
Outcome Versioning & State Service.
Handles transactional outcome version upgrades, preserving historical DoD definitions.
"""

from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import uuid
import logging

from app.models import Engagement, Outcome, OutcomeStatus, TimelineEvent, Approval

logger = logging.getLogger(__name__)


class OutcomeService:
    def __init__(self, db: Session):
        self.db = db

    def get_outcome_history(self, engagement_id: str) -> List[Outcome]:
        """Fetch full immutable outcome version history for an engagement."""
        return (
            self.db.query(Outcome)
            .filter(Outcome.engagement_id == engagement_id)
            .order_by(Outcome.version.asc())
            .all()
        )

    def propose_new_outcome_version(
        self,
        engagement_id: str,
        new_statement: str,
        new_success_criteria: List[Dict[str, Any]],
        proposed_by: str,
        reason: str
    ) -> Outcome:
        """
        Creates a new PENDING outcome version without modifying existing versions.
        """
        engagement = self.db.query(Engagement).filter(Engagement.id == engagement_id).first()
        if not engagement:
            raise ValueError(f"Engagement {engagement_id} not found")

        # Determine current highest version
        current_highest = (
            self.db.query(Outcome)
            .filter(Outcome.engagement_id == engagement_id)
            .order_by(Outcome.version.desc())
            .first()
        )

        next_version = (current_highest.version + 1) if current_highest else 1
        new_outcome_id = f"out-{engagement_id[:8]}-v{next_version}-{uuid.uuid4().hex[:4]}"

        new_outcome = Outcome(
            id=new_outcome_id,
            engagement_id=engagement_id,
            version=next_version,
            statement=new_statement,
            success_criteria=new_success_criteria,
            status=OutcomeStatus.PENDING_APPROVAL,
            created_by=proposed_by,
            created_at=datetime.now(timezone.utc)
        )
        self.db.add(new_outcome)

        # Record timeline event
        timeline_event = TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="OUTCOME_PROPOSED",
            title=f"Outcome Version {next_version} Proposed",
            description=f"Reason: {reason}",
            actor_type="AGENT",
            actor_id=proposed_by,
            created_at=datetime.now(timezone.utc)
        )
        self.db.add(timeline_event)

        self.db.commit()
        self.db.refresh(new_outcome)
        logger.info(f"Proposed Outcome v{next_version} ({new_outcome_id}) for engagement {engagement_id}")
        return new_outcome

    def approve_outcome_version(
        self,
        engagement_id: str,
        outcome_id: str,
        approved_by: str
    ) -> Engagement:
        """
        Approves a pending outcome version, sets it as active current outcome for engagement,
        and marks old active outcomes as SUPERSEDED.
        """
        engagement = self.db.query(Engagement).filter(Engagement.id == engagement_id).first()
        if not engagement:
            raise ValueError(f"Engagement {engagement_id} not found")

        target_outcome = self.db.query(Outcome).filter(Outcome.id == outcome_id).first()
        if not target_outcome or target_outcome.engagement_id != engagement_id:
            raise ValueError(f"Outcome {outcome_id} not found for engagement {engagement_id}")

        # Supersede old active outcomes
        old_outcomes = (
            self.db.query(Outcome)
            .filter(Outcome.engagement_id == engagement_id, Outcome.status == OutcomeStatus.APPROVED)
            .all()
        )
        for old in old_outcomes:
            old.status = OutcomeStatus.SUPERSEDED

        # Approve target outcome
        target_outcome.status = OutcomeStatus.APPROVED
        target_outcome.approved_by = approved_by
        target_outcome.approved_at = datetime.now(timezone.utc)

        # Update current active outcome on engagement
        engagement.current_outcome_id = target_outcome.id
        engagement.status = "HEALTHY"  # Reset status to healthy post-approval
        engagement.updated_at = datetime.now(timezone.utc)

        # Add timeline event
        timeline_event = TimelineEvent(
            id=f"evt-{uuid.uuid4().hex[:8]}",
            engagement_id=engagement_id,
            event_type="OUTCOME_APPROVED",
            title=f"Outcome Version {target_outcome.version} Approved",
            description=f"Approved by {approved_by}. Active outcome statement updated.",
            actor_type="MANAGER",
            actor_id=approved_by,
            created_at=datetime.now(timezone.utc)
        )
        self.db.add(timeline_event)

        self.db.commit()
        self.db.refresh(engagement)
        logger.info(f"Approved Outcome v{target_outcome.version} for engagement {engagement_id}")
        return engagement
