"""
CalmWork AI — Database Migration Utility (Local SQLite -> Neon Cloud PostgreSQL)

Usage:
    python scripts/migrate_to_neon.py --neon-url "postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"

Or set NEON_DATABASE_URL or DATABASE_URL in .env before running:
    python scripts/migrate_to_neon.py
"""

import sys
import os
import argparse
import logging
from dotenv import load_dotenv

# Ensure backend root is in sys.path and load .env
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)
load_dotenv(os.path.join(backend_dir, ".env"))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import (
    Base,
    Engagement,
    Outcome,
    TimelineEvent,
    Approval,
    DocumentModel
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("neon-migration")


def migrate(local_url: str, neon_url: str):
    logger.info("==================================================")
    logger.info("CalmWork AI — Local to Neon PostgreSQL Migration")
    logger.info("==================================================")

    # 1. Normalize protocol to use installed psycopg2 driver
    if neon_url.startswith("postgres://"):
        neon_url = neon_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif neon_url.startswith("postgresql://") and not neon_url.startswith("postgresql+"):
        neon_url = neon_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    logger.info(f"Source DB:      {local_url}")
    # Mask password for secure logging
    safe_target = neon_url.split("@")[-1] if "@" in neon_url else neon_url
    logger.info(f"Destination DB: ...@{safe_target}")

    # 2. Setup engines & sessions
    src_engine = create_engine(local_url, connect_args={"check_same_thread": False} if "sqlite" in local_url else {})
    dest_engine = create_engine(neon_url, pool_pre_ping=True)

    SrcSession = sessionmaker(bind=src_engine)
    DestSession = sessionmaker(bind=dest_engine)

    src_db = SrcSession()
    dest_db = DestSession()

    try:
        # 3. Create tables on Neon
        logger.info("1/4: Initializing table schemas on Neon PostgreSQL...")
        Base.metadata.create_all(bind=dest_engine)
        logger.info("Table schemas created successfully on Neon.")

        # 4. Migrate Engagements
        logger.info("2/4: Migrating Engagements & Outcomes...")
        engagements = src_db.query(Engagement).all()
        for eng in engagements:
            existing = dest_db.query(Engagement).filter_by(id=eng.id).first()
            if not existing:
                dest_db.add(Engagement(
                    id=eng.id,
                    customer_name=eng.customer_name,
                    name=eng.name,
                    description=eng.description,
                    status=eng.status,
                    current_work_cycle=eng.current_work_cycle,
                    progress=eng.progress,
                    current_outcome_id=eng.current_outcome_id,
                    created_by=eng.created_by,
                    created_at=eng.created_at
                ))
        dest_db.commit()
        logger.info(f"  -> Migrated {len(engagements)} engagements.")

        outcomes = src_db.query(Outcome).all()
        for out in outcomes:
            existing = dest_db.query(Outcome).filter_by(id=out.id).first()
            if not existing:
                dest_db.add(Outcome(
                    id=out.id,
                    engagement_id=out.engagement_id,
                    version=out.version,
                    statement=out.statement,
                    success_criteria=out.success_criteria,
                    status=out.status,
                    work_plan=out.work_plan,
                    created_by=out.created_by,
                    approved_by=out.approved_by,
                    created_at=out.created_at,
                    approved_at=out.approved_at
                ))
        dest_db.commit()
        logger.info(f"  -> Migrated {len(outcomes)} outcomes.")

        # 5. Migrate Timeline & Approvals
        logger.info("3/4: Migrating Timeline Events & Approvals...")
        events = src_db.query(TimelineEvent).all()
        for ev in events:
            existing = dest_db.query(TimelineEvent).filter_by(id=ev.id).first()
            if not existing:
                dest_db.add(TimelineEvent(
                    id=ev.id,
                    engagement_id=ev.engagement_id,
                    event_type=ev.event_type,
                    title=ev.title,
                    description=ev.description,
                    actor_type=ev.actor_type,
                    actor_id=ev.actor_id,
                    metadata_json=ev.metadata_json,
                    created_at=ev.created_at
                ))
        dest_db.commit()
        logger.info(f"  -> Migrated {len(events)} timeline events.")

        approvals = src_db.query(Approval).all()
        for app in approvals:
            existing = dest_db.query(Approval).filter_by(id=app.id).first()
            if not existing:
                dest_db.add(Approval(
                    id=app.id,
                    engagement_id=app.engagement_id,
                    type=app.type,
                    target_id=app.target_id,
                    status=app.status,
                    requested_by=app.requested_by,
                    reviewed_by=app.reviewed_by,
                    decision_note=app.decision_note,
                    reviewed_at=app.reviewed_at,
                    created_at=app.created_at
                ))
        dest_db.commit()
        logger.info(f"  -> Migrated {len(approvals)} approval requests.")

        # 6. Migrate Documents
        logger.info("4/4: Migrating Indexed Documents...")
        docs = src_db.query(DocumentModel).all()
        for doc in docs:
            existing = dest_db.query(DocumentModel).filter_by(id=doc.id).first()
            if not existing:
                dest_db.add(DocumentModel(
                    id=doc.id,
                    engagement_id=doc.engagement_id,
                    title=doc.title,
                    category=doc.category,
                    status=doc.status,
                    content=doc.content,
                    chunks_count=doc.chunks_count,
                    uploaded_by=doc.uploaded_by,
                    created_at=doc.created_at,
                    updated_at=doc.updated_at
                ))
        dest_db.commit()
        logger.info(f"  -> Migrated {len(docs)} documents.")

        logger.info("==================================================")
        logger.info("MIGRATION COMPLETED SUCCESSFULLY!")
        logger.info("Neon PostgreSQL is now populated and ready.")
        logger.info("Update DATABASE_URL in backend/.env to your Neon URL.")
        logger.info("==================================================")

    except Exception as e:
        dest_db.rollback()
        logger.error(f"Migration failed: {e}")
        raise e
    finally:
        src_db.close()
        dest_db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate CalmWork AI local database to Neon PostgreSQL")
    parser.add_argument("--local-url", default="sqlite:///./calmwork.db", help="Local database URL (default: sqlite:///./calmwork.db)")
    parser.add_argument("--neon-url", default=None, help="Target Neon PostgreSQL URL")
    args = parser.parse_args()

    target_url = args.neon_url or os.getenv("NEON_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not target_url or "sqlite" in target_url:
        print("\n[ERROR] Missing Neon database connection string.")
        print("Please supply --neon-url or set NEON_DATABASE_URL in backend/.env")
        print('Example: python scripts/migrate_to_neon.py --neon-url "postgresql://user:pass@ep-xyz.us-east-2.aws.neon.tech/neondb?sslmode=require"\n')
        sys.exit(1)

    migrate(args.local_url, target_url)
