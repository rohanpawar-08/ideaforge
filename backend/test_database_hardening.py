"""
IdeaForge Database Hardening Regression & Verification Suite
Phase 2: Database & Production Configuration Hardening
"""

import inspect
import json
import os
import py_compile
import re
import sqlite3
import subprocess
import sys
import tempfile
from unittest.mock import MagicMock

from sqlalchemy import inspect as sa_inspect, text


VENV_PYTHON = os.path.abspath(
    os.path.join(os.path.dirname(__file__), ".venv", "Scripts", "python.exe")
)
BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
REPO_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))


def run_py_command(code: str, env_vars: dict) -> subprocess.CompletedProcess:
    full_env = os.environ.copy()
    full_env.update(env_vars)
    return subprocess.run(
        [VENV_PYTHON, "-c", code],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        env=full_env,
    )


def test_compile_checks():
    print("\n--- Check 1: Python Compile Checks ---")
    files_to_compile = [
        os.path.join(BACKEND_DIR, "database.py"),
        os.path.join(BACKEND_DIR, "models.py"),
        os.path.join(BACKEND_DIR, "main.py"),
        os.path.join(BACKEND_DIR, "inspect_production_schema.py"),
        os.path.join(BACKEND_DIR, "alembic", "env.py"),
        os.path.join(BACKEND_DIR, "alembic", "versions", "0001_baseline_schema.py"),
    ]
    for file_path in files_to_compile:
        py_compile.compile(file_path, doraise=True)
        print(f"[PASS] Successfully compiled {os.path.relpath(file_path, REPO_ROOT)}")


def test_production_missing_db_url():
    print("\n--- Check 2: Production Missing DATABASE_URL ---")
    code = (
        "import sys; sys.path.insert(0, 'backend'); "
        "import database"
    )
    result = run_py_command(code, {"APP_ENV": "production", "DATABASE_URL": ""})
    assert result.returncode != 0, "Expected failure when DATABASE_URL is missing in production!"
    assert "DATABASE_URL environment variable is required in production mode" in result.stderr
    print("[PASS] Production missing DATABASE_URL failed startup clearly with RuntimeError.")


def test_production_invalid_db_url():
    print("\n--- Check 3: Production Invalid DATABASE_URL ---")
    code = (
        "import sys; sys.path.insert(0, 'backend'); "
        "import database"
    )
    result = run_py_command(
        code,
        {"APP_ENV": "production", "DATABASE_URL": "mysql://user:pass@localhost:3306/ideaforge"},
    )
    assert result.returncode != 0, "Expected failure for non-Postgres URL in production!"
    assert "Invalid DATABASE_URL for production: only PostgreSQL" in result.stderr
    print("[PASS] Production invalid DATABASE_URL failed startup clearly with RuntimeError.")


def test_production_sqlite_rejected():
    print("\n--- Check 4: Production SQLite URL Rejected ---")
    code = (
        "import sys; sys.path.insert(0, 'backend'); "
        "import database"
    )
    result = run_py_command(
        code,
        {"APP_ENV": "production", "DATABASE_URL": "sqlite:///./prod_ideaforge.db"},
    )
    assert result.returncode != 0, "Expected rejection of SQLite DATABASE_URL in production!"
    assert "Invalid DATABASE_URL for production: only PostgreSQL" in result.stderr
    print("[PASS] Production SQLite URL rejected clearly with RuntimeError.")


