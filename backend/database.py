import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "development").lower().strip()
raw_db_url = os.getenv("DATABASE_URL", "").strip()

if APP_ENV == "production":
    if not raw_db_url:
        raise RuntimeError("DATABASE_URL environment variable is required in production mode.")
    if not (
        raw_db_url.startswith("postgresql://")
        or raw_db_url.startswith("postgres://")
        or raw_db_url.startswith("postgresql+psycopg2://")
    ):
        raise RuntimeError(
            "Invalid DATABASE_URL for production: only PostgreSQL connections are supported."
        )
    # Normalize legacy postgres:// scheme to postgresql:// for SQLAlchemy 2.0 compatibility
    DATABASE_URL = (
        raw_db_url.replace("postgres://", "postgresql://", 1)
        if raw_db_url.startswith("postgres://")
        else raw_db_url
    )
else:
    # Development / non-production mode: allow PostgreSQL if configured, otherwise fallback to local SQLite
    if raw_db_url.startswith("postgresql://") or raw_db_url.startswith("postgresql+psycopg2://"):
        DATABASE_URL = raw_db_url
    elif raw_db_url.startswith("postgres://"):
        DATABASE_URL = raw_db_url.replace("postgres://", "postgresql://", 1)
    elif raw_db_url.startswith("sqlite://"):
        DATABASE_URL = raw_db_url
    else:
        DATABASE_URL = "sqlite:///./ideaforge.db"

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    # Hardened PostgreSQL connection pool for Render + Neon:
    # - pool_pre_ping: tests connections upon checkout, gracefully recovering from dropped/scaled-to-zero connections
    # - pool_recycle: periodically recycles connections to prevent stale timeout drops
    # - pool_size / max_overflow: conservative limits to prevent exhausting Neon connection limits
    # - pool_timeout: max wait for an available pool connection
    # - connect_timeout: fail fast if the database host is unreachable
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
        connect_args={"connect_timeout": 10},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
