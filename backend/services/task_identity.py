"""
task_identity.py

Stable Task Identity and Reconciliation Layer for IdeaForge.
Ensures durable task identities across blueprint regeneration and schema versions.
"""

import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple, Set


COMMON_PHASE_KEYWORDS: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\b(setup|init|scaffold|foundation|bootstrap|environment|repo|repository)\b", re.I), "setup"),
    (re.compile(r"\b(db|database|schema|migration|models?|postgres|sql|prisma|entity|entities)\b", re.I), "database"),
    (re.compile(r"\b(auth|authentication|authorization|login|signup|jwt|session|user\s*management|security)\b", re.I), "auth"),
    (re.compile(r"\b(appointment|appointments|booking|bookings)\b", re.I), "appointments"),
    (re.compile(r"\b(payment|payments|billing|subscription|stripe)\b", re.I), "payments"),
    (re.compile(r"\b(notification|notifications|email|sms)\b", re.I), "notifications"),
    (re.compile(r"\b(api|backend|endpoint|endpoints|controller|controllers|routes?|service|services|server)\b", re.I), "api"),
    (re.compile(r"\b(ui|frontend|component|components|client|pages?|views?|interface|dashboard)\b", re.I), "frontend"),
    (re.compile(r"\b(test|tests|testing|qa|unit\s*test|integration|cypress|jest|pytest)\b", re.I), "testing"),
    (re.compile(r"\b(deploy|deployment|devops|docker|render|vercel|cloud|ci|cd|pipeline|production)\b", re.I), "deployment"),
]

STOPWORDS: Set[str] = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with",
    "by", "from", "up", "about", "into", "over", "after", "is", "are", "was",
    "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "create", "build", "implement", "add", "set", "configure", "make", "write",
    "setup", "develop"
}


def slugify(text: str, max_words: int = 4) -> str:
    """Normalize text into a compact, kebab-case slug."""
    if not text:
        return "task"
    cleaned = re.sub(r"[^\w\s-]", " ", text.lower()).strip()
    words = [w for w in cleaned.split() if w]
    meaningful = [w for w in words if w not in STOPWORDS]
    selected = meaningful if meaningful else words
    slug = "-".join(selected[:max_words])
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "task"


def derive_phase_key(phase_name: str, phase_number: Optional[Any] = None) -> str:
    """
    Derives a semantic phase key from the phase name.
    Falls back to a normalized slug or phase number prefix if no keyword matches.
    """
    name = (phase_name or "").strip()
    for pattern, key in COMMON_PHASE_KEYWORDS:
        if pattern.search(name):
            return key

    slug = slugify(name, max_words=3)
    if slug and slug != "task":
        return slug

    if phase_number is not None:
        return f"phase-{phase_number}"
    return "general"


