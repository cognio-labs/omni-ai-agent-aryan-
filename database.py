"""
database.py — Synchronous SQLAlchemy engine and session factory.
Tables are created on startup via create_all().
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from models import Base
from config import get_settings

settings = get_settings()

# SQLite engine — connect_args required for multi-threaded FastAPI usage
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    """
    FastAPI dependency that yields a DB session and closes it afterwards.
    Usage: db: Session = Depends(get_db)
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
