"""
IdeaForge - Read-Only Production Schema Inspector & Baseline Verifier
Phase 2: Database & Production Configuration Hardening

This script is STRICTLY READ-ONLY.
It executes NO DDL, NO DML, NO STAMP, and NO MIGRATIONS.
It safely connects using SQLAlchemy Inspector and compares the live schema
against the intended 0001_baseline_schema.
"""

import os
import sys
from typing import Dict, List, Tuple
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine.url import make_url


def mask_db_url(raw_url: str) -> str:
    """Mask credentials in database URL for safe logging."""
    try:
        url = make_url(raw_url)
        return f"{url.drivername}://{url.username or ''}:***@{url.host or ''}:{url.port or ''}/{url.database or ''}"
    except Exception:
        return "postgresql://***:***@***"


def normalize_type_str(type_obj) -> str:
    """Normalize SQL type representation across SQLite and PostgreSQL."""
    raw = str(type_obj).upper()
    if "INT" in raw or "SERIAL" in raw:
        return "INTEGER"
    if "VARCHAR" in raw or "TEXT" in raw or "STRING" in raw:
        return "STRING"
    if "JSON" in raw:
        return "JSON"
    if "TIME" in raw or "DATE" in raw:
        return "DATETIME"
    return raw


def inspect_schema(engine) -> Tuple[Dict, Dict, Dict]:
    """Retrieve read-only schema metadata using SQLAlchemy Inspector."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    schema_data = {}
    for table_name in ["users", "roadmaps", "alembic_version"]:
        if table_name not in existing_tables:
            schema_data[table_name] = None
            continue

        columns = {col["name"]: col for col in inspector.get_columns(table_name)}
        pk = inspector.get_pk_constraint(table_name)
        fks = inspector.get_foreign_keys(table_name)
        indexes = inspector.get_indexes(table_name)
        uniques = inspector.get_unique_constraints(table_name)

        schema_data[table_name] = {
            "columns": columns,
            "pk": pk.get("constrained_columns", []),
            "fks": fks,
            "indexes": indexes,
            "uniques": uniques,
        }

    return schema_data


def compare_against_baseline(schema_data: Dict) -> Tuple[bool, Dict[str, List[str]]]:
    """
    Compare observed schema against the intended 0001_baseline_schema.
    Returns (all_matched: bool, diffs_per_table: dict).
    """
    diffs = {"users": [], "roadmaps": []}

    # 1. Compare users table
    users_data = schema_data.get("users")
    if not users_data:
        diffs["users"].append("Table 'users' is missing entirely.")
    else:
        cols = users_data["columns"]
        # Required columns: id, email, hashed_password, created_at
        expected_cols = {
            "id": {"type": "INTEGER", "nullable": False},
            "email": {"type": "STRING", "nullable": False},
            "hashed_password": {"type": "STRING", "nullable": False},
            "created_at": {"type": "DATETIME", "nullable": True},
        }
        for col_name, exp in expected_cols.items():
            if col_name not in cols:
                diffs["users"].append(f"Missing column '{col_name}'.")
            else:
                observed_type = normalize_type_str(cols[col_name]["type"])
                if observed_type != exp["type"]:
                    diffs["users"].append(
                        f"Column '{col_name}' type mismatch: expected {exp['type']}, observed {observed_type}."
                    )
                if exp["nullable"] is False and cols[col_name]["nullable"] is True:
                    diffs["users"].append(f"Column '{col_name}' should be NOT NULL, but is nullable.")

        # Primary Key
        if "id" not in users_data["pk"]:
            diffs["users"].append(f"Expected Primary Key on 'id', observed PK: {users_data['pk']}.")

        # Uniqueness on email (unique constraint OR unique index)
        has_unique_email = False
        for idx in users_data["indexes"]:
            if "email" in idx.get("column_names", []) and idx.get("unique"):
                has_unique_email = True
                break
        if not has_unique_email:
            for uq in users_data["uniques"]:
                if "email" in uq.get("column_names", []):
                    has_unique_email = True
                    break
        if not has_unique_email:
            diffs["users"].append("Missing unique constraint or unique index on 'email'.")

    # 2. Compare roadmaps table
    roadmaps_data = schema_data.get("roadmaps")
    if not roadmaps_data:
        diffs["roadmaps"].append("Table 'roadmaps' is missing entirely.")
    else:
        cols = roadmaps_data["columns"]
        expected_cols = {
            "id": {"type": "INTEGER", "nullable": False},
            "user_id": {"type": "INTEGER", "nullable": True},  # Must be nullable=True for baseline
            "original_idea": {"type": "STRING", "nullable": False},
            "data": {"type": "JSON", "nullable": False},
            "created_at": {"type": "DATETIME", "nullable": True},
        }
        for col_name, exp in expected_cols.items():
            if col_name not in cols:
                diffs["roadmaps"].append(f"Missing column '{col_name}'.")
            else:
                observed_type = normalize_type_str(cols[col_name]["type"])
                if observed_type != exp["type"]:
                    diffs["roadmaps"].append(
                        f"Column '{col_name}' type mismatch: expected {exp['type']}, observed {observed_type}."
                    )
                # Nullable check
                if exp["nullable"] is False and cols[col_name]["nullable"] is True:
                    diffs["roadmaps"].append(f"Column '{col_name}' should be NOT NULL, but is nullable.")
                if col_name == "user_id" and cols[col_name]["nullable"] is False:
                    diffs["roadmaps"].append(
                        "Column 'user_id' is NOT NULL! Baseline safety requires nullable=True for legacy unowned roadmaps."
                    )

        # Primary Key
        if "id" not in roadmaps_data["pk"]:
            diffs["roadmaps"].append(f"Expected Primary Key on 'id', observed PK: {roadmaps_data['pk']}.")

        # Foreign Key to users.id
        has_fk_to_users = False
        for fk in roadmaps_data["fks"]:
            if fk.get("referred_table") == "users" and "id" in fk.get("referred_columns", []):
                has_fk_to_users = True
                break
        if not has_fk_to_users:
            diffs["roadmaps"].append("Missing Foreign Key from 'roadmaps.user_id' to 'users.id'.")

    all_matched = (len(diffs["users"]) == 0) and (len(diffs["roadmaps"]) == 0)
    return all_matched, diffs


def run_inspection(db_url: str = None) -> bool:
    """Connect to database, print metadata, and evaluate baseline match."""
    raw_url = db_url or os.getenv("DATABASE_URL", "").strip()

    if not raw_url:
        print("[ERROR] DATABASE_URL environment variable is required to run inspection.")
        print("\nUsage example for production check:")
        print("  $env:APP_ENV = 'production'")
        print("  $env:DATABASE_URL = 'postgresql://user:pass@ep-xyz.neon.tech/ideaforge?sslmode=require'")
        print("  .\\backend\\.venv\\Scripts\\python.exe backend/inspect_production_schema.py")
        sys.exit(1)

    # Normalize postgres:// to postgresql://
    connect_url = raw_url.replace("postgres://", "postgresql://", 1) if raw_url.startswith("postgres://") else raw_url

    print("=" * 60)
    print("IDEAFORGE READ-ONLY PRODUCTION SCHEMA INSPECTION")
    print(f"Target Database: {mask_db_url(connect_url)}")
    print("Mode: STRICTLY READ-ONLY (No DDL / No DML / No Stamping)")
    print("=" * 60)

    connect_args = {}
    if connect_url.startswith("postgresql://") or connect_url.startswith("postgres://"):
        connect_args["connect_timeout"] = 10
    elif connect_url.startswith("sqlite"):
        connect_args["timeout"] = 10

    # Connect with read-only intent and short timeout
    engine = create_engine(
        connect_url,
        connect_args=connect_args,
    )

    try:
        # Verify connectivity using SELECT 1
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        schema_data = inspect_schema(engine)

        # Print Schema Findings
        print("\n--- 1. Tables Discovered ---")
        for table in ["users", "roadmaps", "alembic_version"]:
            if schema_data.get(table) is not None:
                print(f"  [FOUND] {table}")
            else:
                print(f"  [NOT FOUND] {table}")

        # Print alembic_version details
        if schema_data.get("alembic_version"):
            try:
                with engine.connect() as conn:
                    v_res = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
                    versions = [r[0] for r in v_res]
                    print(f"  alembic_version table content: {versions}")
            except Exception as e:
                print(f"  alembic_version exists but query failed: {e}")
        else:
            print("  alembic_version: Not yet created (Normal for pre-migration live database)")

        # Detailed users table metadata
        users_info = schema_data.get("users")
        if users_info:
            print("\n--- 2. Users Table Metadata ---")
            for col_name, c in users_info["columns"].items():
                print(f"  - {col_name}: {c['type']} (nullable={c['nullable']})")
            print(f"  Primary Key: {users_info['pk']}")
            for idx in users_info["indexes"]:
                print(f"  Index: {idx['name']} on {idx['column_names']} (unique={idx.get('unique', False)})")
            for uq in users_info["uniques"]:
                print(f"  Unique Constraint: {uq['name']} on {uq['column_names']}")

        # Detailed roadmaps table metadata
        roadmaps_info = schema_data.get("roadmaps")
        if roadmaps_info:
            print("\n--- 3. Roadmaps Table Metadata ---")
            for col_name, c in roadmaps_info["columns"].items():
                print(f"  - {col_name}: {c['type']} (nullable={c['nullable']})")
            print(f"  Primary Key: {roadmaps_info['pk']}")
            for fk in roadmaps_info["fks"]:
                print(f"  Foreign Key: {fk.get('constrained_columns')} -> {fk.get('referred_table')}.{fk.get('referred_columns')}")
            for idx in roadmaps_info["indexes"]:
                print(f"  Index: {idx['name']} on {idx['column_names']}")

        # Baseline Comparison
        all_matched, diffs = compare_against_baseline(schema_data)
        print("\n" + "=" * 60)
        print("BASELINE COMPARISON REPORT (Against 0001_baseline_schema)")
        print("=" * 60)

        if not diffs["users"]:
            print("[MATCH] users table matches 0001_baseline_schema specification.")
        else:
            print("[MISMATCH] users table has differences:")
            for d in diffs["users"]:
                print(f"  - {d}")

        if not diffs["roadmaps"]:
            print("[MATCH] roadmaps table matches 0001_baseline_schema specification.")
        else:
            print("[MISMATCH] roadmaps table has differences:")
            for d in diffs["roadmaps"]:
                print(f"  - {d}")

        print("\n" + "-" * 60)
        if all_matched:
            print("VERDICT: MATCH")
            print("Production schema is completely compatible with 0001_baseline_schema.")
            print("After operator verification, it is safe to perform the one-time stamp:")
            print("  alembic -c backend/alembic.ini stamp 0001_baseline_schema")
        else:
            print("VERDICT: MISMATCH")
            print("Differences detected between database schema and baseline migration.")
            print("DO NOT STAMP UNTIL DIFFERENCES ARE INVESTIGATED.")
        print("-" * 60)

        return all_matched

    finally:
        engine.dispose()


if __name__ == "__main__":
    run_inspection()
