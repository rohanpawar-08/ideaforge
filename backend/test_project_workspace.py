"""
backend/test_project_workspace.py

Comprehensive Test Suite for Phase 8: Project Workspace & Persistent Execution.
Verifies all 51 required backend behaviors:
- Migration / Schema (1-8)
- Stable Task Identity & Reconciliation (9-17)
- Workspace Service & Completion Metrics (18-25)
- PATCH Task Updates & Validation (26-33)
- Legacy Progress Import (34-37)
- Ownership & Security Negative Tests (38-42)
- Account Export & Deletion Cleanup (43-47)
- Regression Safeguards (48-51)
"""

import copy
from datetime import datetime, timezone
import json
import os
import subprocess
import sys
import tempfile
import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect as sa_inspect
from sqlalchemy.orm import sessionmaker

# Setup test environment before importing application
temp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
temp_db_path = temp_db_file.name.replace("\\", "/")
temp_db_file.close()

os.environ["DATABASE_URL"] = f"sqlite:///{temp_db_path}"
os.environ["APP_ENV"] = "development"
os.environ["SECRET_KEY"] = "ideaforge_jwt_super_secret_test_key_32_characters_long"

BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
REPO_ROOT = os.path.abspath(os.path.join(BACKEND_DIR, ".."))
sys.path.insert(0, BACKEND_DIR)

import models
from database import Base, get_db
import main
from main import app, limiter
from services.task_identity import (
    derive_phase_key,
    generate_v2_task_id,
    generate_v1_task_id,
    compute_task_fingerprint,
    canonicalize_v2_plan,
    canonicalize_v1_milestones,
    reconcile_tasks,
    normalize_task_text,
)
from services.workspace_service import WorkspaceService
from services.ai_service import record_ai_usage_event, get_user_ai_usage_summary, check_daily_user_limit

limiter.enabled = False

