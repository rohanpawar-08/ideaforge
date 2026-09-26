import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from database import engine, Base, get_db
from schemas import (
    IdeaRequest,
    RegenerateRequest,
    CompareRequest,
    AskRequest,
    ApplyChangeRequest,
    UserAuthRequest,
    TokenResponse,
)
import models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ideaforge")

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "ideaforge_jwt_super_secret_key_2026_x99a8b7c6d5e4f3a2b1c")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: int, email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expires,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not auth or not auth.credentials:
        raise credentials_exception

    token = auth.credentials.strip()
    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise credentials_exception
        user_id = int(user_id_str)
    except Exception:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise credentials_exception

    return user


Base.metadata.create_all(bind=engine)
try:
    with engine.connect() as conn:
        conn.execute(
            text(
                "ALTER TABLE roadmaps ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)"
            )
        )
        conn.commit()
except Exception as migration_err:
    logger.info(f"Database migration notice: {migration_err}")

app = FastAPI(title="IdeaForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this before real deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": True, "detail": str(exc), "message": "Something went wrong — please try again."}
    )

LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-20b")

SYSTEM_PROMPT = (
    "You are a technical project planning assistant. A user has given you a rough project idea.\n"
    "Your goal is to gather 4 key pieces of information to build a tailored project roadmap:\n"
    "1. Target Audience: Who the project is for.\n"
    "2. Core Feature: The single most important MVP capability or primary functionality.\n"
    "3. Technical Skill Level: The user's current programming and technical experience.\n"
    "4. Time Budget: Their rough available timeframe or weekly hours.\n\n"
    "Adaptive Clarifying Flow Instructions:\n"
    "- Ask ONE clarifying question at a time. Ask a maximum of 4 questions total.\n"
    "- Adaptive ordering & wording: Do not follow a rigid script or fixed sequence. Review what the user has already shared in their idea and previous answers. If a piece of information is already provided or implied, acknowledge it and do not ask for it again. Choose whichever missing piece makes the most logical sense to ask next.\n"
    "- Handling vague answers, 'I don't know', or requests for explanation:\n"
    "  * If the user's answer is vague, says 'I don't know', or asks for an explanation instead of answering, YOU MUST FIRST briefly explain that concept in plain, simple, jargon-free language (with 1-2 concrete, relatable examples or options tailored to their project idea).\n"
    "  * DO NOT repeat the exact same question. Instead, naturally continue toward the next piece of missing information or offer options/suggestions they can easily choose from.\n"
    "- Completion: After 4 questions total, or if the user says 'just generate it', respond with the roadmap JSON instead of another question.\n"
    "- Skill Level Alignment: Keep the setup_guide consistent with the user's stated skill level from previous answers (e.g. recommend beginner-friendly tools and editors for beginners).\n\n"
    "Respond ONLY in this JSON format, nothing else:\n"
    '{"type": "question", "text": "<your plain-language explanation (if needed) and clarifying question>"}\n'
    "or\n"
    '{"type": "roadmap", "data": {"feasibility": "beginner|intermediate|advanced", '
    '"difficulty_breakdown": {"frontend_complexity": "beginner|intermediate|advanced|not_applicable", "backend_complexity": "beginner|intermediate|advanced|not_applicable", "database_complexity": "beginner|intermediate|advanced|not_applicable", "ai_complexity": "beginner|intermediate|advanced|not_applicable", "deployment_complexity": "beginner|intermediate|advanced|not_applicable"}, '
    '"estimated_weeks": <number>, '
    '"recommended_stack": ["<tech>"], '
    '"setup_guide": {"primary_language": "<string>", "editor_recommendation": "<string>", "key_tools": [{"name": "<string>", "purpose": "<string>"}], "getting_started_command": "<string>"}, '
    '"suggested_schema": [{"table_name": "<string>", "fields": [{"name": "<string>", "type": "<string>", "notes": "<string>"}]}], '
    '"mvp_features": ["<feature>"], "stretch_features": ["<feature>"], '
    '"milestones": [{"week": <number>, "goal": "<goal>", "tasks": ["<task>"]}]}}'
)
STAGE1_SYSTEM_PROMPT = SYSTEM_PROMPT


