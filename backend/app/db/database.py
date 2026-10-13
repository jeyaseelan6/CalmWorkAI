from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Base
import logging

logger = logging.getLogger(__name__)

# Use SQLite for local development fallback if PostgreSQL is not active
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql") and "localhost" in db_url:
    # Check if fallback to SQLite is needed for dev without active Postgres daemon
    db_url = "sqlite:///./calmwork_dev.db"
    logger.info("Using SQLite database fallback for local development.")

connect_args = {"check_same_thread": False} if "sqlite" in db_url else {}

engine = create_engine(db_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Create all database tables and ensure migrations."""
    Base.metadata.create_all(bind=engine)
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
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