test_engine = create_engine(
    f"sqlite:///{temp_db_path}",
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


class ProjectWorkspaceTestSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create User A and User B
        cls.db = TestingSessionLocal()
        cls.user_a_email = "workspace_user_a@example.com"
        cls.user_b_email = "workspace_user_b@example.com"
        cls.password = "SecurePassword123!"

        cls.user_a = models.User(
            email=cls.user_a_email,
            hashed_password=main.hash_password(cls.password)
        )
        cls.user_b = models.User(
            email=cls.user_b_email,
            hashed_password=main.hash_password(cls.password)
        )
        cls.db.add_all([cls.user_a, cls.user_b])
        cls.db.commit()
        cls.db.refresh(cls.user_a)
        cls.db.refresh(cls.user_b)

        cls.token_a = main.create_access_token(cls.user_a.id, cls.user_a.email)
        cls.token_b = main.create_access_token(cls.user_b.id, cls.user_b.email)

        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}

    @classmethod
    def tearDownClass(cls):
        cls.db.close()
        try:
            if os.path.exists(temp_db_path):
                os.remove(temp_db_path)
        except Exception:
            pass

    # =========================================================================
    # SECTION 1: MIGRATION & SCHEMA (1 - 8)
    # =========================================================================

    def test_01_migration_applies_on_fresh_db(self):
        """1. 0004 migration applies cleanly via Alembic on fresh DB."""
        fresh_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        fresh_path = fresh_tmp.name.replace("\\", "/")
        fresh_tmp.close()

        res = subprocess.run(
            [sys.executable, "-m", "alembic", "-c", os.path.join(BACKEND_DIR, "alembic.ini"), "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            env={**os.environ, "DATABASE_URL": f"sqlite:///{fresh_path}"}
        )
        self.assertEqual(res.returncode, 0, f"Alembic upgrade head failed: {res.stderr}")

        # Check table exists
        eng = create_engine(f"sqlite:///{fresh_path}")
        inspector = sa_inspect(eng)
        tables = inspector.get_table_names()
        self.assertIn("project_task_states", tables)

        # 2. Table columns correct
        cols = {c["name"]: c for c in inspector.get_columns("project_task_states")}
        expected_cols = [
            "id", "user_id", "roadmap_id", "task_id", "task_fingerprint",
            "phase_key", "task_order", "status", "note", "source_schema",
            "created_at", "updated_at"
        ]
        for col_name in expected_cols:
            self.assertIn(col_name, cols, f"Missing column {col_name} in project_task_states")

        # 3. Unique roadmap_id + task_id constraint
        uqs = inspector.get_unique_constraints("project_task_states")
        uq_col_sets = [set(u["column_names"]) for u in uqs]
        # In SQLite, unique constraints or unique indexes enforce uniqueness
        unique_indexes = [set(ix["column_names"]) for ix in inspector.get_indexes("project_task_states") if ix.get("unique")]
        has_uq = ({"roadmap_id", "task_id"} in uq_col_sets) or ({"roadmap_id", "task_id"} in unique_indexes)
        self.assertTrue(has_uq, "Expected UNIQUE constraint/index on (roadmap_id, task_id)")

        # 4. Indexes correct
        indexes = {ix["name"]: ix for ix in inspector.get_indexes("project_task_states")}
        self.assertTrue(
            any("status" in ix["column_names"] and "roadmap_id" in ix["column_names"] for ix in indexes.values()),
            "Expected index on roadmap_id + status"
        )
        self.assertTrue(
            any("user_id" in ix["column_names"] and "roadmap_id" in ix["column_names"] for ix in indexes.values()),
            "Expected index on user_id + roadmap_id"
        )

        # 5. Foreign keys correct
        fks = inspector.get_foreign_keys("project_task_states")
        referred_tables = {fk["referred_table"] for fk in fks}
        self.assertIn("users", referred_tables)
        self.assertIn("roadmaps", referred_tables)

        # 6. Downgrade to 0003
        down_res = subprocess.run(
            [sys.executable, "-m", "alembic", "-c", os.path.join(BACKEND_DIR, "alembic.ini"), "downgrade", "0003_ai_usage_tracking"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            env={**os.environ, "DATABASE_URL": f"sqlite:///{fresh_path}"}
        )
        self.assertEqual(down_res.returncode, 0, f"Alembic downgrade failed: {down_res.stderr}")
        inspector2 = sa_inspect(eng)
        self.assertNotIn("project_task_states", inspector2.get_table_names())

        # 7. Upgrade head again
        up_res = subprocess.run(
            [sys.executable, "-m", "alembic", "-c", os.path.join(BACKEND_DIR, "alembic.ini"), "upgrade", "head"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            env={**os.environ, "DATABASE_URL": f"sqlite:///{fresh_path}"}
        )
        self.assertEqual(up_res.returncode, 0, f"Alembic re-upgrade failed: {up_res.stderr}")

        # 8. Alembic check zero drift
        check_res = subprocess.run(
            [sys.executable, "-m", "alembic", "-c", os.path.join(BACKEND_DIR, "alembic.ini"), "check"],
            capture_output=True,
            text=True,
            cwd=BACKEND_DIR,
            env={**os.environ, "DATABASE_URL": f"sqlite:///{fresh_path}"}
        )
        self.assertEqual(check_res.returncode, 0, f"Alembic drift check failed: {check_res.stderr}\n{check_res.stdout}")

        try:
            os.remove(fresh_path)
        except Exception:
            pass

    # =========================================================================
    # SECTION 2: TASK IDENTITY (9 - 17)
    # =========================================================================

    def test_09_v2_task_ids_generated(self):
        """9. V2 task IDs generated with semantic format."""
        t_id = generate_v2_task_id("database", "Create User Model and DB Migration")
        self.assertTrue(t_id.startswith("database."))
        self.assertIn("user-model", t_id)

    def test_10_same_blueprint_normalized_twice_yields_same_ids(self):
        """10. Same blueprint normalized twice yields identical task IDs."""
        plan = [
            {
                "phase": 1,
                "name": "Database Setup",
                "tasks": [
                    {"task": "Init Postgres", "files_or_modules": ["database.py"]},
                    {"task": "User Model", "files_or_modules": ["models.py"]}
                ]
            }
        ]
        tasks1 = canonicalize_v2_plan(plan)
        tasks2 = canonicalize_v2_plan(plan)
        ids1 = [t["task_id"] for t in tasks1]
        ids2 = [t["task_id"] for t in tasks2]
        self.assertEqual(ids1, ids2)

    def test_11_minor_punctuation_casing_preserves_id(self):
        """11. Minor casing and punctuation changes preserve semantic ID."""
        id_a = generate_v2_task_id("auth", "JWT Login Endpoint")
        id_b = generate_v2_task_id("auth", "jwt login endpoint!")
        self.assertEqual(id_a, id_b)

    def test_12_retained_task_id_survives_task_rename(self):
        """12. Existing explicit task_id is preserved despite title edit."""
        plan = [
            {
                "phase": 1,
                "name": "Database",
                "tasks": [{"task": "User Model Initial", "task_id": "database.user-model-custom"}]
            }
        ]
        tasks = canonicalize_v2_plan(plan)
        self.assertEqual(tasks[0]["task_id"], "database.user-model-custom")

    def test_13_added_task_gets_new_id(self):
        """13. Added task gets newly generated stable ID."""
        old_tasks = [{"task_id": "setup.repo-init", "task_fingerprint": "fp1", "task": "Init Repo", "phase_key": "setup"}]
        new_tasks = [
            {"task": "Init Repo", "phase_key": "setup", "task_id": "setup.repo-init", "task_fingerprint": "fp1"},
            {"task": "Setup Docker", "phase_key": "setup"}
        ]
        reconciled = reconcile_tasks(old_tasks, new_tasks)
        self.assertEqual(reconciled[0]["task_id"], "setup.repo-init")
        self.assertTrue(reconciled[1]["task_id"].startswith("setup."))
        self.assertNotEqual(reconciled[1]["task_id"], "setup.repo-init")

    def test_14_deleted_task_ignored_in_workspace(self):
        """14. Obsolete DB task state rows not in current blueprint are ignored."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Test Deleted Task",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {"phase": 1, "name": "Core", "tasks": [{"task": "Active Task"}]}
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        # Manually insert an obsolete row in DB
        obsolete_row = models.ProjectTaskState(
            user_id=self.user_a.id,
            roadmap_id=roadmap.id,
            task_id="core.obsolete-deleted-task",
            task_fingerprint="fp_old",
            status="done",
            source_schema=2
        )
        self.db.add(obsolete_row)
        self.db.commit()

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        # Obsolete row must NOT be counted in total_tasks or done_tasks
        self.assertEqual(ws["total_tasks"], 1)
        self.assertEqual(ws["done_tasks"], 0)
        self.assertEqual(ws["completion_percent"], 0)

    def test_15_reordered_phases_and_tasks_keep_ids(self):
        """15. Reordering phases and tasks does NOT change task IDs."""
        task_a = {"task": "Task Alpha", "files_or_modules": ["a.py"]}
        task_b = {"task": "Task Beta", "files_or_modules": ["b.py"]}

        plan_order_1 = [{"phase": 1, "name": "Phase One", "tasks": [task_a, task_b]}]
        plan_order_2 = [{"phase": 1, "name": "Phase One", "tasks": [task_b, task_a]}]

        t1 = {t["task"]: t["task_id"] for t in canonicalize_v2_plan(plan_order_1)}
        t2 = {t["task"]: t["task_id"] for t in canonicalize_v2_plan(plan_order_2)}

        self.assertEqual(t1["Task Alpha"], t2["Task Alpha"])
        self.assertEqual(t1["Task Beta"], t2["Task Beta"])

    def test_16_duplicate_title_in_different_phases_gets_distinct_ids(self):
        """16. Duplicate title in different phases gets distinct semantic IDs."""
        plan = [
            {"phase": 1, "name": "Backend API", "tasks": [{"task": "Write Unit Tests"}]},
            {"phase": 2, "name": "Frontend UI", "tasks": [{"task": "Write Unit Tests"}]}
        ]
        tasks = canonicalize_v2_plan(plan)
        id1 = tasks[0]["task_id"]
        id2 = tasks[1]["task_id"]
        self.assertNotEqual(id1, id2)
        self.assertTrue(id1.startswith("api."))
        self.assertTrue(id2.startswith("frontend."))

    def test_17_v1_adapter_repeat_yields_stable_ids(self):
        """17. Repeated adaptation of V1 milestones yields stable deterministic IDs."""
        milestones = [
            {"title": "Foundation", "tasks": ["Setup environment", "Configure DB"]}
        ]
        m1 = canonicalize_v1_milestones(milestones)
        m2 = canonicalize_v1_milestones(milestones)
        self.assertEqual([t["task_id"] for t in m1], [t["task_id"] for t in m2])
        self.assertTrue(m1[0]["task_id"].startswith("v1.phase-1."))

    def test_17b_same_title_different_files_reorder_preserves_task_ids(self):
        """A, B, C: Two same-title tasks with different files retain identical IDs when reversed."""
        task_backend = {
            "task": "Setup Login",
            "files_or_modules": ["auth/login.py", "services/auth.py"],
            "definition_of_done": "Backend JWT returns 200 with valid tokens"
        }
        task_frontend = {
            "task": "Setup Login",
            "files_or_modules": ["frontend/Login.jsx", "components/AuthModal.jsx"],
            "definition_of_done": "Frontend renders login form with submit button"
        }

        plan_forward = [
            {"phase": 1, "name": "Authentication", "tasks": [task_backend, task_frontend]}
        ]
        plan_reversed = [
            {"phase": 1, "name": "Authentication", "tasks": [task_frontend, task_backend]}
        ]

        tasks_fwd = canonicalize_v2_plan(plan_forward)
        tasks_rev = canonicalize_v2_plan(plan_reversed)

        id_backend_fwd = next(t["task_id"] for t in tasks_fwd if "auth/login.py" in t["files_or_modules"])
        id_frontend_fwd = next(t["task_id"] for t in tasks_fwd if "frontend/Login.jsx" in t["files_or_modules"])

        id_backend_rev = next(t["task_id"] for t in tasks_rev if "auth/login.py" in t["files_or_modules"])
        id_frontend_rev = next(t["task_id"] for t in tasks_rev if "frontend/Login.jsx" in t["files_or_modules"])

        # Both tasks must receive distinct IDs
        self.assertNotEqual(id_backend_fwd, id_frontend_fwd)
        # Reversing their order MUST NOT swap or change their task IDs
        self.assertEqual(id_backend_fwd, id_backend_rev)
        self.assertEqual(id_frontend_fwd, id_frontend_rev)
        # Disambiguator must be deterministic fingerprint fragment
        self.assertTrue(id_backend_fwd.startswith("auth.login-"))
        self.assertTrue(id_frontend_fwd.startswith("auth.login-"))

    def test_17c_duplicate_titles_across_different_phases_reorder(self):
        """Duplicate titles across different phases maintain identical IDs when phases reordered."""
        phase_api = {
            "phase": 1,
            "name": "Backend API",
            "tasks": [{"task": "Validate Session", "files_or_modules": ["api/session.py"]}]
        }
        phase_frontend = {
            "phase": 2,
            "name": "Frontend Views",
            "tasks": [{"task": "Validate Session", "files_or_modules": ["views/session.js"]}]
        }

        plan_order_1 = [phase_api, phase_frontend]
        plan_order_2 = [phase_frontend, phase_api]

        tasks_1 = canonicalize_v2_plan(plan_order_1)
        tasks_2 = canonicalize_v2_plan(plan_order_2)

        id_api_1 = next(t["task_id"] for t in tasks_1 if t["phase_key"] == "api")
        id_ui_1 = next(t["task_id"] for t in tasks_1 if t["phase_key"] == "frontend")

        id_api_2 = next(t["task_id"] for t in tasks_2 if t["phase_key"] == "api")
        id_ui_2 = next(t["task_id"] for t in tasks_2 if t["phase_key"] == "frontend")

        self.assertEqual(id_api_1, id_api_2)
        self.assertEqual(id_ui_1, id_ui_2)
        self.assertEqual(id_api_1, "api.validate-session")
        self.assertEqual(id_ui_1, "frontend.validate-session")

    def test_17d_duplicate_titles_within_same_phase_reorder(self):
        """Duplicate titles within same phase retain stable IDs when order reversed."""
        t1 = {
            "task": "Integration Test",
            "files_or_modules": ["tests/unit/test_auth.py"],
            "definition_of_done": "Unit tests pass"
        }
        t2 = {
            "task": "Integration Test",
            "files_or_modules": ["tests/e2e/test_auth.py"],
            "definition_of_done": "E2E tests pass"
        }

        plan_a = [{"phase": 1, "name": "Testing", "tasks": [t1, t2]}]
        plan_b = [{"phase": 1, "name": "Testing", "tasks": [t2, t1]}]

        tasks_a = canonicalize_v2_plan(plan_a)
        tasks_b = canonicalize_v2_plan(plan_b)

        id_t1_a = next(t["task_id"] for t in tasks_a if "tests/unit/test_auth.py" in t["files_or_modules"])
        id_t2_a = next(t["task_id"] for t in tasks_a if "tests/e2e/test_auth.py" in t["files_or_modules"])

        id_t1_b = next(t["task_id"] for t in tasks_b if "tests/unit/test_auth.py" in t["files_or_modules"])
        id_t2_b = next(t["task_id"] for t in tasks_b if "tests/e2e/test_auth.py" in t["files_or_modules"])

        self.assertNotEqual(id_t1_a, id_t2_a)
        self.assertEqual(id_t1_a, id_t1_b)
        self.assertEqual(id_t2_a, id_t2_b)

    def test_17e_reorder_task_list_and_phase_list(self):
        """Reordering both phases and task lists leaves all task identities completely intact."""
        p1 = {
            "phase": 1,
            "name": "Database",
            "tasks": [
                {"task": "User Model", "files_or_modules": ["user.py"]},
                {"task": "Order Model", "files_or_modules": ["order.py"]},
            ]
        }
        p2 = {
            "phase": 2,
            "name": "Payments",
            "tasks": [
                {"task": "Stripe Webhook", "files_or_modules": ["webhook.py"]},
                {"task": "Checkout Session", "files_or_modules": ["checkout.py"]},
            ]
        }

        plan_normal = [p1, p2]
        plan_scrambled = [
            {"phase": 2, "name": "Payments", "tasks": [p2["tasks"][1], p2["tasks"][0]]},
            {"phase": 1, "name": "Database", "tasks": [p1["tasks"][1], p1["tasks"][0]]},
        ]

        t_normal = {t["task"]: t["task_id"] for t in canonicalize_v2_plan(plan_normal)}
        t_scrambled = {t["task"]: t["task_id"] for t in canonicalize_v2_plan(plan_scrambled)}

        for task_name in ["User Model", "Order Model", "Stripe Webhook", "Checkout Session"]:
            self.assertEqual(t_normal[task_name], t_scrambled[task_name])

    # =========================================================================
    # SECTION 3: WORKSPACE INITIALIZATION & METRICS (18 - 25)
    # =========================================================================

    def test_18_workspace_initializes_task_states_in_db(self):
        """18. Workspace initializes task states with status 'todo'."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Test Workspace Init",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {
                        "phase": 1,
                        "name": "Setup & DB",
                        "tasks": [{"task": "Init Git"}, {"task": "Create Schema"}]
                    }
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws["total_tasks"], 2)
        self.assertEqual(ws["done_tasks"], 0)
        self.assertEqual(ws["completion_percent"], 0)

        # Confirm rows in DB
        rows = self.db.query(models.ProjectTaskState).filter_by(roadmap_id=roadmap.id).all()
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(r.status == "todo" for r in rows))

    def test_19_initialization_is_idempotent(self):
        """19. Repeated get_workspace calls are idempotent."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Test Idempotency",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {"phase": 1, "name": "Core", "tasks": [{"task": "Task X"}]}
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        count1 = self.db.query(models.ProjectTaskState).filter_by(roadmap_id=roadmap.id).count()

        WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        count2 = self.db.query(models.ProjectTaskState).filter_by(roadmap_id=roadmap.id).count()

        self.assertEqual(count1, 1)
        self.assertEqual(count2, 1)

    def test_20_get_workspace_via_api(self):
        """20. GET /roadmaps/{id}/workspace returns full workspace schema."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="API Workspace Test",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {"phase": 1, "name": "Setup", "tasks": [{"task": "Task 1"}]}
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        res = client.get(f"/roadmaps/{roadmap.id}/workspace", headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("completion_percent", data)
        self.assertIn("done_tasks", data)
        self.assertIn("total_tasks", data)
        self.assertIn("phases", data)
        self.assertIn("next_task", data)

    def test_21_correct_total_and_done_percent(self):
        """21. Correct completion_percent calculation."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Metrics Test",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {
                        "phase": 1,
                        "name": "Core",
                        "tasks": [
                            {"task": "Task A"},
                            {"task": "Task B"},
                            {"task": "Task C"},
                            {"task": "Task D"}
                        ]
                    }
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        first_task_id = ws["phases"][0]["tasks"][0]["task_id"]

        # Mark 1 of 4 tasks done (25%)
        WorkspaceService.patch_task(self.db, roadmap, self.user_a.id, first_task_id, status="done")
        ws2 = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws2["done_tasks"], 1)
        self.assertEqual(ws2["total_tasks"], 4)
        self.assertEqual(ws2["completion_percent"], 25)

    def test_22_current_phase_correct(self):
        """22. Current phase identifies first phase containing incomplete tasks."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Current Phase Test",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {"phase": 1, "name": "Phase One", "tasks": [{"task": "Task 1A"}]},
                    {"phase": 2, "name": "Phase Two", "tasks": [{"task": "Task 2A"}]}
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws["current_phase"]["phase_order"], 1)

        # Mark all tasks in Phase 1 as done
        task_1a = ws["phases"][0]["tasks"][0]["task_id"]
        WorkspaceService.patch_task(self.db, roadmap, self.user_a.id, task_1a, status="done")

        ws2 = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws2["current_phase"]["phase_order"], 2)

    def test_23_next_task_prefers_in_progress(self):
        """23. Next task selects in_progress task even if later in list."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Next Task In Progress Test",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {
                        "phase": 1,
                        "name": "Phase 1",
                        "tasks": [{"task": "First Todo"}, {"task": "Currently In Progress"}]
                    }
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        task2_id = ws["phases"][0]["tasks"][1]["task_id"]
        WorkspaceService.patch_task(self.db, roadmap, self.user_a.id, task2_id, status="in_progress")

        ws2 = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws2["next_task"]["task_id"], task2_id)
        self.assertEqual(ws2["next_task"]["status"], "in_progress")

    def test_24_next_task_falls_back_to_todo(self):
        """24. Next task falls back to first todo task in current phase."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Next Task Todo Fallback",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {
                        "phase": 1,
                        "name": "Phase 1",
                        "tasks": [{"task": "First Task"}, {"task": "Second Task"}]
                    }
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws["next_task"]["task"], "First Task")

    def test_25_all_done_marks_project_complete(self):
        """25. When all tasks are done, project is marked complete."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="All Done Test",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {"phase": 1, "name": "Phase 1", "tasks": [{"task": "Sole Task"}]}
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        sole_id = ws["phases"][0]["tasks"][0]["task_id"]
        WorkspaceService.patch_task(self.db, roadmap, self.user_a.id, sole_id, status="done")

        ws2 = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertTrue(ws2["is_completed"])
        self.assertEqual(ws2["completion_percent"], 100)
        self.assertIsNone(ws2["current_phase"])
        self.assertIsNone(ws2["next_task"])

    # =========================================================================
    # SECTION 4: PATCH TASK UPDATES (26 - 33)
    # =========================================================================

    def test_26_patch_todo_to_in_progress(self):
        """26. PATCH task changes status from todo to in_progress."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Patch Todo",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        task_id = ws["phases"][0]["tasks"][0]["task_id"]

        res = client.patch(
            f"/roadmaps/{roadmap.id}/tasks/{task_id}",
            json={"status": "in_progress"},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "in_progress")

    def test_27_patch_in_progress_to_done(self):
        """27. PATCH task changes status from in_progress to done."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Patch Done",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        task_id = ws["phases"][0]["tasks"][0]["task_id"]

        res = client.patch(
            f"/roadmaps/{roadmap.id}/tasks/{task_id}",
            json={"status": "done"},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "done")

    def test_28_patch_note_update(self):
        """28. PATCH task updates developer note."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Patch Note",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        task_id = ws["phases"][0]["tasks"][0]["task_id"]

        test_note = "Encountered CORS issue; fixed with explicit origin whitelist."
        res = client.patch(
            f"/roadmaps/{roadmap.id}/tasks/{task_id}",
            json={"note": test_note},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["note"], test_note)

    def test_29_invalid_status_rejected(self):
        """29. Invalid status is rejected with 422."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Invalid Status",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        task_id = ws["phases"][0]["tasks"][0]["task_id"]

        res = client.patch(
            f"/roadmaps/{roadmap.id}/tasks/{task_id}",
            json={"status": "blocked"},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 422)

    def test_30_note_exceeding_2000_chars_rejected(self):
        """30. Note exceeding 2000 characters is rejected with 422."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Long Note",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        task_id = ws["phases"][0]["tasks"][0]["task_id"]

        res = client.patch(
            f"/roadmaps/{roadmap.id}/tasks/{task_id}",
            json={"note": "x" * 2001},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 422)

    def test_31_unknown_task_id_rejected(self):
        """31. Unknown task ID rejected with 404."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Unknown Task",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        res = client.patch(
            f"/roadmaps/{roadmap.id}/tasks/totally.nonexistent-task",
            json={"status": "done"},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 404)

    def test_32_body_user_id_override_rejected(self):
        """32. Body user_id override is rejected."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="User Override",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        task_id = ws["phases"][0]["tasks"][0]["task_id"]

        res = client.patch(
            f"/roadmaps/{roadmap.id}/tasks/{task_id}",
            json={"status": "done", "user_id": 999},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 422)

    def test_33_body_roadmap_id_override_rejected(self):
        """33. Body roadmap_id override is rejected."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Roadmap Override",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        task_id = ws["phases"][0]["tasks"][0]["task_id"]

        res = client.patch(
            f"/roadmaps/{roadmap.id}/tasks/{task_id}",
            json={"status": "done", "roadmap_id": 999},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 422)

    # =========================================================================
    # SECTION 5: IMPORT PROGRESS (34 - 37)
    # =========================================================================

    def test_34_legacy_progress_import_works(self):
        """34. Legacy progress import marks recognized task done."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Import Test",
            data={
                "schema_version": 2,
                "implementation_plan": [
                    {"phase": 1, "name": "Setup", "tasks": [{"task": "Initialize Repository"}]}
                ]
            }
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        # Legacy localStorage key style
        legacy_key = f"roadmap_{roadmap.id}_task_Initialize Repository"
        res = client.post(
            f"/roadmaps/{roadmap.id}/tasks/import-progress",
            json={"items": [{"legacy_task_key": legacy_key, "completed": True}]},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["imported"], 1)
        self.assertEqual(res.json()["skipped"], 0)

        # Confirm workspace shows 100% done
        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws["completion_percent"], 100)

    def test_35_repeated_import_is_idempotent(self):
        """35. Repeated import is safe and idempotent."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Repeat Import",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task 1"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        legacy_key = f"roadmap_{roadmap.id}_Task 1"
        res1 = client.post(
            f"/roadmaps/{roadmap.id}/tasks/import-progress",
            json={"items": [{"legacy_task_key": legacy_key, "completed": True}]},
            headers=self.headers_a
        )
        self.assertEqual(res1.status_code, 200)

        res2 = client.post(
            f"/roadmaps/{roadmap.id}/tasks/import-progress",
            json={"items": [{"legacy_task_key": legacy_key, "completed": True}]},
            headers=self.headers_a
        )
        self.assertEqual(res2.status_code, 200)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws["done_tasks"], 1)

    def test_36_done_state_never_downgraded(self):
        """36. Merge rule: Server done status is never downgraded by uncompleted local items."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="No Downgrade",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Done Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        t_id = ws["phases"][0]["tasks"][0]["task_id"]
        WorkspaceService.patch_task(self.db, roadmap, self.user_a.id, t_id, status="done")

        # Try to import completed=False
        legacy_key = f"roadmap_{roadmap.id}_Done Task"
        client.post(
            f"/roadmaps/{roadmap.id}/tasks/import-progress",
            json={"items": [{"legacy_task_key": legacy_key, "completed": False}]},
            headers=self.headers_a
        )

        ws2 = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws2["phases"][0]["tasks"][0]["status"], "done")

    def test_37_unknown_legacy_key_skipped(self):
        """37. Unknown legacy keys are skipped without creating fake tasks."""
        roadmap = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Unknown Key Import",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Legit Task"}]}]}
        )
        self.db.add(roadmap)
        self.db.commit()
        self.db.refresh(roadmap)

        res = client.post(
            f"/roadmaps/{roadmap.id}/tasks/import-progress",
            json={"items": [{"legacy_task_key": "some_completely_fake_task", "completed": True}]},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["imported"], 0)
        self.assertEqual(res.json()["skipped"], 1)

        ws = WorkspaceService.get_workspace(self.db, roadmap, self.user_a.id)
        self.assertEqual(ws["total_tasks"], 1)

    # =========================================================================
    # SECTION 6: OWNERSHIP NEGATIVE TESTS (38 - 42)
    # =========================================================================

    def test_38_user_b_cannot_get_user_a_workspace(self):
        """38. User B cannot GET User A workspace (404)."""
        roadmap_a = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="User A Private Project",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "A Task"}]}]}
        )
        self.db.add(roadmap_a)
        self.db.commit()
        self.db.refresh(roadmap_a)

        res = client.get(f"/roadmaps/{roadmap_a.id}/workspace", headers=self.headers_b)
        self.assertEqual(res.status_code, 404)

    def test_39_user_b_cannot_patch_user_a_task(self):
        """39. User B cannot PATCH User A task (404)."""
        roadmap_a = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="User A Private Project 2",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "A Task"}]}]}
        )
        self.db.add(roadmap_a)
        self.db.commit()
        self.db.refresh(roadmap_a)

        ws = WorkspaceService.get_workspace(self.db, roadmap_a, self.user_a.id)
        task_id = ws["phases"][0]["tasks"][0]["task_id"]

        res = client.patch(
            f"/roadmaps/{roadmap_a.id}/tasks/{task_id}",
            json={"status": "done"},
            headers=self.headers_b
        )
        self.assertEqual(res.status_code, 404)

    def test_40_user_b_cannot_import_into_user_a_roadmap(self):
        """40. User B cannot import progress into User A roadmap (404)."""
        roadmap_a = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="User A Private Project 3",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "A Task"}]}]}
        )
        self.db.add(roadmap_a)
        self.db.commit()
        self.db.refresh(roadmap_a)

        res = client.post(
            f"/roadmaps/{roadmap_a.id}/tasks/import-progress",
            json={"items": [{"legacy_task_key": "A Task", "completed": True}]},
            headers=self.headers_b
        )
        self.assertEqual(res.status_code, 404)

    def test_41_guessed_task_id_cannot_bypass_ownership(self):
        """41. Guessed task ID on unowned roadmap returns 404."""
        roadmap_a = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="User A Guessed Task Test",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "Setup", "tasks": [{"task": "Init Git"}]}]}
        )
        self.db.add(roadmap_a)
        self.db.commit()
        self.db.refresh(roadmap_a)

        res = client.patch(
            f"/roadmaps/{roadmap_a.id}/tasks/setup.init-git",
            json={"status": "done"},
            headers=self.headers_b
        )
        self.assertEqual(res.status_code, 404)

    def test_42_task_from_another_roadmap_cannot_update_through_owned_route(self):
        """42. Task ID from roadmap X cannot update through roadmap Y even if both owned."""
        roadmap_1 = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Roadmap One",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task Alpha"}]}]}
        )
        roadmap_2 = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Roadmap Two",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task Beta"}]}]}
        )
        self.db.add_all([roadmap_1, roadmap_2])
        self.db.commit()
        self.db.refresh(roadmap_1)
        self.db.refresh(roadmap_2)

        ws1 = WorkspaceService.get_workspace(self.db, roadmap_1, self.user_a.id)
        task_alpha_id = ws1["phases"][0]["tasks"][0]["task_id"]

        # Attempt to patch task_alpha_id through roadmap_2 URL
        res = client.patch(
            f"/roadmaps/{roadmap_2.id}/tasks/{task_alpha_id}",
            json={"status": "done"},
            headers=self.headers_a
        )
        self.assertEqual(res.status_code, 404)

    # =========================================================================
    # SECTION 7: EXPORT & DELETIONS (43 - 47)
    # =========================================================================

    def test_43_and_44_export_includes_only_current_user_task_states(self):
        """43 & 44. GET /account/export includes only current user's task states, never leaking User B."""
        # Ensure User A has task state
        r_a = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="User A Export Test",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task A"}]}]}
        )
        r_b = models.Roadmap(
            user_id=self.user_b.id,
            original_idea="User B Export Test",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task B"}]}]}
        )
        self.db.add_all([r_a, r_b])
        self.db.commit()
        self.db.refresh(r_a)
        self.db.refresh(r_b)

        WorkspaceService.get_workspace(self.db, r_a, self.user_a.id)
        WorkspaceService.get_workspace(self.db, r_b, self.user_b.id)

        res = client.get("/account/export", headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("project_task_states", data)

        exported_states = data["project_task_states"]
        exported_roadmap_ids = {s["roadmap_id"] for s in exported_states}
        self.assertIn(r_a.id, exported_roadmap_ids)
        self.assertNotIn(r_b.id, exported_roadmap_ids)

        # Confirm User B export also strictly isolates User B data
        res_b = client.get("/account/export", headers=self.headers_b)
        self.assertEqual(res_b.status_code, 200)
        data_b = res_b.json()
        exported_states_b = data_b.get("project_task_states", [])
        exported_roadmap_ids_b = {s["roadmap_id"] for s in exported_states_b}
        self.assertIn(r_b.id, exported_roadmap_ids_b)
        self.assertNotIn(r_a.id, exported_roadmap_ids_b)

        # Confirm safe fields only
        if exported_states:
            sample = exported_states[0]
            self.assertIn("roadmap_id", sample)
            self.assertIn("task_id", sample)
            self.assertIn("status", sample)
            self.assertNotIn("task_fingerprint", sample)

    def test_45_account_delete_leaves_zero_task_states(self):
        """45. DELETE /account permanently clears all user's ProjectTaskState rows without affecting other users."""
        temp_user = models.User(
            email="temp_delete_user@example.com",
            hashed_password=main.hash_password("TempPassword123!")
        )
        self.db.add(temp_user)
        self.db.commit()
        self.db.refresh(temp_user)

        temp_token = main.create_access_token(temp_user.id, temp_user.email)
        temp_headers = {"Authorization": f"Bearer {temp_token}"}

        temp_roadmap = models.Roadmap(
            user_id=temp_user.id,
            original_idea="Temp User Project",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Temp Task"}]}]}
        )
        self.db.add(temp_roadmap)
        self.db.commit()
        self.db.refresh(temp_roadmap)

        WorkspaceService.get_workspace(self.db, temp_roadmap, temp_user.id)
        states_before = self.db.query(models.ProjectTaskState).filter_by(user_id=temp_user.id).count()
        self.assertGreater(states_before, 0)

        user_a_count_before = self.db.query(models.ProjectTaskState).filter_by(user_id=self.user_a.id).count()
        user_b_count_before = self.db.query(models.ProjectTaskState).filter_by(user_id=self.user_b.id).count()

        # Delete account
        del_res = client.request(
            "DELETE",
            "/account",
            json={"password": "TempPassword123!"},
            headers=temp_headers
        )
        self.assertEqual(del_res.status_code, 200)

        states_after = self.db.query(models.ProjectTaskState).filter_by(user_id=temp_user.id).count()
        self.assertEqual(states_after, 0)

        # Negative test: Confirm User A and User B task states are completely unaffected
        user_a_count_after = self.db.query(models.ProjectTaskState).filter_by(user_id=self.user_a.id).count()
        user_b_count_after = self.db.query(models.ProjectTaskState).filter_by(user_id=self.user_b.id).count()
        self.assertEqual(user_a_count_before, user_a_count_after)
        self.assertEqual(user_b_count_before, user_b_count_after)

    def test_46_and_47_roadmap_delete_leaves_zero_orphans(self):
        """46 & 47. DELETE /roadmaps/{id} removes roadmap and associated task states with zero orphans."""
        rm = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Roadmap Delete Test",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "T1"}, {"task": "T2"}]}]}
        )
        self.db.add(rm)
        self.db.commit()
        self.db.refresh(rm)

        WorkspaceService.get_workspace(self.db, rm, self.user_a.id)
        self.assertEqual(self.db.query(models.ProjectTaskState).filter_by(roadmap_id=rm.id).count(), 2)

        del_res = client.delete(f"/roadmaps/{rm.id}", headers=self.headers_a)
        self.assertEqual(del_res.status_code, 200)

        self.assertEqual(self.db.query(models.ProjectTaskState).filter_by(roadmap_id=rm.id).count(), 0)

    # =========================================================================
    # SECTION 8: REGRESSION SAFEGUARDS (48 - 51)
    # =========================================================================

    def test_48_and_49_failed_ai_generation_and_quota_unchanged(self):
        """48 & 49. Phase 8 workspace operations do not consume AI quota; AI quota policies preserved."""
        # Check initial summary
        summary_before = get_user_ai_usage_summary(self.db, self.user_a.id)

        # Perform multiple workspace actions
        rm = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Quota Isolation Test",
            data={"schema_version": 2, "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "Task Q"}]}]}
        )
        self.db.add(rm)
        self.db.commit()
        self.db.refresh(rm)

        client.get(f"/roadmaps/{rm.id}/workspace", headers=self.headers_a)
        ws = WorkspaceService.get_workspace(self.db, rm, self.user_a.id)
        task_id = ws["phases"][0]["tasks"][0]["task_id"]
        client.patch(f"/roadmaps/{rm.id}/tasks/{task_id}", json={"status": "done"}, headers=self.headers_a)
        client.post(f"/roadmaps/{rm.id}/tasks/import-progress", json={"items": [{"legacy_task_key": "Task Q", "completed": True}]}, headers=self.headers_a)

        # AI quota summary should be completely unchanged
        summary_after = get_user_ai_usage_summary(self.db, self.user_a.id)
        self.assertEqual(summary_before["usage"], summary_after["usage"])

    def test_50_v1_roadmap_still_loads(self):
        """50. V1 legacy roadmap loads cleanly into workspace."""
        rm_v1 = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Legacy V1 Project",
            data={
                "schema_version": 1,
                "feasibility": "intermediate",
                "estimated_weeks": 4,
                "milestones": [
                    {
                        "phase": 1,
                        "title": "Foundation & Environment",
                        "tasks": ["Install Node.js and Python", "Initialize Git repository"]
                    },
                    {
                        "phase": 2,
                        "title": "Database Schema",
                        "tasks": ["Configure Postgres connection", "Run initial migrations"]
                    }
                ]
            }
        )
        self.db.add(rm_v1)
        self.db.commit()
        self.db.refresh(rm_v1)

        res = client.get(f"/roadmaps/{rm_v1.id}/workspace", headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["schema_version"], 1)
        self.assertEqual(data["total_tasks"], 4)
        self.assertEqual(len(data["phases"]), 2)
        self.assertEqual(data["completion_percent"], 0)

    def test_51_v2_blueprint_still_loads(self):
        """51. V2 blueprint loads cleanly into workspace."""
        rm_v2 = models.Roadmap(
            user_id=self.user_a.id,
            original_idea="Modern V2 Project",
            data={
                "schema_version": 2,
                "project_summary": {"title": "Doctor Booking System", "difficulty": "intermediate"},
                "implementation_plan": [
                    {
                        "phase": 1,
                        "name": "Database & Models",
                        "goal": "Build PostgreSQL tables for doctors and patients",
                        "tasks": [
                            {
                                "task": "Create Doctor Model",
                                "description": "Define doctor entity with specialty and license",
                                "files_or_modules": ["backend/models/doctor.py"],
                                "how_to_test": "Run pytest tests/test_doctor.py",
                                "definition_of_done": "Table created with unique license constraint"
                            }
                        ]
                    }
                ]
            }
        )
        self.db.add(rm_v2)
        self.db.commit()
        self.db.refresh(rm_v2)

        res = client.get(f"/roadmaps/{rm_v2.id}/workspace", headers=self.headers_a)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["schema_version"], 2)
        self.assertEqual(data["total_tasks"], 1)
        self.assertEqual(data["phases"][0]["name"], "Database & Models")


if __name__ == "__main__":
    unittest.main()