ROADMAP_SYSTEM_PROMPT = (
    "You are a technical project planning assistant. Based on the user's project idea and previous clarifying answers, "
    "generate a comprehensive and realistic project roadmap.\n\n"
    "CRITICAL REQUIREMENTS:\n"
    "1. Skill Level Consistency:\n"
    "Review the user's stated technical skill level from their previous answers. "
    "Keep the 'setup_guide' (primary language reason, editor recommendation, key tools, and getting started command) "
    "strictly consistent with the user's stated skill level — recommend accessible, beginner-friendly tools/editors (like VS Code or beginner-friendly CLIs) "
    "for beginners, and appropriately advanced tools for more experienced developers.\n\n"
    "2. Difficulty Breakdown:\n"
    "In addition to the overall 'feasibility' level (beginner, intermediate, or advanced), provide a granular 'difficulty_breakdown' object "
    "evaluating: frontend_complexity, backend_complexity, database_complexity, ai_complexity (use 'not_applicable' if the project has no AI component), "
    "and deployment_complexity. Each must be rated strictly one of: 'beginner', 'intermediate', 'advanced', or 'not_applicable'.\n\n"
    "3. Suggested Schema:\n"
    "Provide a 'suggested_schema' list of table objects. Each table object must have:\n"
    "- 'table_name': string\n"
    "- 'fields': list of field objects, each with:\n"
    "  * 'name': string (field or column name)\n"
    "  * 'type': string (data type, e.g. integer, string, text, boolean, timestamp, json)\n"
    "  * 'notes': string (plain-text notes flagging things like 'primary key', 'foreign key to X', 'unique', etc. — not a full SQL constraint syntax)\n"
    "Keep this simple — no ER diagram, just a clear list. Only include tables that are actually relevant to the project idea "
    "(e.g. do not force a 'users' table if the idea has no user accounts or authentication).\n\n"
    "Respond ONLY in this exact JSON schema, with no additional commentary or markdown wrapping:\n"
    "{\n"
    '  "type": "roadmap",\n'
    '  "data": {\n'
    '    "feasibility": "beginner|intermediate|advanced",\n'
    '    "difficulty_breakdown": {\n'
    '      "frontend_complexity": "beginner|intermediate|advanced|not_applicable",\n'
    '      "backend_complexity": "beginner|intermediate|advanced|not_applicable",\n'
    '      "database_complexity": "beginner|intermediate|advanced|not_applicable",\n'
    '      "ai_complexity": "beginner|intermediate|advanced|not_applicable",\n'
    '      "deployment_complexity": "beginner|intermediate|advanced|not_applicable"\n'
    '    },\n'
    '    "estimated_weeks": <number>,\n'
    '    "recommended_stack": ["<tech1>", "<tech2>"],\n'
    '    "setup_guide": {\n'
    '      "primary_language": "<main programming language to use, with a one-line reason>",\n'
    '      "editor_recommendation": "<code editor/IDE to use and why, e.g. VS Code, Antigravity, PyCharm>",\n'
    '      "key_tools": [\n'
    '        {\n'
    '          "name": "<specific tool, framework, or package name needed beyond the main stack>",\n'
    '          "purpose": "<specific purpose>"\n'
    '        }\n'
    '      ],\n'
    '      "getting_started_command": "<very first terminal command to run to start the project, e.g. npm create vite@latest>"\n'
    '    },\n'
    '    "suggested_schema": [\n'
    '      {\n'
    '        "table_name": "<table_name>",\n'
    '        "fields": [\n'
    '          {\n'
    '            "name": "<field_name>",\n'
    '            "type": "<data_type>",\n'
    '            "notes": "<plain text note, e.g. primary key, foreign key to X, unique>"\n'
    '          }\n'
    '        ]\n'
    '      }\n'
    '    ],\n'
    '    "mvp_features": ["<feature1>", "<feature2>"],\n'
    '    "stretch_features": ["<feature1>", "<feature2>"],\n'
    '    "milestones": [\n'
    '      {\n'
    '        "week": 1,\n'
    '        "goal": "<milestone goal>",\n'
    '        "tasks": ["<task1>", "<task2>"]\n'
    '      }\n'
    '    ]\n'
    '  }\n'
    "}"
)