def test_production_valid_postgres_config():
    print("\n--- Check 5: Production Valid PostgreSQL URL Parsing & Pool Config ---")
    # Test both postgresql:// and legacy postgres:// normalization
    code = """
import sys
sys.path.insert(0, 'backend')
import database

# Validate URL normalization
assert database.DATABASE_URL.startswith("postgresql://"), f"Expected normalized postgresql://, got {database.DATABASE_URL}"
# Validate pool settings without attempting network connection
engine = database.engine
assert engine.pool._pre_ping is True, "pool_pre_ping must be enabled"
assert engine.pool._recycle == 300, "pool_recycle must be 300 seconds"
assert engine.pool.size() == 5, f"pool_size expected 5, got {engine.pool.size()}"
assert engine.pool._max_overflow == 10, f"max_overflow expected 10, got {engine.pool._max_overflow}"
assert engine.pool._timeout == 30, f"pool_timeout expected 30, got {engine.pool._timeout}"
print("POSTGRES_CONFIG_VALID")
"""
    # 5a: Standard postgresql:// URL
    res_a = run_py_command(
        code,
        {"APP_ENV": "production", "DATABASE_URL": "postgresql://user:pass@ep-test.neon.tech/ideaforge"},
    )
    assert res_a.returncode == 0 and "POSTGRES_CONFIG_VALID" in res_a.stdout, (
        f"Failed on postgresql:// check:\nSTDOUT: {res_a.stdout}\nSTDERR: {res_a.stderr}"
    )

    # 5b: Legacy postgres:// URL normalization
    res_b = run_py_command(
        code,
        {"APP_ENV": "production", "DATABASE_URL": "postgres://user:pass@ep-test.neon.tech/ideaforge"},
    )
    assert res_b.returncode == 0 and "POSTGRES_CONFIG_VALID" in res_b.stdout, (
        f"Failed on postgres:// check:\nSTDOUT: {res_b.stdout}\nSTDERR: {res_b.stderr}"
    )
    print("[PASS] Production PostgreSQL configuration and legacy URL normalization verified.")


def test_development_sqlite_fallback():
    print("\n--- Check 6: Development SQLite Fallback ---")
    code = """
import sys
sys.path.insert(0, 'backend')
import database
from sqlalchemy import text

assert database.APP_ENV == "development"
assert database.DATABASE_URL.startswith("sqlite")
with database.engine.connect() as conn:
    res = conn.execute(text("SELECT 1")).scalar()
    assert res == 1
print("DEV_SQLITE_VALID")
"""
    result = run_py_command(code, {"APP_ENV": "development", "DATABASE_URL": ""})
    assert result.returncode == 0 and "DEV_SQLITE_VALID" in result.stdout, (
        f"Development SQLite fallback failed:\nSTDOUT: {result.stdout}\nSTDERR: {result.stderr}"
    )
    print("[PASS] Development environment cleanly falls back to SQLite and executes queries.")


def test_alembic_configuration_import():
    print("\n--- Check 7: Alembic Configuration & Imports ---")
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    ini_path = os.path.join(BACKEND_DIR, "alembic.ini")
    config = Config(ini_path)
    script = ScriptDirectory.from_config(config)
    heads = script.get_heads()
    assert "0001_baseline_schema" in heads, f"Expected 0001_baseline_schema in heads, got {heads}"
    print(f"[PASS] Alembic configuration loaded successfully. Current head: {heads}")