def compute_task_fingerprint(
    phase_key: str,
    task_title: str,
    files_or_modules: Optional[List[str]] = None,
    definition_of_done: Optional[str] = None,
    description: Optional[str] = None
) -> str:
    """
    Derives a deterministic, internal-only SHA256 fingerprint for a task.
    Fingerprint captures core semantic identity without relying on formatting.
    """
    norm_phase = (phase_key or "").strip().lower()
    norm_title = re.sub(r"[^\w\s]", "", (task_title or "").strip().lower())
    norm_title = " ".join(norm_title.split())

    norm_files = sorted(
        [re.sub(r"[^\w\./_-]", "", f.strip().lower()) for f in (files_or_modules or []) if f.strip()]
    )
    files_str = ",".join(norm_files)
    norm_dod = re.sub(r"[^\w\s]", "", (definition_of_done or "").strip().lower())[:100]
    norm_desc = re.sub(r"[^\w\s]", "", (description or "").strip().lower())[:100]

    raw = f"{norm_phase}|{norm_title}|{files_str}|{norm_dod}|{norm_desc}" if norm_desc else f"{norm_phase}|{norm_title}|{files_str}|{norm_dod}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def generate_v2_task_id(
    phase_key: str,
    task_title: str,
    existing_ids_in_blueprint: Optional[Set[str]] = None,
    disambiguator: Optional[str] = None
) -> str:
    """
    Generates a semantic task ID in the style of:
    setup.repository-init
    database.user-model
    auth.jwt-login
    testing.auth-integration
    """
    norm_phase = (phase_key or "general").strip().lower()
    task_slug = slugify(task_title, max_words=4)
    base_id = f"{norm_phase}.{task_slug}"

    if existing_ids_in_blueprint is None:
        if disambiguator:
            frag = str(disambiguator).strip().lower()
            return f"{base_id}-{frag[:4]}" if len(frag) >= 4 else f"{base_id}-{frag}"
        return base_id

    if base_id not in existing_ids_in_blueprint and not disambiguator:
        return base_id

    if disambiguator:
        frag = str(disambiguator).strip().lower()
        cand = f"{base_id}-{frag[:4]}" if len(frag) >= 4 else f"{base_id}-{frag}"
        if cand not in existing_ids_in_blueprint:
            return cand
        if len(frag) >= 8:
            cand = f"{base_id}-{frag[:8]}"
            if cand not in existing_ids_in_blueprint:
                return cand

    counter = 2
    candidate = f"{base_id}-{counter}"
    while candidate in existing_ids_in_blueprint:
        counter += 1
        candidate = f"{base_id}-{counter}"

    return candidate


def generate_v1_task_id(
    milestone_index: int,
    milestone_title: str,
    task_text: str,
    existing_ids_in_blueprint: Optional[Set[str]] = None,
    disambiguator: Optional[str] = None
) -> str:
    """
    Generates deterministic legacy task ID for V1 roadmaps:
    v1.phase-1.create-login
    """
    phase_slug = f"phase-{milestone_index + 1}"
    task_slug = slugify(task_text, max_words=4)
    base_id = f"v1.{phase_slug}.{task_slug}"

    if existing_ids_in_blueprint is None:
        if disambiguator:
            frag = str(disambiguator).strip().lower()
            return f"{base_id}-{frag[:4]}" if len(frag) >= 4 else f"{base_id}-{frag}"
        return base_id

    if base_id not in existing_ids_in_blueprint and not disambiguator:
        return base_id

    if disambiguator:
        frag = str(disambiguator).strip().lower()
        cand = f"{base_id}-{frag[:4]}" if len(frag) >= 4 else f"{base_id}-{frag}"
        if cand not in existing_ids_in_blueprint:
            return cand

    counter = 2
    candidate = f"{base_id}-{counter}"
    while candidate in existing_ids_in_blueprint:
        counter += 1
        candidate = f"{base_id}-{counter}"

    return candidate


def normalize_task_text(text: str) -> str:
    """Strips punctuation and extra spaces, lowercase."""
    return re.sub(r"[^\w\s]", "", (text or "").lower()).strip()


