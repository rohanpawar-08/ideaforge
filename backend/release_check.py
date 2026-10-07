"""
backend/release_check.py

Release Safety & Pre-Deployment Verification Script for IdeaForge.
Local-only, non-destructive safety checks.
Exits 0 on success, non-zero on failure.
"""

import os
import py_compile
import re
import subprocess
import sys
import tempfile

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BACKEND_DIR)
sys.path.insert(0, BACKEND_DIR)


def print_step(title: str):
    print(f"\n[CHECK] {title}")


def check_python_compilation():
    print_step("Python syntax & compilation checks")
    files_to_compile = [
        "main.py",
        "database.py",
        "models.py",
        "schemas.py",
        "blueprint_v2.py",
        "services/ai_service.py",
        "services/email_service.py",
        "services/logging_service.py",
        "inspect_production_schema.py",
    ]
    for rel_path in files_to_compile:
        full_path = os.path.join(BACKEND_DIR, rel_path)
        if os.path.exists(full_path):
            py_compile.compile(full_path, doraise=True)
            print(f"  [PASS] Compiled {rel_path}")
        else:
            raise FileNotFoundError(f"Missing required backend file: {rel_path}")
    print("  [PASS] All core backend Python files compiled cleanly.")


def check_startup_schema_mutation_absent():
    print_step("Verification: Startup schema mutation remains absent")
    main_path = os.path.join(BACKEND_DIR, "main.py")
    with open(main_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Base.metadata.create_all must not be called in main.py
    if re.search(r"\bBase\.metadata\.create_all\b", content):
        raise AssertionError("CRITICAL: Found Base.metadata.create_all in main.py! Schema mutations must only happen via Alembic.")

    # Raw ALTER TABLE must not be executed in main.py
    if re.search(r'execute\(text\(["\']ALTER TABLE', content, re.IGNORECASE):
        raise AssertionError("CRITICAL: Found raw ALTER TABLE statements in main.py! Database DDL must route via Alembic.")

    print("  [PASS] Verified Base.metadata.create_all and raw ALTER TABLE are absent from main.py.")


def check_alembic_heads_and_drift():
    print_step("Alembic migration head & drift verification on isolated temporary DB")
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    alembic_cfg = Config(os.path.join(BACKEND_DIR, "alembic.ini"))
    script = ScriptDirectory.from_config(alembic_cfg)
    heads = script.get_heads()

    if len(heads) != 1:
        raise AssertionError(f"Expected exactly 1 Alembic head, found {len(heads)}: {heads}")

    expected_head = "0003_ai_usage_tracking"
    if heads[0] != expected_head:
        raise AssertionError(f"Expected Alembic head '{expected_head}', got '{heads[0]}'")

    print(f"  [PASS] Alembic has single head: {heads[0]}")

    # Verify zero drift on clean temporary DB
    temp_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
    try:
        env = os.environ.copy()
        env["DATABASE_URL"] = f"sqlite:///{temp_db}"
        env["APP_ENV"] = "development"
        env["SECRET_KEY"] = "ideaforge_release_check_jwt_secret_key_at_least_32_chars"

        up_res = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND_DIR,
            env=env,
            capture_output=True,
            text=True,
        )
        if up_res.returncode != 0:
            raise RuntimeError(f"alembic upgrade head failed: {up_res.stderr}")

        check_res = subprocess.run(
            [sys.executable, "-m", "alembic", "check"],
            cwd=BACKEND_DIR,
            env=env,
            capture_output=True,
            text=True,
        )
        if check_res.returncode != 0:
            raise AssertionError(f"alembic check failed (schema drift detected): {check_res.stderr} {check_res.stdout}")

        print("  [PASS] alembic check passed: Zero drift between models and migration head.")
    finally:
        if os.path.exists(temp_db):
            try:
                os.remove(temp_db)
            except Exception:
                pass


def check_production_config_shape():
    print_step("Production configuration validator shape check")
    from services.logging_service import validate_startup_configuration

    # Simulate missing configuration
    test_env = {
        "APP_ENV": "production",
        "SECRET_KEY": "",
        "DATABASE_URL": "",
    }
    old_env = os.environ.copy()
    try:
        os.environ.clear()
        os.environ.update(test_env)
        try:
            validate_startup_configuration("production")
            raise AssertionError("Validator failed to catch missing production variables!")
        except RuntimeError as err:
            assert "SECRET_KEY" in str(err)
            assert "DATABASE_URL" in str(err)
            print("  [PASS] Correctly rejected incomplete production configuration.")

        # Simulate valid production shape
        os.environ["APP_ENV"] = "production"
        os.environ["SECRET_KEY"] = "valid_production_secret_key_at_least_32_characters"
        os.environ["DATABASE_URL"] = "postgresql://user:pass@host:5432/db"
        os.environ["LLM_API_KEY"] = "gsk_dummy_mock_key_for_shape_validation"
        os.environ["CORS_ORIGINS"] = "https://ideaforge-steel-alpha.vercel.app"

        res = validate_startup_configuration("production")
        assert res["status"] == "valid"
        print("  [PASS] Correctly validated valid production configuration shape.")
    finally:
        os.environ.clear()
        os.environ.update(old_env)


def check_no_tracked_secrets():
    print_step("Static source scan: Checking for accidental committed secrets")
    patterns = [
        re.compile(r"gsk_[a-zA-Z0-9]{20,}", re.IGNORECASE),
        re.compile(r"AKIA[0-9A-Z]{16}", re.IGNORECASE),
        re.compile(r"-----BEGIN (RSA|EC|PGP|OPENSSH) PRIVATE KEY-----"),
        re.compile(r"re_[a-zA-Z0-9]{20,}", re.IGNORECASE),  # Resend API keys
    ]

    files_to_scan = [
        "backend/main.py",
        "backend/database.py",
        "backend/models.py",
        "backend/schemas.py",
        "backend/blueprint_v2.py",
        "backend/services/ai_service.py",
        "backend/services/email_service.py",
        "backend/services/logging_service.py",
        "backend/.env.example",
        "frontend/src/services/api.js",
        "frontend/.env.example",
    ]

    for rel_path in files_to_scan:
        full_path = os.path.join(ROOT_DIR, rel_path)
        if not os.path.exists(full_path):
            continue
        with open(full_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            for line_no, line in enumerate(lines, 1):
                for pat in patterns:
                    if pat.search(line):
                        raise AssertionError(f"Potential secret pattern detected in {rel_path}:{line_no}!")

    print("  [PASS] No obvious hardcoded secret patterns found in tracked source files.")


def main():
    print("=" * 60)
    print("IdeaForge Release Safety Pre-Flight Check")
    print("=" * 60)

    try:
        check_python_compilation()
        check_startup_schema_mutation_absent()
        check_alembic_heads_and_drift()
        check_production_config_shape()
        check_no_tracked_secrets()

        print("\n" + "=" * 60)
        print("ALL RELEASE SAFETY PRE-FLIGHT CHECKS PASSED SUCCESSFULLY!")
        print("=" * 60)
        sys.exit(0)
    except Exception as exc:
        print(f"\n[FAIL] Release check error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
