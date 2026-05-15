"""
database/db.py — SQLAlchemy engine + session factory.
All models import `Base` and `get_session` from here.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import Config

# Create engine (SQLite or MySQL depending on DATABASE_URL)
engine = create_engine(
    Config.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in Config.DATABASE_URL else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_session():
    """Yield a DB session; always closed after use."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def init_db():
    """Create all tables if they don't exist yet."""
    from database.models import User, Document, ChatHistory  # noqa: F401
    Base.metadata.create_all(bind=engine)
