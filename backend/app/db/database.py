from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Base
import logging

logger = logging.getLogger(__name__)

# Normalize URL for SQLAlchemy 2.0 and cloud PostgreSQL (Neon) compatibility
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

if db_url.startswith("postgresql") and "localhost" in db_url:
    # Check if fallback to SQLite is needed for dev without active Postgres daemon
    db_url = "sqlite:///./calmwork_dev.db"
    logger.info("Using SQLite database fallback for local development.")

connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}

engine_kwargs = {"connect_args": connect_args}
if "sqlite" not in db_url:
    # Neon Serverless PostgreSQL connection pooling & auto-reconnect
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300

engine = create_engine(db_url, **engine_kwargs)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all database tables and ensure migrations."""
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        try:
            # Add TASK_CREATION to approvaltype enum if on PostgreSQL (requires AUTOCOMMIT)
            auto_conn = engine.connect().execution_options(isolation_level="AUTOCOMMIT")
            auto_conn.execute(text("ALTER TYPE approvaltype ADD VALUE IF NOT EXISTS 'TASK_CREATION'"))
            auto_conn.close()
        except Exception as e:
            logger.debug(f"Enum migration skipped or already applied: {e}")

        with engine.connect() as conn:
            try:
                # Postgres-safe alter column
                conn.execute(text("ALTER TABLE outcomes ADD COLUMN IF NOT EXISTS work_plan JSONB"))
                conn.commit()
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE outcomes ADD COLUMN work_plan JSON"))
                    conn.commit()
                except Exception:
                    pass  # column already exists

            try:
                conn.execute(text("ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url VARCHAR(500)"))
                conn.commit()
            except Exception:
                pass

            try:
                conn.execute(text("ALTER TABLE workspace_chat_messages ADD COLUMN IF NOT EXISTS customer_update JSONB"))
                conn.commit()
            except Exception:
                try:
                    conn.execute(text("ALTER TABLE workspace_chat_messages ADD COLUMN customer_update JSON"))
                    conn.commit()
                except Exception:
                    pass

            # Add foreign key and status query indexes idempotently
            indexes_to_create = [
                ("ix_outcomes_engagement_id", "outcomes", "engagement_id"),
                ("ix_approvals_engagement_id", "approvals", "engagement_id"),
                ("ix_approvals_status", "approvals", "status"),
                ("ix_timeline_events_engagement_id", "timeline_events", "engagement_id"),
                ("ix_timeline_events_created_at", "timeline_events", "created_at"),
                ("ix_timeline_events_event_type", "timeline_events", "event_type"),
                ("ix_documents_engagement_id", "documents", "engagement_id"),
                ("ix_documents_status", "documents", "status"),
                ("ix_engagements_status", "engagements", "status"),
                ("ix_engagements_customer_name", "engagements", "customer_name"),
            ]
            for idx_name, tbl_name, col_name in indexes_to_create:
                try:
                    conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON {tbl_name} ({col_name})"))
                    conn.commit()
                except Exception as ie:
                    logger.debug(f"Index creation note ({idx_name}): {ie}")

            # Seed demo users only if explicitly enabled
            if getattr(settings, "SEED_DEFAULT_DATA", False):
                try:
                    from app.models.user import UserModel
                    from app.auth.security import DEMO_USERS
                    session = SessionLocal()
                    for email, udata in DEMO_USERS.items():
                        existing = session.query(UserModel).filter(UserModel.email == email).first()
                        if not existing:
                            new_user = UserModel(
                                id=udata["id"],
                                email=udata["email"],
                                password_hash=udata["password_hash"],
                                name=udata["name"],
                                role=udata["role"],
                                title=udata.get("title", "")
                            )
                            session.add(new_user)
                    session.commit()
                    session.close()
                except Exception as ue:
                    logger.debug(f"User seeding note: {ue}")
    except Exception as e:
        logger.debug(f"Migration check completed: {e}")


def get_db():
    """Dependency for providing database sessions per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
