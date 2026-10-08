"""
workspace_service.py

Service layer for IdeaForge Project Workspace & Persistent Execution.
Handles canonical task extraction, idempotent state persistence,
completion metrics, current phase / next task calculation, and progress imports.
"""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional, Tuple, Set

from sqlalchemy.orm import Session
try:
    import models
    from services.task_identity import (
        canonicalize_v2_plan,
        canonicalize_v1_milestones,
        normalize_task_text,
        derive_phase_key,
        reconcile_tasks,
    )
except ImportError:
    from backend import models
    from backend.services.task_identity import (
        canonicalize_v2_plan,
        canonicalize_v1_milestones,
        normalize_task_text,
        derive_phase_key,
        reconcile_tasks,
    )

logger = logging.getLogger("ideaforge.workspace")


class WorkspaceService:
    @staticmethod
    def extract_canonical_tasks(
        roadmap_data: Dict[str, Any]
    ) -> Tuple[int, List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Extracts canonical tasks and phase structures from a roadmap data dictionary.
        Returns:
            (schema_version, canonical_tasks, phases_structure)
        """
        data = roadmap_data if isinstance(roadmap_data, dict) else {}
        inner = data.get("data") if isinstance(data.get("data"), dict) else data

        schema_version = inner.get("schema_version", 1)
        if isinstance(schema_version, str):
            try:
                schema_version = int(schema_version)
            except ValueError:
                schema_version = 1

        implementation_plan = inner.get("implementation_plan")
        milestones = inner.get("milestones")

        # Prioritize implementation_plan (V2)
        if isinstance(implementation_plan, list) and len(implementation_plan) > 0:
            tasks = canonicalize_v2_plan(implementation_plan)
            # Reconstruct phase summaries
            phases = []
            for p_idx, p in enumerate(implementation_plan):
                if not isinstance(p, dict):
                    continue
                p_name = p.get("name") or p.get("phase") or f"Phase {p_idx + 1}"
                p_num = p.get("phase", p_idx + 1)
                p_key = derive_phase_key(str(p_name), p_num)
                p_goal = p.get("goal") or ""
                phases.append({
                    "phase_order": p_idx + 1,
                    "phase_key": p_key,
                    "name": str(p_name),
                    "goal": p_goal,
                })
            return 2, tasks, phases

        # Fallback to milestones (V1)
        if isinstance(milestones, list) and len(milestones) > 0:
            tasks = canonicalize_v1_milestones(milestones)
            phases = []
            for m_idx, m in enumerate(milestones):
                if not isinstance(m, dict):
                    continue
                p_name = m.get("title") or m.get("name") or f"Milestone {m_idx + 1}"
                p_key = f"phase-{m_idx + 1}"
                phases.append({
                    "phase_order": m_idx + 1,
                    "phase_key": p_key,
                    "name": str(p_name),
                    "goal": "",
                })
            return 1, tasks, phases

        return schema_version, [], []

    @classmethod
    def sync_task_states_idempotently(
        cls,
        db: Session,
        user_id: int,
        roadmap_id: int,
        canonical_tasks: List[Dict[str, Any]],
        schema_version: int = 2
    ) -> Dict[str, models.ProjectTaskState]:
        """
        Synchronizes database ProjectTaskState rows with the canonical tasks.
        Initializes missing rows with status='todo' without altering existing progress.
        """
        existing_rows = (
            db.query(models.ProjectTaskState)
            .filter(
                models.ProjectTaskState.user_id == user_id,
                models.ProjectTaskState.roadmap_id == roadmap_id,
            )
            .all()
        )
        existing_by_id = {row.task_id: row for row in existing_rows}
        new_states = []

        for task in canonical_tasks:
            t_id = task["task_id"]
            if t_id not in existing_by_id:
                state = models.ProjectTaskState(
                    user_id=user_id,
                    roadmap_id=roadmap_id,
                    task_id=t_id,
                    task_fingerprint=task.get("task_fingerprint", ""),
                    phase_key=task.get("phase_key"),
                    task_order=task.get("task_order", 0),
                    status="todo",
                    note=None,
                    source_schema=schema_version,
                )
                db.add(state)
                new_states.append(state)
                existing_by_id[t_id] = state
            else:
                # Update task_order / phase_key if changed, preserve status and note
                row = existing_by_id[t_id]
                updated = False
                if row.task_order != task.get("task_order", 0):
                    row.task_order = task.get("task_order", 0)
                    updated = True
                if task.get("phase_key") and row.phase_key != task.get("phase_key"):
                    row.phase_key = task.get("phase_key")
                    updated = True
                if updated:
                    db.add(row)

        if new_states:
            db.commit()
            for s in new_states:
                db.refresh(s)

        return existing_by_id

    @classmethod
    def get_workspace(
        cls,
        db: Session,
        roadmap: models.Roadmap,
        user_id: int
    ) -> Dict[str, Any]:
        """
        Constructs the comprehensive workspace view for a given roadmap and user.
        Calculates metrics, determines current phase and next task.
        """
        data_dict = roadmap.data if isinstance(roadmap.data, dict) else {}
        schema_version, canonical_tasks, phase_defs = cls.extract_canonical_tasks(data_dict)

        states_map = cls.sync_task_states_idempotently(
            db, user_id, roadmap.id, canonical_tasks, schema_version
        )

        # Merge states into canonical tasks
        enhanced_tasks = []
        for task in canonical_tasks:
            t_id = task["task_id"]
            state = states_map.get(t_id)
            enhanced = dict(task)
            enhanced["status"] = state.status if state else "todo"
            enhanced["note"] = state.note if state else None
            enhanced["updated_at"] = (
                state.updated_at.isoformat() if state and state.updated_at else None
            )
            enhanced_tasks.append(enhanced)

        # Group tasks by phase
        phases_by_key = {}
        for p in phase_defs:
            p_key = p["phase_key"]
            phases_by_key[p_key] = {
                "phase_order": p["phase_order"],
                "phase_key": p_key,
                "name": p["name"],
                "goal": p["goal"],
                "tasks": [],
                "total_tasks": 0,
                "done_tasks": 0,
                "completion_percent": 0,
            }

        # Fallback if phases were empty but tasks exist
        for task in enhanced_tasks:
            p_key = task.get("phase_key") or "general"
            if p_key not in phases_by_key:
                phases_by_key[p_key] = {
                    "phase_order": task.get("phase_order", 1),
                    "phase_key": p_key,
                    "name": task.get("phase_name") or f"Phase {p_key}",
                    "goal": "",
                    "tasks": [],
                    "total_tasks": 0,
                    "done_tasks": 0,
                    "completion_percent": 0,
                }
            phases_by_key[p_key]["tasks"].append(task)
            phases_by_key[p_key]["total_tasks"] += 1
            if task["status"] == "done":
                phases_by_key[p_key]["done_tasks"] += 1

        ordered_phases = sorted(phases_by_key.values(), key=lambda p: p["phase_order"])
        for p in ordered_phases:
            if p["total_tasks"] > 0:
                p["completion_percent"] = round((p["done_tasks"] / p["total_tasks"]) * 100)

        total_tasks = len(enhanced_tasks)
        done_tasks = sum(1 for t in enhanced_tasks if t["status"] == "done")
        completion_percent = (
            round((done_tasks / total_tasks) * 100) if total_tasks > 0 else 0
        )
        is_completed = (total_tasks > 0 and done_tasks == total_tasks)

        # Determine current phase: first phase containing any task not done
        current_phase = None
        if not is_completed:
            for p in ordered_phases:
                if any(t["status"] != "done" for t in p["tasks"]):
                    current_phase = {
                        "phase_order": p["phase_order"],
                        "phase_key": p["phase_key"],
                        "name": p["name"],
                        "goal": p["goal"],
                        "done_tasks": p["done_tasks"],
                        "total_tasks": p["total_tasks"],
                        "completion_percent": p["completion_percent"],
                    }
                    break

        # Determine next task:
        # First in_progress task if one exists anywhere in the project
        # Otherwise first todo task in current phase
        next_task = None
        if not is_completed:
            for t in enhanced_tasks:
                if t["status"] == "in_progress":
                    next_task = t
                    break

            if not next_task and current_phase:
                curr_tasks = phases_by_key.get(current_phase["phase_key"], {}).get("tasks", [])
                for t in curr_tasks:
                    if t["status"] == "todo":
                        next_task = t
                        break

            # Fallback to first non-done task in current phase if all are neither
            if not next_task and current_phase:
                curr_tasks = phases_by_key.get(current_phase["phase_key"], {}).get("tasks", [])
                for t in curr_tasks:
                    if t["status"] != "done":
                        next_task = t
                        break

        return {
            "roadmap_id": roadmap.id,
            "schema_version": schema_version,
            "completion_percent": completion_percent,
            "done_tasks": done_tasks,
            "total_tasks": total_tasks,
            "is_completed": is_completed,
            "current_phase": current_phase,
            "next_task": next_task,
            "phases": ordered_phases,
        }

    @classmethod
    def patch_task(
        cls,
        db: Session,
        roadmap: models.Roadmap,
        user_id: int,
        task_id: str,
        status: Optional[str] = None,
        note: Optional[str] = None
    ) -> models.ProjectTaskState:
        """
        Updates the status and/or note of a canonical task state for a user's roadmap.
        Raises ValueError if task_id does not exist in the canonical blueprint.
        """
        data_dict = roadmap.data if isinstance(roadmap.data, dict) else {}
        schema_version, canonical_tasks, _ = cls.extract_canonical_tasks(data_dict)

        canonical_by_id = {t["task_id"]: t for t in canonical_tasks}
        if task_id not in canonical_by_id:
            raise KeyError(f"Task '{task_id}' not found in canonical roadmap tasks.")

        task_info = canonical_by_id[task_id]

        row = (
            db.query(models.ProjectTaskState)
            .filter(
                models.ProjectTaskState.user_id == user_id,
                models.ProjectTaskState.roadmap_id == roadmap.id,
                models.ProjectTaskState.task_id == task_id,
            )
            .first()
        )

        now = datetime.now(timezone.utc)
        if not row:
            row = models.ProjectTaskState(
                user_id=user_id,
                roadmap_id=roadmap.id,
                task_id=task_id,
                task_fingerprint=task_info.get("task_fingerprint", ""),
                phase_key=task_info.get("phase_key"),
                task_order=task_info.get("task_order", 0),
                status=status if status else "todo",
                note=note,
                source_schema=schema_version,
                created_at=now,
                updated_at=now,
            )
            db.add(row)
        else:
            if status is not None:
                row.status = status
            if note is not None:
                row.note = note
            row.updated_at = now
            db.add(row)

        db.commit()
        db.refresh(row)
        return row

    @classmethod
    def import_legacy_progress(
        cls,
        db: Session,
        roadmap: models.Roadmap,
        user_id: int,
        items: List[Dict[str, Any]]
    ) -> Dict[str, int]:
        """
        Conservatively imports progress from legacy localStorage items.
        Matches keys to canonical tasks:
        1. Exact task_id match
        2. Exact normalized task text match
        3. Phase + normalized task text match
        Never downgrades server 'done' status.
        Never inserts fake or unknown tasks.
        """
        data_dict = roadmap.data if isinstance(roadmap.data, dict) else {}
        schema_version, canonical_tasks, _ = cls.extract_canonical_tasks(data_dict)

        states_map = cls.sync_task_states_idempotently(
            db, user_id, roadmap.id, canonical_tasks, schema_version
        )

        # Lookup structures
        by_id = {t["task_id"]: t for t in canonical_tasks}
        by_norm_title = {}
        by_phase_and_title = {}

        for t in canonical_tasks:
            title = t.get("task") or t.get("title") or ""
            norm = normalize_task_text(title)
            by_norm_title[norm] = t
            p_key = t.get("phase_key") or ""
            by_phase_and_title[f"{p_key}:{norm}"] = t

        imported_count = 0
        skipped_count = 0
        now = datetime.now(timezone.utc)

        for item in items:
            if not isinstance(item, dict):
                skipped_count += 1
                continue

            raw_key = str(item.get("legacy_task_key") or "").strip()
            is_completed = bool(item.get("completed"))

            if not raw_key or not is_completed:
                skipped_count += 1
                continue

            # Strip localStorage prefix if present: "roadmap_42_task_Foo" or "roadmap_42_Foo"
            key_clean = raw_key
            if key_clean.startswith("roadmap_"):
                parts = key_clean.split("_")
                if len(parts) >= 4 and parts[2] == "task":
                    key_clean = "_".join(parts[3:])
                elif len(parts) >= 3:
                    key_clean = "_".join(parts[2:])

            matched_task = None
            # 1. Exact task_id match
            if key_clean in by_id:
                matched_task = by_id[key_clean]
            elif raw_key in by_id:
                matched_task = by_id[raw_key]

            # 2. Normalized title match
            if not matched_task:
                norm_key = normalize_task_text(key_clean)
                if norm_key in by_norm_title:
                    matched_task = by_norm_title[norm_key]

            # 3. Phase + title match if colon or dot in key
            if not matched_task and (":" in key_clean or "." in key_clean):
                delimiter = ":" if ":" in key_clean else "."
                parts = key_clean.split(delimiter, 1)
                p_part = parts[0].strip().lower()
                t_part = normalize_task_text(parts[1])
                combo = f"{p_part}:{t_part}"
                if combo in by_phase_and_title:
                    matched_task = by_phase_and_title[combo]

            if not matched_task:
                skipped_count += 1
                continue

            target_id = matched_task["task_id"]
            state = states_map.get(target_id)
            if state:
                # Merge rule: Never downgrade server done
                if state.status != "done":
                    state.status = "done"
                    state.updated_at = now
                    db.add(state)
                imported_count += 1
            else:
                skipped_count += 1

        db.commit()
        return {"imported": imported_count, "skipped": skipped_count}

    @classmethod
    def reconcile_and_embed_v2_plan(
        cls,
        old_roadmap_data: Dict[str, Any],
        new_plan: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Reconciles new implementation_plan against existing blueprint tasks,
        retaining stable task_id values where tasks match.
        """
        if not isinstance(new_plan, list):
            return new_plan

        _, old_tasks, _ = cls.extract_canonical_tasks(old_roadmap_data)
        new_flattened = []
        for phase_idx, phase in enumerate(new_plan):
            if not isinstance(phase, dict):
                continue
            p_name = phase.get("name") or phase.get("phase") or f"Phase {phase_idx + 1}"
            p_num = phase.get("phase", phase_idx + 1)
            p_key = derive_phase_key(str(p_name), p_num)
            for t in (phase.get("tasks") or []):
                if isinstance(t, dict):
                    t_copy = dict(t)
                    t_copy["phase_key"] = p_key
                    new_flattened.append(t_copy)
                elif isinstance(t, str):
                    new_flattened.append({"task": t, "phase_key": p_key})

        reconciled = reconcile_tasks(old_tasks, new_flattened)
        rec_by_title_and_phase = {}
        for r in reconciled:
            key = f"{r.get('phase_key')}:{normalize_task_text(r.get('task') or '')}"
            rec_by_title_and_phase[key] = r

        embedded_plan = []
        for phase_idx, phase in enumerate(new_plan):
            if not isinstance(phase, dict):
                embedded_plan.append(phase)
                continue
            phase_copy = dict(phase)
            p_name = phase_copy.get("name") or phase_copy.get("phase") or f"Phase {phase_idx + 1}"
            p_num = phase_copy.get("phase", phase_idx + 1)
            p_key = derive_phase_key(str(p_name), p_num)
            updated_tasks = []
            for t in (phase_copy.get("tasks") or []):
                if isinstance(t, dict):
                    t_dict = dict(t)
                    title = t_dict.get("task") or t_dict.get("title") or ""
                    key = f"{p_key}:{normalize_task_text(title)}"
                    match = rec_by_title_and_phase.get(key)
                    if match:
                        t_dict["task_id"] = match["task_id"]
                        t_dict["task_fingerprint"] = match["task_fingerprint"]
                    updated_tasks.append(t_dict)
                elif isinstance(t, str):
                    key = f"{p_key}:{normalize_task_text(t)}"
                    match = rec_by_title_and_phase.get(key)
                    updated_tasks.append({
                        "task": t,
                        "task_id": match["task_id"] if match else None,
                        "task_fingerprint": match["task_fingerprint"] if match else None,
                    })
                else:
                    updated_tasks.append(t)
            phase_copy["tasks"] = updated_tasks
            embedded_plan.append(phase_copy)

        return embedded_plan
