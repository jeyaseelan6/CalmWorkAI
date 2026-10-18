"""
Morning Brief Agentic Skill — Unified Execution Engine.
Orchestrates PLAN -> KNOW -> MOVE -> SUPERVISOR consolidation across single
and batch multi-engagement workloads with Cloud SQL persistence.
"""

from typing import Dict, Any, List, Optional, Callable
import uuid
import logging
from datetime import datetime
from sqlalchemy.orm import Session

from app.skills.morning_brief.manifest import morning_brief_manifest, SkillManifest
from app.skills.morning_brief.procedure import MORNING_BRIEF_PROCEDURAL_GUIDE
from app.models import Engagement, Outcome, Approval, TimelineEvent
from app.supervisor.coordinator import DailyWorkBrief
from app.api.deps import supervisor_coordinator

logger = logging.getLogger(__name__)


class MorningBriefSkill:
    """
    Morning Brief Agentic Skill:
    Encapsulates procedural knowledge, step-by-step instructions, and multi-agent coordination
    into a reusable, callable agentic skill that runs on-demand or on a daily 8:00 AM IST schedule.
    """

    def __init__(self):
        self.manifest: SkillManifest = morning_brief_manifest
        self.procedure: str = MORNING_BRIEF_PROCEDURAL_GUIDE

    def execute(
        self,
        engagement_id: str,
        db: Session,
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> DailyWorkBrief:
        """
        Executes the Morning Brief procedural multi-agent workflow for a single customer engagement.
        Coordinates PLAN (scope drift) -> KNOW (grounded RAG) -> MOVE (next action) -> SUPERVISOR.
        """
        eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
        if not eng:
            raise ValueError(f"Engagement '{engagement_id}' not found.")

        current_outcome = db.query(Outcome).filter(Outcome.id == eng.current_outcome_id).first()
        statement = current_outcome.statement if current_outcome else ""
        version = current_outcome.version if current_outcome else 1
        criteria = current_outcome.success_criteria if current_outcome else []
        approvals = db.query(Approval).filter(
            Approval.engagement_id == engagement_id,
            Approval.status == "PENDING"
        ).all()
        timeline = db.query(TimelineEvent).filter(
            TimelineEvent.engagement_id == engagement_id
        ).order_by(TimelineEvent.created_at.desc()).all()

        brief = supervisor_coordinator.generate_daily_work_brief(
            engagement_id=engagement_id,
            customer_name=eng.customer_name,
            status=eng.status,
            outcome_statement=statement,
            version=version,
            pending_approvals=len(approvals),
            current_work_cycle=eng.current_work_cycle.value if hasattr(eng.current_work_cycle, "value") else str(eng.current_work_cycle),
            timeline_events=timeline,
            success_criteria=criteria,
            approved_work_plan=current_outcome.work_plan if current_outcome else None,
            progress_callback=progress_callback
        )

        return brief

    def execute_and_persist(
        self,
        engagement_id: str,
        db: Session,
        trigger_source: str = "ON_DEMAND",
        progress_callback: Optional[Callable[[Dict[str, Any]], None]] = None
    ) -> DailyWorkBrief:
        """
        Executes the Morning Brief skill and persists the full briefing artifact
        into the shared memory timeline with complete metadata.
        """
        brief = self.execute(
            engagement_id=engagement_id,
            db=db,
            progress_callback=progress_callback
        )

        evt_id = f"evt-brief-{uuid.uuid4().hex[:8]}"
        evt = TimelineEvent(
            id=evt_id,
            engagement_id=engagement_id,
            event_type="MORNING_BRIEF_GENERATED",
            title=f"Morning Brief Generated ({trigger_source})",
            description=(
                f"Morning Brief Skill executed ({trigger_source}). "
                f"Outcome Health: {brief.outcome_health}. "
                f"Next Action: {brief.proposed_work_plan.recommended_first_action}."
            ),
            actor_type="SKILL",
            actor_id="skill_morning_brief",
            metadata_json=brief.model_dump(),
            created_at=datetime.utcnow()
        )
        db.add(evt)
        db.commit()
        logger.info(
            f"Morning Brief Skill persisted for {engagement_id} "
            f"(trigger={trigger_source}, evt_id={evt_id})"
        )

        return brief

    def get_latest_brief(self, engagement_id: str, db: Session) -> Optional[Dict[str, Any]]:
        """
        Retrieves the most recent persisted Morning Brief for an engagement.
        Enables zero-latency rendering on morning page loads.
        """
        latest_event = (
            db.query(TimelineEvent)
            .filter(
                TimelineEvent.engagement_id == engagement_id,
                TimelineEvent.event_type == "MORNING_BRIEF_GENERATED"
            )
            .order_by(TimelineEvent.created_at.desc())
            .first()
        )

        if latest_event and latest_event.metadata_json:
            data = dict(latest_event.metadata_json)
            data["persisted_at"] = latest_event.created_at.isoformat()
            data["event_id"] = latest_event.id
            return data

        return None

    def execute_batch(
        self,
        db: Session,
        trigger_source: str = "SCHEDULED_8AM_IST"
    ) -> List[Dict[str, Any]]:
        """
        Batch execution across all active customer engagements (used for 8:00 AM IST auto-run).
        """
        logger.info(f"Starting Morning Brief Skill batch execution ({trigger_source})...")
        engagements = db.query(Engagement).all()
        results = []

        for eng in engagements:
            try:
                brief = self.execute_and_persist(
                    engagement_id=eng.id,
                    db=db,
                    trigger_source=trigger_source
                )
                results.append({
                    "engagement_id": eng.id,
                    "customer_name": eng.customer_name,
                    "status": "SUCCESS",
                    "brief_id": brief.brief_id,
                    "outcome_health": brief.outcome_health
                })
            except Exception as e:
                logger.error(f"Failed to generate morning brief for {eng.id}: {e}")
                results.append({
                    "engagement_id": eng.id,
                    "customer_name": eng.customer_name,
                    "status": "FAILED",
                    "error": str(e)
                })

        logger.info(f"Morning Brief Skill batch completed. Processed {len(results)} engagements.")
        return results


morning_brief_skill = MorningBriefSkill()
