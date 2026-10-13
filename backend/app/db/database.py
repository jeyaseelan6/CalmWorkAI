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
    except Exception as e:
        logger.debug(f"Migration check completed: {e}")


def get_db():
    """Dependency for providing database sessions per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