def test_alembic_migration_on_fresh_database():
    print("\n--- Checks 8, 9 & 10: Alembic Migration on Fresh Database & Schema Inspection ---")
    temp_dir = tempfile.mkdtemp()
    temp_db_path = os.path.join(temp_dir, "fresh_test.db").replace("\\", "/")
    sqlite_url = f"sqlite:///{temp_db_path}"

    try:
        # Run alembic upgrade head
        upgrade_cmd = [
            VENV_PYTHON,
            "-m",
            "alembic",
            "-c",
            os.path.join(BACKEND_DIR, "alembic.ini"),
            "upgrade",
            "head",
        ]
        res = subprocess.run(
            upgrade_cmd,
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            env=dict(os.environ, DATABASE_URL=sqlite_url, APP_ENV="development"),
        )
        assert res.returncode == 0, f"alembic upgrade head failed:\n{res.stderr}\n{res.stdout}"
        print("[PASS] Check 8: alembic upgrade head created schema successfully on fresh database.")

        # Check 9: Verify expected tables
        from sqlalchemy import create_engine
        engine = create_engine(sqlite_url)
        inspector = sa_inspect(engine)
        tables = set(inspector.get_table_names())
        assert {"users", "roadmaps", "alembic_version"}.issubset(tables), (
            f"Missing expected tables. Found: {tables}"
        )
        print(f"[PASS] Check 9: Verified tables exist: {tables}")

        # Check 10: Verify columns, indexes, constraints
        user_cols = {col["name"]: col for col in inspector.get_columns("users")}
        assert "id" in user_cols and not user_cols["id"]["nullable"]
        assert "email" in user_cols and not user_cols["email"]["nullable"]
        assert "hashed_password" in user_cols and not user_cols["hashed_password"]["nullable"]
        assert "created_at" in user_cols

        roadmap_cols = {col["name"]: col for col in inspector.get_columns("roadmaps")}
        assert "id" in roadmap_cols and not roadmap_cols["id"]["nullable"]
        assert "user_id" in roadmap_cols
        # Critical safety check: Roadmap.user_id must be nullable=True in baseline migration
        assert roadmap_cols["user_id"]["nullable"] is True, (
            "CRITICAL: Roadmap.user_id must remain nullable=True for baseline existing production data safety!"
        )
        assert "original_idea" in roadmap_cols and not roadmap_cols["original_idea"]["nullable"]
        assert "data" in roadmap_cols and not roadmap_cols["data"]["nullable"]
        assert "created_at" in roadmap_cols

        # Indexes
        user_indexes = {idx["name"]: idx for idx in inspector.get_indexes("users")}
        assert "ix_users_email" in user_indexes and user_indexes["ix_users_email"]["unique"]
        assert "ix_users_id" in user_indexes

        roadmap_indexes = {idx["name"]: idx for idx in inspector.get_indexes("roadmaps")}
        assert "ix_roadmaps_id" in roadmap_indexes
        assert "ix_roadmaps_user_id" in roadmap_indexes

        # Foreign keys
        fks = inspector.get_foreign_keys("roadmaps")
        assert any(fk["referred_table"] == "users" and "id" in fk["referred_columns"] for fk in fks), (
            f"Expected foreign key from roadmaps to users. Found: {fks}"
        )
        print("[PASS] Check 10: Verified column types, nullability, unique indexes, and foreign keys.")

        # Also verify alembic check shows zero schema drift
        check_cmd = [
            VENV_PYTHON,
            "-m",
            "alembic",
            "-c",
            os.path.join(BACKEND_DIR, "alembic.ini"),
            "check",
        ]
        check_res = subprocess.run(
            check_cmd,
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            env=dict(os.environ, DATABASE_URL=sqlite_url, APP_ENV="development"),
        )
        assert check_res.returncode == 0, f"Alembic check detected schema drift:\n{check_res.stderr}\n{check_res.stdout}"
        print("[PASS] alembic check: Zero schema drift between models and migration.")

    finally:
        engine.dispose()
        if os.path.exists(temp_db_path):
            try:
                os.remove(temp_db_path)
            except OSError:
                pass


def test_startup_schema_mutation_removed():
    print("\n--- Check 13: Verify Application Startup No Longer Mutates Schema ---")
    main_py_path = os.path.join(BACKEND_DIR, "main.py")
    with open(main_py_path, "r", encoding="utf-8") as f:
        content = f.read()

    assert "Base.metadata.create_all" not in content, (
        "Base.metadata.create_all was found in main.py! Runtime schema creation must be removed."
    )
    assert "ALTER TABLE roadmaps ADD COLUMN" not in content, (
        "Raw ALTER TABLE was found in main.py! Runtime schema mutation must be removed."
    )
    print("[PASS] Confirmed: Base.metadata.create_all and raw ALTER TABLE are removed from main.py.")


def test_health_and_readiness_endpoints():
    print("\n--- Check 14: Health & Readiness Endpoints ---")
    # Ensure SECRET_KEY is present
    if not os.getenv("SECRET_KEY"):
        os.environ["SECRET_KEY"] = "super_secure_jwt_test_secret_key_2026_ideaforge_at_least_32_chars"

    sys.path.insert(0, BACKEND_DIR)
    import main
    from database import SessionLocal

    # 1. Root / endpoint (liveness)
    root_resp = main.root_status()
    assert root_resp == {"status": "IdeaForge backend is running"}
    print("[PASS] GET / returns 200 liveness status.")

    # 2. GET /health and /ready when database is connected
    db = SessionLocal()
    try:
        health_resp = main.readiness_check(db=db)
        assert health_resp == {"status": "ready", "database": "connected"}
        print("[PASS] GET /health returns 200 {'status': 'ready', 'database': 'connected'}.")
    finally:
        db.close()

    # 3. Simulated DB failure on readiness check
    mock_db = MagicMock()
    mock_db.execute.side_effect = RuntimeError("Fatal DB connection timeout postgres://user:secret@db.internal")

    fail_resp = main.readiness_check(db=mock_db)
    assert fail_resp.status_code == 503
    body = json.loads(fail_resp.body.decode("utf-8"))
    assert body == {"status": "unavailable", "database": "disconnected"}
    # Ensure no secrets or internal traces leak
    assert "secret" not in json.dumps(body)
    assert "Traceback" not in json.dumps(body)
    print("[PASS] GET /health on DB failure safely returns 503 without leaking credentials or tracebacks.")


