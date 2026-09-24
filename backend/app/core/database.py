from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings, BACKEND_DIR

db_url = settings.DATABASE_URL
if db_url.startswith("sqlite:///."):
    # Resolve relative sqlite paths like sqlite:///./studyos.db to absolute path
    rel_path = db_url[len("sqlite:///."):].lstrip("/\\")
    abs_path = (BACKEND_DIR / rel_path).as_posix()
    db_url = f"sqlite:///{abs_path}"

if db_url.startswith("sqlite"):
    engine = create_engine(
        db_url,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_engine(
        db_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
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
