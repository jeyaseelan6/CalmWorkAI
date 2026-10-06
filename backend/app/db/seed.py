from app.db.database import SessionLocal, init_db
from app.models import Engagement, EngagementStatus, WorkCycleStep, Outcome, OutcomeStatus, TimelineEvent
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_demo_data():
    init_db()
    db = SessionLocal()
    
    try:
        # Re-create database tables if schema was modified
        init_db()

        # 1. Customer 1: Acme Corp — Onboarding Modernization
        existing_acme = db.query(Engagement).filter(Engagement.id == "eng-acme-001").first()
        if existing_acme:
            db.delete(existing_acme)
            db.commit()

        acme_eng = Engagement(
            id="eng-acme-001",
            customer_name="Acme Corp",
            name="Onboarding Modernization",
            description="Automating onboarding workflow and integrating API endpoints.",
            status=EngagementStatus.NEEDS_REASSESSMENT,
            current_work_cycle=WorkCycleStep.STEP_4_BUILD_WITHIN_CONSTRAINTS,
            progress=70,
            current_outcome_id="out-acme-v1",
            created_by="fde_user_1",
            created_at=datetime.utcnow()
        )
        db.add(acme_eng)

        acme_outcome = Outcome(
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
        db.add(acme_outcome)

        db.add(TimelineEvent(
            id="evt-acme-001",
            engagement_id="eng-acme-001",
            event_type="OUTCOME_CREATED",
            title="Initial Outcome Established",
            description="Outcome v1 created and approved by manager.",
            actor_type="MANAGER",
            actor_id="manager_user_1",
            created_at=datetime.utcnow()
        ))
        db.add(TimelineEvent(
            id="evt-acme-002",
            engagement_id="eng-acme-001",
            event_type="REQUIREMENT_ADDED",
            title="New Customer Requirement",
            description="Customer security team stated: Enterprise SSO is required before production deployment.",
            actor_type="FDE",
            actor_id="fde_user_1",
            created_at=datetime.utcnow()
        ))

        # 2. Customer 2: Globex Corp — Legacy Data Migration
        existing_globex = db.query(Engagement).filter(Engagement.id == "eng-globex-002").first()
        if existing_globex:
            db.delete(existing_globex)
            db.commit()

        globex_eng = Engagement(
            id="eng-globex-002",
            customer_name="Globex Corp",
            name="Legacy Data Migration",
            description="Migrating on-prem DB tables to Cloud SQL with zero downtime.",
            status=EngagementStatus.HEALTHY,
            current_work_cycle=WorkCycleStep.STEP_5_DEPLOY_INTO_PRODUCTION,
            progress=45,
            current_outcome_id="out-globex-v1",
            created_by="fde_user_1",
            created_at=datetime.utcnow()
        )
        db.add(globex_eng)

        globex_outcome = Outcome(
            id="out-globex-v1",
            engagement_id="eng-globex-002",
            version=1,
            statement="Migrate 50M records to Cloud SQL with zero data loss and under 15 min cutover window.",
            success_criteria=[
                {"id": "sc-g1", "title": "Schema mapping & transformation validation", "completed": True},
                {"id": "sc-g2", "title": "CDC replication stream active", "completed": True},
                {"id": "sc-g3", "title": "Cutover dry run & performance benchmark", "completed": False}
            ],
            status=OutcomeStatus.APPROVED,
            created_by="fde_user_1",
            approved_by="manager_user_1",
            created_at=datetime.utcnow(),
            approved_at=datetime.utcnow()
        )
        db.add(globex_outcome)

        db.add(TimelineEvent(
            id="evt-globex-001",
            engagement_id="eng-globex-002",
            event_type="OUTCOME_CREATED",
            title="Migration Outcome Established",
            description="Target cutover window and zero data loss DoD approved.",
            actor_type="MANAGER",
            actor_id="manager_user_1",
            created_at=datetime.utcnow()
        ))

        db.commit()
        logger.info("Successfully seeded multi-customer engagement data with 6 Work Cycles!")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to seed demo data: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