def test_schema_inspector():
    print("\n--- Check 15: Schema Inspector & Baseline Comparison (MATCH & MISMATCH) ---")
    # 1. Missing DATABASE_URL fails safely
    res1 = subprocess.run(
        [VENV_PYTHON, "backend/inspect_production_schema.py"],
        capture_output=True,
        text=True,
        cwd=REPO_ROOT,
        env={"PATH": os.environ["PATH"], "SYSTEMROOT": os.environ.get("SYSTEMROOT", "C:\\Windows")},
    )
    assert res1.returncode != 0
    assert "DATABASE_URL environment variable is required" in res1.stdout
    print("[PASS] 15a: Missing DATABASE_URL exits cleanly with usage guidance.")

    # 2. Matching schema (created via alembic upgrade head) evaluates to MATCH
    temp_dir = tempfile.mkdtemp()
    tmp_match_db = os.path.join(temp_dir, "inspector_match.db").replace("\\", "/")
    match_url = f"sqlite:///{tmp_match_db}"

    tmp_mismatch_db = os.path.join(temp_dir, "inspector_mismatch.db").replace("\\", "/")
    mismatch_url = f"sqlite:///{tmp_mismatch_db}"

    try:
        # Create matching DB via Alembic
        subprocess.run(
            [VENV_PYTHON, "-m", "alembic", "-c", os.path.join(BACKEND_DIR, "alembic.ini"), "upgrade", "head"],
            capture_output=True,
            check=True,
            cwd=REPO_ROOT,
            env=dict(os.environ, DATABASE_URL=match_url, APP_ENV="development"),
        )
        res_match = subprocess.run(
            [VENV_PYTHON, "backend/inspect_production_schema.py"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            env=dict(os.environ, DATABASE_URL=match_url, APP_ENV="production"),
        )
        assert res_match.returncode == 0, f"Expected 0, got {res_match.returncode}: {res_match.stderr}"
        assert "VERDICT: MATCH" in res_match.stdout
        assert "[MATCH] users table matches" in res_match.stdout
        assert "[MATCH] roadmaps table matches" in res_match.stdout
        print("[PASS] 15b: Matching schema correctly evaluated as VERDICT: MATCH (Zero mutations).")

        # 3. Mismatched schema (missing users.hashed_password, roadmaps.user_id is NOT NULL)
        from sqlalchemy import create_engine
        mismatch_engine = create_engine(mismatch_url)
        with mismatch_engine.connect() as conn:
            conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR NOT NULL);"))
            conn.execute(text("CREATE UNIQUE INDEX ix_users_email ON users(email);"))
            conn.execute(
                text(
                    "CREATE TABLE roadmaps (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, "
                    "original_idea VARCHAR NOT NULL, data JSON NOT NULL);"
                )
            )
            conn.commit()
        mismatch_engine.dispose()

        res_mismatch = subprocess.run(
            [VENV_PYTHON, "backend/inspect_production_schema.py"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
            env=dict(os.environ, DATABASE_URL=mismatch_url, APP_ENV="production"),
        )
        assert "VERDICT: MISMATCH" in res_mismatch.stdout
        assert "Missing column 'hashed_password'" in res_mismatch.stdout
        assert "Column 'user_id' is NOT NULL" in res_mismatch.stdout
        print("[PASS] 15c: Mismatched schema correctly detected and evaluated as VERDICT: MISMATCH.")

    finally:
        for p in [tmp_match_db, tmp_mismatch_db]:
            if os.path.exists(p):
                try:
                    os.remove(p)
                except OSError:
                    pass


if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING DATABASE HARDENING TEST SUITE (PHASE 2)")
    print("=" * 60)

    test_compile_checks()
    test_production_missing_db_url()
    test_production_invalid_db_url()
    test_production_sqlite_rejected()
    test_production_valid_postgres_config()
    test_development_sqlite_fallback()
    test_alembic_configuration_import()
    test_alembic_migration_on_fresh_database()
    test_startup_schema_mutation_removed()
    test_health_and_readiness_endpoints()
    test_schema_inspector()

    print("\n" + "=" * 60)
    print("ALL PHASE 2 DATABASE HARDENING CHECKS PASSED!")
    print("=" * 60)