def validate_roadmap_schema(obj: dict) -> list[str]:
    errors = []
    if not isinstance(obj, dict):
        return ["Response must be a JSON object."]

    if obj.get("type") != "roadmap":
        errors.append("Top-level 'type' must be 'roadmap'.")

    data = obj.get("data")
    if not isinstance(data, dict):
        errors.append("Top-level 'data' must be an object.")
        return errors

    feasibility = data.get("feasibility")
    if not isinstance(feasibility, str) or feasibility.lower() not in [
        "beginner",
        "intermediate",
        "advanced",
    ]:
        errors.append(
            "'data.feasibility' must be one of: 'beginner', 'intermediate', 'advanced'."
        )
    else:
        data["feasibility"] = feasibility.lower()

    # Difficulty breakdown validation
    difficulty_breakdown = data.get("difficulty_breakdown")
    valid_ratings = {"beginner", "intermediate", "advanced", "not_applicable"}
    required_breakdown_fields = [
        "frontend_complexity",
        "backend_complexity",
        "database_complexity",
        "ai_complexity",
        "deployment_complexity",
    ]

    if not isinstance(difficulty_breakdown, dict):
        errors.append("'data.difficulty_breakdown' must be an object.")
    else:
        for field in required_breakdown_fields:
            val = difficulty_breakdown.get(field)
            if isinstance(val, str):
                normalized = val.strip().lower().replace("-", "_").replace(" ", "_")
                if normalized in ("na", "n_a"):
                    normalized = "not_applicable"
                if normalized in valid_ratings:
                    difficulty_breakdown[field] = normalized
                else:
                    errors.append(
                        f"'data.difficulty_breakdown.{field}' must be one of: 'beginner', 'intermediate', 'advanced', 'not_applicable'."
                    )
            else:
                errors.append(
                    f"'data.difficulty_breakdown.{field}' must be one of: 'beginner', 'intermediate', 'advanced', 'not_applicable'."
                )

    estimated_weeks = data.get("estimated_weeks")
    if not isinstance(estimated_weeks, (int, float)) or isinstance(
        estimated_weeks, bool
    ):
        errors.append("'data.estimated_weeks' must be a number.")

    for list_field in ["recommended_stack", "mvp_features", "stretch_features"]:
        val = data.get(list_field)
        if not isinstance(val, list) or not all(isinstance(x, str) for x in val):
            errors.append(f"'data.{list_field}' must be a list of strings.")

    setup_guide = data.get("setup_guide")
    if not isinstance(setup_guide, dict):
        errors.append("'data.setup_guide' must be an object.")
    else:
        primary_lang = setup_guide.get("primary_language")
        if not isinstance(primary_lang, str) or not primary_lang.strip():
            errors.append("'data.setup_guide.primary_language' must be a non-empty string.")

        editor_rec = setup_guide.get("editor_recommendation")
        if not isinstance(editor_rec, str) or not editor_rec.strip():
            errors.append("'data.setup_guide.editor_recommendation' must be a non-empty string.")

        start_cmd = setup_guide.get("getting_started_command")
        if not isinstance(start_cmd, str) or not start_cmd.strip():
            errors.append("'data.setup_guide.getting_started_command' must be a non-empty string.")

        key_tools = setup_guide.get("key_tools")
        if not isinstance(key_tools, list) or len(key_tools) == 0:
            errors.append("'data.setup_guide.key_tools' must be a non-empty list of tool objects.")
        else:
            for idx, tool in enumerate(key_tools):
                if not isinstance(tool, dict):
                    errors.append(f"'data.setup_guide.key_tools[{idx}]' must be an object.")
                    continue
                if not isinstance(tool.get("name"), str) or not tool.get("name").strip():
                    errors.append(f"'data.setup_guide.key_tools[{idx}].name' must be a non-empty string.")
                if not isinstance(tool.get("purpose"), str) or not tool.get("purpose").strip():
                    errors.append(f"'data.setup_guide.key_tools[{idx}].purpose' must be a non-empty string.")

    suggested_schema = data.get("suggested_schema")
    if not isinstance(suggested_schema, list):
        errors.append("'data.suggested_schema' must be a list of table objects.")
    else:
        for t_idx, table in enumerate(suggested_schema):
            if not isinstance(table, dict):
                errors.append(f"'data.suggested_schema[{t_idx}]' must be an object.")
                continue
            table_name = table.get("table_name")
            if not isinstance(table_name, str) or not table_name.strip():
                errors.append(f"'data.suggested_schema[{t_idx}].table_name' must be a non-empty string.")
            fields = table.get("fields")
            if not isinstance(fields, list):
                errors.append(f"'data.suggested_schema[{t_idx}].fields' must be a list of field objects.")
            else:
                for f_idx, field in enumerate(fields):
                    if not isinstance(field, dict):
                        errors.append(f"'data.suggested_schema[{t_idx}].fields[{f_idx}]' must be an object.")
                        continue
                    if not isinstance(field.get("name"), str) or not field.get("name").strip():
                        errors.append(f"'data.suggested_schema[{t_idx}].fields[{f_idx}].name' must be a non-empty string.")
                    if not isinstance(field.get("type"), str) or not field.get("type").strip():
                        errors.append(f"'data.suggested_schema[{t_idx}].fields[{f_idx}].type' must be a non-empty string.")
                    notes_val = field.get("notes")
                    if notes_val is None:
                        field["notes"] = ""
                    elif not isinstance(notes_val, str):
                        field["notes"] = str(notes_val)

    milestones = data.get("milestones")
    if not isinstance(milestones, list) or len(milestones) == 0:
        errors.append(
            "'data.milestones' must be a non-empty list of milestone objects."
        )
    else:
        for idx, m in enumerate(milestones):
            if not isinstance(m, dict):
                errors.append(f"'data.milestones[{idx}]' must be an object.")
                continue
            if not isinstance(m.get("week"), (int, float)) or isinstance(
                m.get("week"), bool
            ):
                errors.append(f"'data.milestones[{idx}].week' must be a number.")
            if not isinstance(m.get("goal"), str) or not m.get("goal").strip():
                errors.append(
                    f"'data.milestones[{idx}].goal' must be a non-empty string."
                )
            tasks = m.get("tasks")
            if not isinstance(tasks, list) or not all(isinstance(t, str) for t in tasks):
                errors.append(
                    f"'data.milestones[{idx}].tasks' must be a list of strings."
                )

    return errors


def call_groq_llm(messages: list[dict]) -> dict:
    if not LLM_API_KEY:
        logger.error("LLM_API_KEY is not configured.")
        raise HTTPException(status_code=500, detail="LLM_API_KEY is not configured")

    try:
        resp = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL,
                "messages": messages,
                "response_format": {"type": "json_object"},
            },
            timeout=45,
        )
    except requests.RequestException as e:
        logger.error(f"Network error calling LLM API: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"LLM API request failed: {str(e)}")

    if resp.status_code != 200:
        logger.error(f"LLM API returned status {resp.status_code}: {resp.text}")
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"Groq API error: {resp.text}",
        )

    try:
        data = resp.json()
        raw_content = data["choices"][0]["message"]["content"].strip()
        if raw_content.startswith("```"):
            raw_content = raw_content.strip("`")
            if raw_content.startswith("json"):
                raw_content = raw_content[4:].strip()
        return json.loads(raw_content)
    except (KeyError, IndexError, json.JSONDecodeError) as err:
        logger.error(f"Malformed JSON returned by model: {err}. Raw response was: {resp.text}", exc_info=True)
        raise ValueError(f"Malformed JSON returned by model: {err}")


