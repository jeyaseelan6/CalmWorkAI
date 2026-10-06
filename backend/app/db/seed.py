from app.db.database import SessionLocal, init_db
from app.models import Engagement, EngagementStatus, Outcome, OutcomeStatus, TimelineEvent
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_demo_data():
    init_db()
    db = SessionLocal()
    
    try:
        # Check if already seeded
        existing = db.query(Engagement).filter(Engagement.id == "eng-acme-001").first()
        if existing:
            logger.info("Demo engagement data already seeded.")
            return

        # 1. Create Engagement
        engagement = Engagement(
            id="eng-acme-001",
            customer_name="Acme Corp",
            name="Onboarding Modernization",
            description="Automating onboarding workflow and integrating API endpoints.",
            status=EngagementStatus.NEEDS_REASSESSMENT,
            progress=70,
            current_outcome_id="out-acme-v1",
            created_by="fde_user_1",
            created_at=datetime.utcnow()
        )
        db.add(engagement)

        # 2. Create Initial Outcome (v1)
        outcome_v1 = Outcome(
            id="out-acme-v1",
            engagement_id="eng-acme-001",
            version=1,
            statement="Reduce manual customer onboarding time from 30 minutes to under 5 minutes.",
            success_criteria=[
                {"id": "sc-1", "title": "Automated onboarding workflow implemented", "completed": True},
                {"id": "sc-2", "title": "API integration complete", "completed": True},
                {"id": "sc-3", "title": "Production validation complete", "completed": False}
            ],
            status=OutcomeStatus.APPROVED,
            created_by="fde_user_1",
            approved_by="manager_user_1",
            created_at=datetime.utcnow(),
            approved_at=datetime.utcnow()
        )
        db.add(outcome_v1)

        # 3. Create Timeline Event
        timeline_1 = TimelineEvent(
            id="evt-001",
            engagement_id="eng-acme-001",
            event_type="OUTCOME_CREATED",
            title="Initial Outcome Established",
            description="Outcome v1 created and approved by manager.",
            actor_type="MANAGER",
            actor_id="manager_user_1",
            created_at=datetime.utcnow()
        )
        timeline_2 = TimelineEvent(
            id="evt-002",
            engagement_id="eng-acme-001",
            event_type="REQUIREMENT_ADDED",
            title="New Customer Requirement",
            description="Customer security team stated: Enterprise SSO is required before production deployment.",
            actor_type="FDE",
            actor_id="fde_user_1",
            created_at=datetime.utcnow()
        )
        db.add(timeline_1)
        db.add(timeline_2)

        db.commit()
        logger.info("Successfully seeded demo engagement scenario data!")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed demo data: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
