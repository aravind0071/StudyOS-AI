import os
import logging
from pathlib import Path
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings, BACKEND_DIR

logger = logging.getLogger(__name__)


def normalize_database_url(raw_url: str) -> str:
    """
    Safely normalize database connection URLs for SQLAlchemy.
    - Converts 'postgres://' to 'postgresql+psycopg2://'
    - Converts 'postgresql://' to 'postgresql+psycopg2://'
    - Resolves relative SQLite paths
    - Redirects SQLite to /tmp on serverless (e.g. Vercel) to avoid read-only filesystem crash
    """
    if not raw_url or not raw_url.strip():
        raw_url = f"sqlite:///{(BACKEND_DIR / 'studyos.db').as_posix()}"

    url = raw_url.strip()

    # Handle standard cloud PostgreSQL URL schemes
    if url.startswith("postgres://"):
        url = "postgresql+psycopg2://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = "postgresql+psycopg2://" + url[len("postgresql://"):]

    # Detect Vercel / AWS Lambda serverless execution environment
    is_serverless = bool(
        os.getenv("VERCEL") or
        os.getenv("AWS_LAMBDA_FUNCTION_NAME") or
        os.getenv("VERCEL_ENV")
    )

    if url.startswith("sqlite"):
        if is_serverless:
            # Serverless deployment directory is strictly read-only; /tmp is the only writable directory
            logger.warning(
                "Running in serverless/Vercel environment with SQLite URL. "
                "Redirecting SQLite path to '/tmp/studyos.db' to prevent read-only filesystem crash. "
                "NOTE: /tmp is ephemeral on serverless. Set DATABASE_URL to a hosted PostgreSQL database (e.g. Neon, Supabase) for persistent production data."
            )
            url = "sqlite:////tmp/studyos.db"
        elif url.startswith("sqlite:///."):
            rel_path = url[len("sqlite:///."):].lstrip("/\\")
            abs_path = (BACKEND_DIR / rel_path).resolve()
            abs_path.parent.mkdir(parents=True, exist_ok=True)
            url = f"sqlite:///{abs_path.as_posix()}"
        elif url.startswith("sqlite:///") and not url.startswith("sqlite:////"):
            file_part = url[len("sqlite:///"):]
            if not Path(file_part).is_absolute():
                abs_path = (BACKEND_DIR / file_part).resolve()
                abs_path.parent.mkdir(parents=True, exist_ok=True)
                url = f"sqlite:///{abs_path.as_posix()}"

    return url


# Normalize database URL
db_url = normalize_database_url(settings.DATABASE_URL)

# Configure SQLAlchemy engine based on target dialect
if db_url.startswith("sqlite"):
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
    )
else:
    # Hosted PostgreSQL configuration with resilient connection pooling
    connect_args = {}
    # Enforce SSL for remote cloud databases if not already specified
    if "sslmode=" not in db_url and "localhost" not in db_url and "127.0.0.1" not in db_url:
        connect_args["sslmode"] = "require"

    engine = create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True,      # Verify connection liveness before checkout
        pool_recycle=300,        # Recycle connections every 5 minutes to avoid stale cloud drops
        pool_size=5,             # Safe pool size for serverless lambdas
        max_overflow=10,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency: yields a database session and ensures it's closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_database_migrations():
    """Apply safe, dialect-agnostic column migrations across SQLite and PostgreSQL."""
    try:
        insp = inspect(engine)
        tables = insp.get_table_names()
        if "interview_questions" in tables:
            existing_cols = {c["name"] for c in insp.get_columns("interview_questions")}
            columns_to_add = [
                ("relevance_score", "FLOAT"),
                ("completeness_score", "FLOAT"),
                ("communication_score", "FLOAT"),
                ("overall_score", "FLOAT"),
                ("is_skipped", "BOOLEAN DEFAULT FALSE"),
            ]
            with engine.begin() as conn:
                for col_name, col_type in columns_to_add:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE interview_questions ADD COLUMN {col_name} {col_type}"))
                        logger.info(f"Added column {col_name} to interview_questions table.")
    except Exception as e:
        logger.warning(f"Database column migration note: {e}")


def init_database_tables() -> bool:
    """
    Safely initialize all database tables and apply migrations on startup.
    Catches errors without crashing the entire ASGI/FastAPI application.
    Masks credentials when logging database URLs.
    """
    safe_url = engine.url.render_as_string(hide_password=True)
    try:
        logger.info(f"Connecting to database [{safe_url}]...")
        # Verify connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"Database connection verified successfully [{safe_url}].")

        # Create all tables
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")

        # Run safe migrations
        run_database_migrations()
        return True
    except Exception as exc:
        logger.error(
            f"Database initialization failed for [{safe_url}]: {exc}. "
            "FastAPI will start in degraded mode. Please check DATABASE_URL and network connectivity."
        )
        return False