def assign_v2_plan_identities(implementation_plan: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Assigns deterministic, order-independent task IDs and fingerprints to a V2 implementation_plan.
    Preserves the nested list-of-phases structure.
    
    Disambiguation rules:
    - Unique base IDs receive clean format: '{phase_key}.{slug}'
    - Duplicate base IDs are deterministically disambiguated using the task's fingerprint fragment:
      '{base_id}-{fingerprint[:4]}' (e.g. auth.login-a31f, auth.login-9b82)
    - Reordering phases or tasks retains exact task identity.
    - Truly semantically indistinguishable tasks fall back to positional suffixes.
    """
    if not isinstance(implementation_plan, list):
        return []

    # Pass 1: Parse tasks and count base IDs
    phase_meta = []
    base_id_counts: Dict[str, int] = {}
    explicit_ids: Set[str] = set()

    for phase_idx, phase in enumerate(implementation_plan):
        if not isinstance(phase, dict):
            continue
        p_name = phase.get("name") or phase.get("phase") or f"Phase {phase_idx + 1}"
        p_num = phase.get("phase", phase_idx + 1)
        phase_key = derive_phase_key(str(p_name), p_num)
        phase_tasks = phase.get("tasks") or []

        parsed_tasks = []
        for t in phase_tasks:
            if isinstance(t, str):
                t_dict = {
                    "task": t,
                    "description": "",
                    "files_or_modules": [],
                    "how_to_test": "",
                    "definition_of_done": "",
                }
            elif isinstance(t, dict):
                t_dict = dict(t)
            else:
                continue

            task_title = t_dict.get("task") or t_dict.get("title") or "task"
            existing_id = t_dict.get("task_id")
            if existing_id and str(existing_id).strip():
                existing_id_str = str(existing_id).strip()
                explicit_ids.add(existing_id_str)
            else:
                existing_id_str = None

            norm_phase = (phase_key or "general").strip().lower()
            task_slug = slugify(task_title, max_words=4)
            base_id = f"{norm_phase}.{task_slug}"

            fp = t_dict.get("task_fingerprint") or compute_task_fingerprint(
                phase_key,
                task_title,
                t_dict.get("files_or_modules"),
                t_dict.get("definition_of_done"),
                t_dict.get("description"),
            )

            if not existing_id_str:
                base_id_counts[base_id] = base_id_counts.get(base_id, 0) + 1

            parsed_tasks.append({
                "t_dict": t_dict,
                "base_id": base_id,
                "fp": fp,
                "existing_id": existing_id_str,
                "phase_key": phase_key,
            })

        phase_meta.append({
            "phase_copy": dict(phase),
            "parsed_tasks": parsed_tasks,
        })

    # Pass 2: Assign deterministic IDs
    assigned_ids: Set[str] = set(explicit_ids)
    cleaned_plan: List[Dict[str, Any]] = []

    for p_info in phase_meta:
        phase_copy = p_info["phase_copy"]
        updated_tasks: List[Dict[str, Any]] = []

        for item in p_info["parsed_tasks"]:
            t_dict = item["t_dict"]
            base_id = item["base_id"]
            fp = item["fp"]
            existing_id = item["existing_id"]

            if existing_id:
                final_id = existing_id
            else:
                count = base_id_counts.get(base_id, 0)
                if count == 1 and base_id not in assigned_ids:
                    final_id = base_id
                else:
                    # Disambiguate deterministically using fingerprint fragment
                    frag = fp[:4].lower()
                    candidate = f"{base_id}-{frag}"
                    if candidate in assigned_ids:
                        frag_6 = fp[:6].lower()
                        cand_6 = f"{base_id}-{frag_6}"
                        if cand_6 not in assigned_ids:
                            candidate = cand_6
                        else:
                            frag_8 = fp[:8].lower()
                            cand_8 = f"{base_id}-{frag_8}"
                            if cand_8 not in assigned_ids:
                                candidate = cand_8
                            else:
                                counter = 1
                                while f"{base_id}-{frag}-{counter}" in assigned_ids:
                                    counter += 1
                                candidate = f"{base_id}-{frag}-{counter}"
                    final_id = candidate

            assigned_ids.add(final_id)
            t_dict["task_id"] = final_id
            t_dict["task_fingerprint"] = fp
            updated_tasks.append(t_dict)

        phase_copy["tasks"] = updated_tasks
        cleaned_plan.append(phase_copy)

    return cleaned_plan


def canonicalize_v2_plan(implementation_plan: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extracts all tasks from a V2 implementation_plan, assigns stable task_id,
    task_fingerprint, phase_key, and task_order, preserving any existing task_id.
    Ensures deterministic, order-independent identities.
    """
    cleaned_plan = assign_v2_plan_identities(implementation_plan)
    tasks: List[Dict[str, Any]] = []
    order = 0

    for phase_idx, phase in enumerate(cleaned_plan):
        p_name = phase.get("name") or phase.get("phase") or f"Phase {phase_idx + 1}"
        p_num = phase.get("phase", phase_idx + 1)
        phase_key = derive_phase_key(str(p_name), p_num)

        for t in (phase.get("tasks") or []):
            order += 1
            t_dict = dict(t)
            t_dict["phase_key"] = phase_key
            t_dict["phase_name"] = str(p_name)
            t_dict["phase_order"] = phase_idx + 1
            t_dict["task_order"] = order
            t_dict["source_schema"] = 2
            tasks.append(t_dict)

    return tasks


def canonicalize_v1_milestones(milestones: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extracts all tasks from a V1 milestones array and assigns deterministic
    legacy task IDs (v1.phase-X.task-slug) with deterministic duplicate disambiguation.
    """
    if not isinstance(milestones, list):
        return []

    # Pass 1: Parse and count base IDs
    milestone_meta = []
    base_id_counts: Dict[str, int] = {}
    explicit_ids: Set[str] = set()

    for m_idx, m in enumerate(milestones):
        if not isinstance(m, dict):
            continue
        phase_name = m.get("title") or m.get("name") or f"Milestone {m_idx + 1}"
        phase_key = f"phase-{m_idx + 1}"
        m_tasks = m.get("tasks") or []
        if isinstance(m_tasks, str):
            m_tasks = [m_tasks]

        parsed_tasks = []
        for t in m_tasks:
            if isinstance(t, str):
                t_dict = {
                    "task": t,
                    "description": "",
                    "files_or_modules": [],
                    "how_to_test": "",
                    "definition_of_done": "",
                }
            elif isinstance(t, dict):
                t_dict = dict(t)
            else:
                continue

            task_title = t_dict.get("task") or t_dict.get("title") or "task"
            existing_id = t_dict.get("task_id")
            if existing_id and str(existing_id).strip():
                existing_id_str = str(existing_id).strip()
                explicit_ids.add(existing_id_str)
            else:
                existing_id_str = None

            task_slug = slugify(task_title, max_words=4)
            base_id = f"v1.{phase_key}.{task_slug}"

            fp = t_dict.get("task_fingerprint") or compute_task_fingerprint(
                phase_key,
                task_title,
                t_dict.get("files_or_modules"),
                t_dict.get("definition_of_done"),
                t_dict.get("description"),
            )

            if not existing_id_str:
                base_id_counts[base_id] = base_id_counts.get(base_id, 0) + 1

            parsed_tasks.append({
                "t_dict": t_dict,
                "base_id": base_id,
                "fp": fp,
                "existing_id": existing_id_str,
                "phase_name": str(phase_name),
                "phase_key": phase_key,
                "phase_order": m_idx + 1,
            })

        milestone_meta.append(parsed_tasks)

    # Pass 2: Assign deterministic IDs
    assigned_ids: Set[str] = set(explicit_ids)
    tasks: List[Dict[str, Any]] = []
    order = 0

    for parsed_tasks in milestone_meta:
        for item in parsed_tasks:
            order += 1
            t_dict = item["t_dict"]
            base_id = item["base_id"]
            fp = item["fp"]
            existing_id = item["existing_id"]

            if existing_id:
                final_id = existing_id
            else:
                count = base_id_counts.get(base_id, 0)
                if count == 1 and base_id not in assigned_ids:
                    final_id = base_id
                else:
                    frag = fp[:4].lower()
                    candidate = f"{base_id}-{frag}"
                    if candidate in assigned_ids:
                        frag_6 = fp[:6].lower()
                        cand_6 = f"{base_id}-{frag_6}"
                        if cand_6 not in assigned_ids:
                            candidate = cand_6
                        else:
                            counter = 1
                            while f"{base_id}-{frag}-{counter}" in assigned_ids:
                                counter += 1
                            candidate = f"{base_id}-{frag}-{counter}"
                    final_id = candidate

            assigned_ids.add(final_id)
            t_dict["task_id"] = final_id
            t_dict["task_fingerprint"] = fp
            t_dict["phase_key"] = item["phase_key"]
            t_dict["phase_name"] = item["phase_name"]
            t_dict["phase_order"] = item["phase_order"]
            t_dict["task_order"] = order
            t_dict["source_schema"] = 1
            tasks.append(t_dict)

    return tasks


def reconcile_tasks(
    old_tasks: List[Dict[str, Any]],
    new_tasks: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Reconciles existing tasks with newly generated tasks after blueprint regeneration.
    Matching precedence:
    1. Exact existing task_id
    2. Exact task_fingerprint
    3. Conservative deterministic semantic match:
       - Phase key match AND (high normalized title overlap OR file overlap)
    
    If matched with high confidence, preserves the old task_id.
    Otherwise, generates a new task_id.
    """
    used_old_task_ids: Set[str] = set()
    result_tasks: List[Dict[str, Any]] = []
    assigned_new_ids: Set[str] = set()

    old_by_id = {t["task_id"]: t for t in old_tasks if t.get("task_id")}
    old_by_fingerprint = {t["task_fingerprint"]: t for t in old_tasks if t.get("task_fingerprint")}

    for new_task in new_tasks:
        matched_id: Optional[str] = None
        task_title = new_task.get("task") or new_task.get("title") or ""
        phase_key = new_task.get("phase_key") or "general"
        new_files = set(new_task.get("files_or_modules") or [])
        new_fp = new_task.get("task_fingerprint") or compute_task_fingerprint(
            phase_key, task_title, list(new_files), new_task.get("definition_of_done")
        )

        # 1. Exact existing task_id if new_task already has one
        existing_explicit_id = new_task.get("task_id")
        if existing_explicit_id and existing_explicit_id in old_by_id and existing_explicit_id not in used_old_task_ids:
            matched_id = existing_explicit_id

        # 2. Exact fingerprint match
        if not matched_id and new_fp in old_by_fingerprint:
            cand = old_by_fingerprint[new_fp]
            cand_id = cand.get("task_id")
            if cand_id and cand_id not in used_old_task_ids:
                matched_id = cand_id

        # 3. Conservative semantic match
        if not matched_id:
            norm_new_title = normalize_task_text(task_title)
            new_title_words = set(norm_new_title.split())
            best_candidate: Optional[Dict[str, Any]] = None

            for old_t in old_tasks:
                cand_id = old_t.get("task_id")
                if not cand_id or cand_id in used_old_task_ids:
                    continue

                old_phase = old_t.get("phase_key") or ""
                old_title = old_t.get("task") or old_t.get("title") or ""
                norm_old_title = normalize_task_text(old_title)
                old_title_words = set(norm_old_title.split())

                old_files = set(old_t.get("files_or_modules") or [])
                files_overlap = bool(new_files and old_files and (new_files & old_files))

                # If normalized titles match exactly
                if norm_new_title == norm_old_title:
                    best_candidate = old_t
                    break

                # If same phase key and high word overlap (>= 75% Jaccard)
                if old_phase == phase_key:
                    if new_title_words and old_title_words:
                        overlap = len(new_title_words & old_title_words)
                        union = len(new_title_words | old_title_words)
                        if union > 0 and (overlap / union) >= 0.75:
                            best_candidate = old_t
                            break

                # If file overlap and at least 50% title word overlap
                if files_overlap and new_title_words and old_title_words:
                    overlap = len(new_title_words & old_title_words)
                    union = len(new_title_words | old_title_words)
                    if union > 0 and (overlap / union) >= 0.5:
                        best_candidate = old_t
                        break

            if best_candidate and best_candidate.get("task_id"):
                matched_id = best_candidate["task_id"]

        if matched_id:
            used_old_task_ids.add(matched_id)
            final_id = matched_id
        else:
            final_id = generate_v2_task_id(phase_key, task_title, assigned_new_ids, disambiguator=new_fp)

        assigned_new_ids.add(final_id)
        task_copy = dict(new_task)
        task_copy["task_id"] = final_id
        task_copy["task_fingerprint"] = new_fp
        task_copy["phase_key"] = phase_key
        result_tasks.append(task_copy)

    return result_tasks
