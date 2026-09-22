from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings

is_sqlite = settings.effective_database_url.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.effective_database_url,
    connect_args=connect_args,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def ensure_schema_compatibility():
    """Ensures SQLite schema contains new open-world columns without requiring external migrations."""
    if not is_sqlite:
        return
    from sqlalchemy import text, inspect
    try:
        insp = inspect(engine)
        if "medicines" in insp.get_table_names():
            existing = {c["name"] for c in insp.get_columns("medicines")}
            new_cols = [
                ("canonical_name", "VARCHAR(255)"),
                ("active_ingredients", "TEXT"),
                ("route", "VARCHAR(100)"),
                ("rxnorm_cui", "VARCHAR(50)"),
                ("ndc", "VARCHAR(50)"),
                ("source_id", "VARCHAR(100)"),
                ("source_version", "VARCHAR(50)"),
                ("retrieved_at", "DATETIME"),
            ]
            with engine.connect() as conn:
                for col_name, col_type in new_cols:
                    if col_name not in existing:
                        try:
                            conn.execute(text(f"ALTER TABLE medicines ADD COLUMN {col_name} {col_type}"))
                        except Exception:
                            pass
                conn.commit()
    except Exception:
        pass


ensure_schema_compatibility()


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a SQLAlchemy database session,
    ensuring cleanup and teardown on completion.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