def generate_roadmap_with_validation(messages: list[dict]) -> dict:
    attempt_messages = list(messages)
    max_retries = 1

    for attempt in range(max_retries + 1):
        try:
            parsed = call_groq_llm(attempt_messages)
            errors = validate_roadmap_schema(parsed)
        except (ValueError, HTTPException) as err:
            logger.warning(f"Roadmap generation attempt {attempt + 1} encountered error: {err}")
            errors = [str(err)]
            parsed = None

        if not errors and parsed:
            return parsed

        if attempt < max_retries:
            logger.info(f"Retrying roadmap generation after schema/validation errors: {errors}")
            error_details = "\n".join(f"- {err}" for err in errors)
            retry_content = (
                f"Your previous response had schema/format errors:\n{error_details}\n\n"
                "Please fix all errors and respond ONLY with valid JSON matching the exact schema:\n"
                '{\n'
                '  "type": "roadmap",\n'
                '  "data": {\n'
                '    "feasibility": "beginner|intermediate|advanced",\n'
                '    "difficulty_breakdown": {\n'
                '      "frontend_complexity": "beginner|intermediate|advanced|not_applicable",\n'
                '      "backend_complexity": "beginner|intermediate|advanced|not_applicable",\n'
                '      "database_complexity": "beginner|intermediate|advanced|not_applicable",\n'
                '      "ai_complexity": "beginner|intermediate|advanced|not_applicable",\n'
                '      "deployment_complexity": "beginner|intermediate|advanced|not_applicable"\n'
                '    },\n'
                '    "estimated_weeks": <number>,\n'
                '    "recommended_stack": ["<tech1>", "<tech2>"],\n'
                '    "setup_guide": {\n'
                '      "primary_language": "<main programming language to use, with a one-line reason>",\n'
                '      "editor_recommendation": "<code editor/IDE to use and why, e.g. VS Code, Antigravity, PyCharm>",\n'
                '      "key_tools": [\n'
                '        {\n'
                '          "name": "<specific tool, framework, or package name needed beyond the main stack>",\n'
                '          "purpose": "<specific purpose>"\n'
                '        }\n'
                '      ],\n'
                '      "getting_started_command": "<very first terminal command to run to start the project, e.g. npm create vite@latest>"\n'
                '    },\n'
                '    "suggested_schema": [\n'
                '      {\n'
                '        "table_name": "<table_name>",\n'
                '        "fields": [\n'
                '          {\n'
                '            "name": "<field_name>",\n'
                '            "type": "<data_type>",\n'
                '            "notes": "<plain text note, e.g. primary key, foreign key to X, unique>"\n'
                '          }\n'
                '        ]\n'
                '      }\n'
                '    ],\n'
                '    "mvp_features": ["<feature1>", "<feature2>"],\n'
                '    "stretch_features": ["<feature1>", "<feature2>"],\n'
                '    "milestones": [\n'
                '      {\n'
                '        "week": 1,\n'
                '        "goal": "<milestone goal>",\n'
                '        "tasks": ["<task1>", "<task2>"]\n'
                '      }\n'
                '    ]\n'
                '  }\n'
                '}'
            )
            if parsed:
                attempt_messages.append({
                    "role": "assistant",
                    "content": json.dumps(parsed)
                })
            attempt_messages.append({
                "role": "user",
                "content": retry_content
            })
        else:
            logger.error(f"Roadmap validation failed after retry: {'; '.join(errors)}")
            raise HTTPException(
                status_code=502,
                detail=f"Roadmap validation failed after retry: {'; '.join(errors)}"
            )


@app.get("/")
def health_check():
    return {"status": "IdeaForge backend is running"}


@app.post("/auth/signup", response_model=TokenResponse)
def signup(req: UserAuthRequest, db: Session = Depends(get_db)):
    email = (req.email or "").strip().lower()
    password = req.password or ""
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    hashed = hash_password(password)
    user = models.User(email=email, hashed_password=hashed)
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
    }


@app.post("/auth/login", response_model=TokenResponse)
def login(req: UserAuthRequest, db: Session = Depends(get_db)):
    email = (req.email or "").strip().lower()
    password = req.password or ""
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token(user.id, user.email)
    return {
        "access_token": token,
        "token_type": "bearer",
    }


@app.get("/roadmaps")
def get_roadmaps(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        roadmaps = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.user_id == current_user.id)
            .order_by(models.Roadmap.created_at.desc(), models.Roadmap.id.desc())
            .all()
        )
        results = []
        for r in roadmaps:
            data_blob = r.data if isinstance(r.data, dict) else {}
            inner_data = (
                data_blob.get("data")
                if isinstance(data_blob.get("data"), dict)
                else data_blob
            )
            feasibility = inner_data.get("feasibility", "intermediate")
            estimated_weeks = inner_data.get("estimated_weeks", 4)

            results.append({
                "id": r.id,
                "original_idea": r.original_idea,
                "summary": {
                    "feasibility": feasibility,
                    "estimated_weeks": estimated_weeks,
                    "difficulty_breakdown": inner_data.get("difficulty_breakdown"),
                },
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
        return results
    except Exception as exc:
        logger.error(f"Error fetching roadmaps: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": True, "detail": str(exc), "message": "Failed to fetch roadmaps."}
        )


@app.get("/roadmaps/{roadmap_id}")
def get_roadmap(
    roadmap_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        roadmap = (
            db.query(models.Roadmap)
            .filter(
                models.Roadmap.id == roadmap_id,
                models.Roadmap.user_id == current_user.id,
            )
            .first()
        )
        if not roadmap:
            raise HTTPException(status_code=404, detail=f"Roadmap with id {roadmap_id} not found")

        data_blob = roadmap.data if isinstance(roadmap.data, dict) else {}
        inner_data = (
            data_blob.get("data")
            if isinstance(data_blob.get("data"), dict)
            else data_blob
        )

        return {
            "id": roadmap.id,
            "original_idea": roadmap.original_idea,
            "created_at": roadmap.created_at.isoformat() if roadmap.created_at else None,
            "data": inner_data,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error fetching roadmap {roadmap_id}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": True, "detail": str(exc), "message": "Failed to fetch roadmap."}
        )


@app.post("/roadmaps/{roadmap_id}/regenerate")
def regenerate_roadmap_section(
    roadmap_id: int,
    request: RegenerateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    section_raw = (request.section or "").strip().lower()
    if section_raw in ["stack", "recommended_stack"]:
        target_key = "recommended_stack"
    elif section_raw in ["setup_guide", "setup", "setupguide"]:
        target_key = "setup_guide"
    elif section_raw in ["suggested_schema", "schema", "database", "database_schema", "tables"]:
        target_key = "suggested_schema"
    elif section_raw in ["milestones", "milestone"]:
        target_key = "milestones"
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid section. Must be 'stack', 'setup_guide', 'suggested_schema', or 'milestones'.",
        )

    roadmap = (
        db.query(models.Roadmap)
        .filter(
            models.Roadmap.id == roadmap_id,
            models.Roadmap.user_id == current_user.id,
        )
        .first()
    )
    if not roadmap:
        raise HTTPException(
            status_code=404,
            detail=f"Roadmap with id {roadmap_id} not found",
        )

    current_data = dict(roadmap.data) if isinstance(roadmap.data, dict) else {}
    inner_data = (
        current_data.get("data")
        if isinstance(current_data.get("data"), dict)
        else current_data
    )

    original_idea = roadmap.original_idea
    feasibility = inner_data.get("feasibility", "intermediate")
    estimated_weeks = inner_data.get("estimated_weeks", 4)
    current_stack = inner_data.get("recommended_stack", [])
    current_mvp = inner_data.get("mvp_features", [])
    current_stretch = inner_data.get("stretch_features", [])

    previous_answers = request.previous_answers or []
    prev_answers_text = ""
    if previous_answers:
        prev_answers_text = "\nPrevious Clarifying Answers:\n" + "\n".join(
            f"- {ans}" for ans in previous_answers
        )

    full_roadmap_json = json.dumps(inner_data, indent=2)

    if target_key == "recommended_stack":
        system_prompt = (
            "You are a technical project planning assistant. The user wants to regenerate ONLY the recommended tech stack for their project.\n"
            "Keep everything else about the project (feasibility, timeline, setup guide, suggested schema, MVP features, milestones) consistent.\n"
            "Respond ONLY with a valid JSON object in this format:\n"
            '{\n  "recommended_stack": ["<tech1>", "<tech2>", "<tech3>"]\n}'
        )
        user_prompt = (
            f"Original Idea: {original_idea}{prev_answers_text}\n\n"
            f"Current Full Roadmap Data:\n{full_roadmap_json}\n\n"
            "Regenerate ONLY the recommended tech stack for this project while keeping everything else consistent."
        )
    elif target_key == "setup_guide":
        system_prompt = (
            "You are a technical project planning assistant. The user wants to regenerate ONLY the developer setup guide for their project roadmap.\n"
            "Keep everything else about the project (idea, stack, suggested schema, MVP features, milestones) consistent.\n"
            "Respond ONLY with a valid JSON object in this format:\n"
            "{\n"
            '  "setup_guide": {\n'
            '    "primary_language": "<main language to use with one-line reason>",\n'
            '    "editor_recommendation": "<code editor/IDE to use and why>",\n'
            '    "key_tools": [\n'
            '      {"name": "<tool_name>", "purpose": "<specific_purpose>"}\n'
            '    ],\n'
            '    "getting_started_command": "<terminal command to initialize project>"\n'
            "  }\n"
            "}"
        )
        user_prompt = (
            f"Original Idea: {original_idea}{prev_answers_text}\n\n"
            f"Current Full Roadmap Data:\n{full_roadmap_json}\n\n"
            "Regenerate ONLY the developer setup guide (primary language, editor recommendation, key tools, getting started command) while keeping everything else consistent."
        )
    elif target_key == "suggested_schema":
        system_prompt = (
            "You are a technical project planning assistant. The user wants to regenerate ONLY the suggested database schema for their project roadmap.\n"
            "Keep everything else about the project (idea, stack, setup guide, MVP features, milestones) consistent.\n"
            "Respond ONLY with a valid JSON object in this format:\n"
            "{\n"
            '  "suggested_schema": [\n'
            '    {\n'
            '      "table_name": "<table_name>",\n'
            '      "fields": [\n'
            '        {\n'
            '          "name": "<field_name>",\n'
            '          "type": "<data_type>",\n'
            '          "notes": "<plain text note, e.g. primary key, foreign key to X, unique>"\n'
            '        }\n'
            '      ]\n'
            '    }\n'
            '  ]\n'
            "}"
        )
        user_prompt = (
            f"Original Idea: {original_idea}{prev_answers_text}\n\n"
            f"Current Full Roadmap Data:\n{full_roadmap_json}\n\n"
            "Regenerate ONLY the suggested database schema (tables and their fields) while keeping everything else consistent."
        )
    else:  # milestones
        system_prompt = (
            "You are a technical project planning assistant. The user wants to regenerate ONLY the weekly milestone execution plan for their project roadmap.\n"
            f"Keep the timeline duration consistent with the current roadmap ({estimated_weeks} weeks) and aligned with the stack and MVP scope.\n"
            "Keep everything else about the project consistent.\n"
            "Respond ONLY with a valid JSON object in this format:\n"
            "{\n"
            '  "milestones": [\n'
            '    {\n'
            '      "week": 1,\n'
            '      "goal": "<milestone goal>",\n'
            '      "tasks": ["<task1>", "<task2>"]\n'
            '    }\n'
            '  ]\n'
            "}"
        )
        user_prompt = (
            f"Original Idea: {original_idea}{prev_answers_text}\n\n"
            f"Current Full Roadmap Data:\n{full_roadmap_json}\n\n"
            f"Regenerate ONLY the week-by-week milestone execution plan spanning {estimated_weeks} weeks while keeping everything else consistent."
        )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        llm_response = call_groq_llm(messages)
        if target_key == "recommended_stack":
            updated_section_data = (
                llm_response.get("recommended_stack")
                or llm_response.get("stack")
                or (llm_response if isinstance(llm_response, list) else [])
            )
            if not isinstance(updated_section_data, list):
                updated_section_data = [str(updated_section_data)]
        elif target_key == "setup_guide":
            updated_section_data = llm_response.get("setup_guide") or llm_response
            if not isinstance(updated_section_data, dict):
                raise ValueError("setup_guide must be a JSON object")
        elif target_key == "suggested_schema":
            updated_section_data = (
                llm_response.get("suggested_schema")
                or llm_response.get("schema")
                or (llm_response if isinstance(llm_response, list) else [])
            )
            if not isinstance(updated_section_data, list):
                raise ValueError("suggested_schema must be a list of table objects")
        else:  # milestones
            updated_section_data = (
                llm_response.get("milestones")
                or (llm_response if isinstance(llm_response, list) else [])
            )
            if not isinstance(updated_section_data, list):
                raise ValueError("milestones must be a list of milestone objects")

        # Update in database
        inner_data[target_key] = updated_section_data
        roadmap.data = dict(current_data)
        flag_modified(roadmap, "data")
        db.commit()
        db.refresh(roadmap)

        return {
            "section": request.section,
            "target_key": target_key,
            "data": updated_section_data,
            "roadmap": {
                "id": roadmap.id,
                "original_idea": roadmap.original_idea,
                "created_at": roadmap.created_at.isoformat() if roadmap.created_at else None,
                "data": inner_data,
            },
        }
    except Exception as exc:
        logger.error(
            f"Error regenerating section '{target_key}' for roadmap {roadmap_id}: {exc}",
            exc_info=True,
        )
        db.rollback()
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "detail": str(exc),
                "message": f"Failed to regenerate section {request.section}. Please try again.",
            },
        )


@app.post("/roadmaps/{roadmap_id}/ask")
def ask_about_roadmap(
    roadmap_id: int,
    request: AskRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    roadmap = (
        db.query(models.Roadmap)
        .filter(
            models.Roadmap.id == roadmap_id,
            models.Roadmap.user_id == current_user.id,
        )
        .first()
    )
    if not roadmap:
        raise HTTPException(
            status_code=404,
            detail=f"Roadmap with id {roadmap_id} not found",
        )

    user_message = (request.message or "").strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    current_data = dict(roadmap.data) if isinstance(roadmap.data, dict) else {}
    inner_data = (
        current_data.get("data")
        if isinstance(current_data.get("data"), dict)
        else current_data
    )

    original_idea = roadmap.original_idea
    full_roadmap_json = json.dumps(inner_data, indent=2)

    system_prompt = (
        "You are an expert technical advisor and software project coach assisting a developer with their project roadmap.\n"
        "You have full context of the original idea and the complete roadmap.\n\n"
        "The developer will ask you questions or request modifications to their roadmap.\n"
        "Evaluate the developer's message carefully:\n"
        "1. If the message is a general question, explanation request, or inquiry (e.g., 'why is week 2 focused on auth?', 'how do I set up testing?', 'is this stack good for scale?'):\n"
        "   - Provide a friendly, comprehensive, conversational explanation.\n"
        "   - Set 'proposed_change' to null.\n"
        "2. If the message is clearly asking to modify, update, replace, simplify, or adjust a specific section of the roadmap (e.g. 'simplify week 3', 'can I use Vue instead of React', 'change IDE to PyCharm', 'add Docker to the stack', 'reduce week 1 tasks'):\n"
        "   - In 'reply', explain conversationally what you changed, why it makes sense, and how it impacts the project.\n"
        "   - In 'proposed_change', provide the full updated version of that section while keeping everything else consistent.\n\n"
        "Respond ONLY with a valid JSON object in this structure:\n"
        "{\n"
        '  "reply": "<helpful, conversational text response>",\n'
        '  "proposed_change": null | {\n'
        '    "section": "stack" | "setup_guide" | "suggested_schema" | "milestones",\n'
        '    "target_key": "recommended_stack" | "setup_guide" | "suggested_schema" | "milestones",\n'
        '    "summary": "<short description of what was changed>",\n'
        '    "data": <the full updated section: list for stack, object for setup_guide, list of tables for suggested_schema, or list of milestones for milestones>\n'
        "  }\n"
        "}"
    )

    user_prompt = (
        f"Original Project Idea: {original_idea}\n\n"
        f"Current Full Roadmap:\n{full_roadmap_json}\n\n"
        f"Developer's Message: {user_message}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        llm_response = call_groq_llm(messages)
        reply = llm_response.get("reply") or str(llm_response)
        proposed_change = llm_response.get("proposed_change")

        # Validate and clean proposed_change if present
        if isinstance(proposed_change, dict) and proposed_change.get("data"):
            section_raw = str(proposed_change.get("section", "")).lower()
            if "stack" in section_raw:
                proposed_change["section"] = "stack"
                proposed_change["target_key"] = "recommended_stack"
                if not isinstance(proposed_change["data"], list):
                    proposed_change["data"] = [str(proposed_change["data"])]
            elif "setup" in section_raw:
                proposed_change["section"] = "setup_guide"
                proposed_change["target_key"] = "setup_guide"
            elif "schema" in section_raw or "table" in section_raw or "database" in section_raw:
                proposed_change["section"] = "suggested_schema"
                proposed_change["target_key"] = "suggested_schema"
                if not isinstance(proposed_change["data"], list):
                    proposed_change = None
            elif "milestone" in section_raw or "week" in section_raw:
                proposed_change["section"] = "milestones"
                proposed_change["target_key"] = "milestones"
                if not isinstance(proposed_change["data"], list):
                    proposed_change = None
        else:
            proposed_change = None

        return {
            "reply": reply,
            "proposed_change": proposed_change,
        }
    except Exception as exc:
        logger.error(f"Error in /roadmaps/{roadmap_id}/ask: {exc}", exc_info=True)
        return {
            "reply": f"I reviewed your question regarding '{user_message}'. Could you clarify or retry your request?",
            "proposed_change": None,
        }


@app.post("/roadmaps/{roadmap_id}/apply-change")
def apply_roadmap_change(
    roadmap_id: int,
    request: ApplyChangeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    roadmap = (
        db.query(models.Roadmap)
        .filter(
            models.Roadmap.id == roadmap_id,
            models.Roadmap.user_id == current_user.id,
        )
        .first()
    )
    if not roadmap:
        raise HTTPException(
            status_code=404,
            detail=f"Roadmap with id {roadmap_id} not found",
        )

    section_raw = (request.section or "").strip().lower()
    if section_raw in ["stack", "recommended_stack"]:
        target_key = "recommended_stack"
    elif section_raw in ["setup_guide", "setup", "setupguide"]:
        target_key = "setup_guide"
    elif section_raw in ["suggested_schema", "schema", "database", "database_schema", "tables"]:
        target_key = "suggested_schema"
    elif section_raw in ["milestones", "milestone"]:
        target_key = "milestones"
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid section. Must be 'stack', 'setup_guide', 'suggested_schema', or 'milestones'.",
        )

    current_data = dict(roadmap.data) if isinstance(roadmap.data, dict) else {}
    inner_data = (
        current_data.get("data")
        if isinstance(current_data.get("data"), dict)
        else current_data
    )

    inner_data[target_key] = request.data
    roadmap.data = dict(current_data)
    flag_modified(roadmap, "data")
    db.commit()
    db.refresh(roadmap)

    return {
        "success": True,
        "target_key": target_key,
        "section": request.section,
        "roadmap": {
            "id": roadmap.id,
            "original_idea": roadmap.original_idea,
            "created_at": roadmap.created_at.isoformat() if roadmap.created_at else None,
            "data": inner_data,
        },
    }


@app.post("/compare")
def compare_ideas(
    request: CompareRequest,
    current_user: models.User = Depends(get_current_user),
):
    raw_ideas = [i.strip() for i in (request.ideas or []) if i and i.strip()]
    if len(raw_ideas) < 2 or len(raw_ideas) > 3:
        raise HTTPException(
            status_code=400,
            detail="Please provide between 2 and 3 ideas to compare.",
        )

    ideas_formatted = "\n\n".join(
        f"Idea {idx}: {text}" for idx, text in enumerate(raw_ideas, 1)
    )

    system_prompt = (
        "You are an expert technical product advisor and software architect.\n"
        "Your task is to evaluate and compare 2 to 3 software project ideas objectively.\n"
        "Analyze each idea in terms of:\n"
        "- Feasibility level: strictly one of 'beginner', 'intermediate', or 'advanced'\n"
        "- Estimated timeline: realistic development duration in integer weeks\n"
        "- Pros: 2 to 4 distinct key advantages, learning benefits, market or technical feasibility points\n"
        "- Cons: 2 to 4 distinct key challenges, complexity hurdles, third-party dependencies, or pitfalls\n"
        "Then synthesize a rich, balanced recommendation explaining which idea to pick and why, comparing trade-offs across all of them (e.g., for different developer goals like learning vs shipping fast vs portfolio showcase).\n\n"
        "Respond ONLY with a valid JSON object matching this exact structure:\n"
        "{\n"
        '  "comparisons": [\n'
        "    {\n"
        '      "idea": "<exact idea text>",\n'
        '      "feasibility": "beginner|intermediate|advanced",\n'
        '      "estimated_weeks": <integer weeks>,\n'
        '      "pros": ["<pro 1>", "<pro 2>"],\n'
        '      "cons": ["<con 1>", "<con 2>"]\n'
        "    }\n"
        "  ],\n"
        '  "recommendation": "<detailed comparison recommendation explaining which idea to pick and why, comparing tradeoffs across all of them>"\n'
        "}"
    )

    user_prompt = f"Please compare and evaluate these project ideas:\n\n{ideas_formatted}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    try:
        data = call_groq_llm(messages)
        comparisons = (
            data.get("comparisons")
            or data.get("ideas")
            or data.get("comparison")
            or (data if isinstance(data, list) else None)
        )
        if isinstance(comparisons, dict):
            comparisons = list(comparisons.values())

        if not isinstance(comparisons, list) or len(comparisons) < 2:
            raise ValueError("Malformed response: 'comparisons' must be a list with at least 2 entries")

        cleaned_comparisons = []
        for idx, item in enumerate(comparisons):
            original_input_text = raw_ideas[idx] if idx < len(raw_ideas) else item.get("idea", f"Idea {idx+1}")
            cleaned_comparisons.append({
                "idea": original_input_text,
                "feasibility": str(item.get("feasibility", "intermediate")).lower(),
                "estimated_weeks": int(item.get("estimated_weeks", 4)),
                "pros": [str(p) for p in (item.get("pros") or [])],
                "cons": [str(c) for c in (item.get("cons") or [])],
            })

        recommendation = str(data.get("recommendation", "")).strip()
        if not recommendation:
            recommendation = "All compared ideas offer distinct trade-offs. Choose based on your target timeline and desired learning outcomes."

        return {
            "comparisons": cleaned_comparisons,
            "recommendation": recommendation,
        }
    except Exception as exc:
        logger.error(f"Error in /compare endpoint: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "detail": str(exc),
                "message": "Failed to compare project ideas. Please try again.",
            },
        )


@app.post("/plan")
def generate_plan(
    request: IdeaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        previous_answers = request.previous_answers or []
        user_content = f"Project idea: {request.idea}"

        if previous_answers:
            user_content += "\n\nPrevious clarifying answers provided by the user:"
            for idx, ans in enumerate(previous_answers, 1):
                user_content += f"\nQuestion {idx} answer: {ans}"
            user_content += f"\n\nTotal questions answered so far: {len(previous_answers)} of 4."

        is_roadmap_stage = len(previous_answers) >= 4 or any(
            "just generate" in ans.lower() for ans in previous_answers
        )

        if is_roadmap_stage:
            user_content += "\nYou have reached the required questions or user requested generation. Generate the final project roadmap JSON now."
            messages = [
                {"role": "system", "content": ROADMAP_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ]
            roadmap_response = generate_roadmap_with_validation(messages)
            try:
                user_id_val = current_user.id if isinstance(current_user, models.User) else getattr(current_user, "id", None)
                roadmap_record = models.Roadmap(
                    user_id=user_id_val,
                    original_idea=request.idea,
                    data=roadmap_response.get("data", roadmap_response),
                )
                db.add(roadmap_record)
                db.commit()
                db.refresh(roadmap_record)
                roadmap_response["id"] = roadmap_record.id
                if isinstance(roadmap_response.get("data"), dict):
                    roadmap_response["data"]["id"] = roadmap_record.id
            except Exception as db_err:
                logger.error(f"Database save error in roadmap stage: {db_err}", exc_info=True)
                db.rollback()
            return roadmap_response
        else:
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ]
            response = call_groq_llm(messages)
            if response.get("type") == "roadmap":
                errors = validate_roadmap_schema(response)
                if errors:
                    response = generate_roadmap_with_validation(messages)
                try:
                    user_id_val = current_user.id if isinstance(current_user, models.User) else getattr(current_user, "id", None)
                    roadmap_record = models.Roadmap(
                        user_id=user_id_val,
                        original_idea=request.idea,
                        data=response.get("data", response),
                    )
                    db.add(roadmap_record)
                    db.commit()
                    db.refresh(roadmap_record)
                    response["id"] = roadmap_record.id
                    if isinstance(response.get("data"), dict):
                        response["data"]["id"] = roadmap_record.id
                except Exception as db_err:
                    logger.error(f"Database save error in question stage: {db_err}", exc_info=True)
                    db.rollback()
            return response
    except HTTPException as he:
        logger.error(f"HTTP error in /plan endpoint ({he.status_code}): {he.detail}", exc_info=True)
        return JSONResponse(
            status_code=he.status_code,
            content={"error": True, "detail": str(he.detail), "message": "Failed to process project plan. Please try again."}
        )
    except Exception as exc:
        logger.error(f"Unexpected error in /plan endpoint: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": True, "detail": str(exc), "message": "Something went wrong — please try again."}
        )


