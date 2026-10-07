import hashlib
import ipaddress
import json
import logging
import os
import re
import secrets
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
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
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
    VivaRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ChangePasswordRequest,
    DeleteAccountRequest,
    MessageResponse,
)
import models
from services import email_service
import blueprint_v2
from blueprint_v2 import (
    ADAPTIVE_CLARIFICATION_SYSTEM_PROMPT,
    V2_BLUEPRINT_SYSTEM_PROMPT,
    is_stop_interrogation_signal,
    is_idea_sufficiently_detailed,
    detect_user_experience_level,
    validate_blueprint_v2_schema,
    normalize_blueprint_v2,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ideaforge")

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is required.")
if len(SECRET_KEY) < 32:
    raise RuntimeError("SECRET_KEY must be at least 32 characters long.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

def get_client_ip(request: Request) -> str:
    raw_ip = request.client.host if request.client else "127.0.0.1"

    if os.getenv("RENDER") == "true":
        cf_ip = request.headers.get("CF-Connecting-IP")
        if cf_ip:
            candidate = cf_ip.strip()
            try:
                ipaddress.ip_address(candidate)
                return candidate
            except ValueError:
                pass

        # Fail closed.
        # Do NOT trust X-Forwarded-For as a fallback.
        # Do NOT trust a caller-controlled forwarded IP.
        return raw_ip

    # For local/non-Render use the direct socket IP.
    return raw_ip


limiter = Limiter(key_func=get_client_ip)

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: int, email: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
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


def get_optional_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    if not auth or not auth.credentials:
        return None
    try:
        payload = decode_access_token(auth.credentials.strip())
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        return db.query(models.User).filter(models.User.id == int(user_id_str)).first()
    except Exception:
        return None



DEFAULT_CORS_ORIGINS = [
    "https://ideaforge-steel-alpha.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

cors_env = os.getenv("CORS_ORIGINS")
if cors_env is not None and cors_env.strip():
    allow_origins = [origin.strip() for origin in cors_env.split(",") if origin.strip() and origin.strip() != "*"]
else:
    allow_origins = DEFAULT_CORS_ORIGINS

app = FastAPI(title="IdeaForge API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        from fastapi.exception_handlers import http_exception_handler
        return await http_exception_handler(request, exc)
    if isinstance(exc, RateLimitExceeded):
        return _rate_limit_exceeded_handler(request, exc)
    logger.error(f"Global unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": "Something went wrong. Please try again."}
    )

LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-oss-20b")

SYSTEM_PROMPT = ADAPTIVE_CLARIFICATION_SYSTEM_PROMPT
STAGE1_SYSTEM_PROMPT = ADAPTIVE_CLARIFICATION_SYSTEM_PROMPT
ROADMAP_SYSTEM_PROMPT = V2_BLUEPRINT_SYSTEM_PROMPT



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


def detect_user_skill_level(answers: list[str], idea: str) -> str:
    return detect_user_experience_level(idea=idea, answers=answers)



KNOWN_BEGINNER_RESOURCES = {
    "react": {
        "explanation": "React is a popular tool for building interactive user interfaces using reusable building blocks called components. In this project, it helps you build a clean, responsive front screen where changes update instantly without reloading the page. Because it is so widely used, you will find thousands of friendly beginner tutorials and answers online.",
        "resource": {
            "name": "Official React Interactive Tutorial (react.dev)",
            "url": "https://react.dev/learn",
            "description": "The official beginner guide with live interactive coding challenges right inside your browser.",
        },
    },
    "next": {
        "explanation": "Next.js is a full-stack framework built on top of React that handles both the web pages and server communication together. In this project, it makes your app load quickly and simplifies organizing your pages and API endpoints in one clean place. It handles heavy lifting like routing and page rendering automatically.",
        "resource": {
            "name": "Next.js Official Learn Course (nextjs.org/learn)",
            "url": "https://nextjs.org/learn",
            "description": "A step-by-step interactive course created by the Next.js team for building modern web apps from scratch.",
        },
    },
    "vue": {
        "explanation": "Vue is an approachable and friendly web framework for building user interfaces. In this project, it powers your dynamic views with clean, readable code that combines HTML, styling, and logic in one file. Many developers love it because it has one of the gentlest learning curves in modern programming.",
        "resource": {
            "name": "Vue.js Official Interactive Tutorial (vuejs.org/tutorial)",
            "url": "https://vuejs.org/tutorial/",
            "description": "An interactive tutorial directly in the official documentation guiding you through core concepts.",
        },
    },
    "node": {
        "explanation": "Node.js allows you to run JavaScript on your computer or server instead of only inside a web browser. In this project, it serves as the engine for your backend, listening for requests from your frontend and saving information to your database. It lets you use one familiar language across your entire project.",
        "resource": {
            "name": "freeCodeCamp Back End Development & APIs Certification",
            "url": "https://www.freecodecamp.org/learn/back-end-development-and-apis/",
            "description": "A completely free, accredited hands-on course covering Node.js and Express backend basics.",
        },
    },
    "express": {
        "explanation": "Express is a minimalist web server library for Node.js that helps you build API endpoints. In this project, it defines the digital doorways where your app sends and receives data like user accounts and project records. It keeps your server logic straightforward and easy to understand.",
        "resource": {
            "name": "MDN Web Docs: Express Web Framework Tutorial",
            "url": "https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs",
            "description": "Mozilla's structured, beginner-accessible guide to building server applications with Express.",
        },
    },
    "python": {
        "explanation": "Python is famous for its clean, English-like syntax that makes it one of the easiest languages to learn and read. In this project, it coordinates your application's logic and data processing without overwhelming you with complex symbols. It is backed by a massive community and rich libraries.",
        "resource": {
            "name": "Python.org Official Beginner's Guide",
            "url": "https://www.python.org/about/gettingstarted/",
            "description": "The official starting portal for newcomers, linking to hands-on interactive tutorials and guides.",
        },
    },
    "fastapi": {
        "explanation": "FastAPI is a modern Python framework for creating web APIs quickly with minimal boilerplate. In this project, it receives incoming requests from your user interface and returns responses with built-in data validation. A huge beginner perk is that it automatically generates a visual web page where you can test your APIs by clicking buttons.",
        "resource": {
            "name": "Official FastAPI Tutorial - User Guide",
            "url": "https://fastapi.tiangolo.com/tutorial/",
            "description": "An exceptionally clear, step-by-step documentation tutorial with complete code examples.",
        },
    },
    "flask": {
        "explanation": "Flask is a lightweight Python web framework that gives you the essentials without dictating rigid rules. In this project, it runs your backend server and routes requests with minimal code. Because it is simple and unopinionated, you can easily understand every line of code you write.",
        "resource": {
            "name": "Flask Mega-Tutorial by Miguel Grinberg",
            "url": "https://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-i-hello-world",
            "description": "The internet's most widely praised free tutorial for learning web development with Flask.",
        },
    },
    "django": {
        "explanation": "Django is a 'batteries-included' Python web framework that includes authentication, database management, and an admin panel out of the box. In this project, it saves you weeks of work by providing ready-to-use security and database features. It helps beginners build robust web applications safely.",
        "resource": {
            "name": "Official Django Girls Tutorial",
            "url": "https://tutorial.djangogirls.org/",
            "description": "A renowned, beginner-friendly walkthrough that takes you from zero to a live deployed web app.",
        },
    },
    "postgresql": {
        "explanation": "PostgreSQL is a powerful, reliable database that stores your information in neatly structured tables, like linked spreadsheets. In this project, it safeguards your user data and records with strict rules so nothing gets lost or corrupted. It is the gold standard database used by companies worldwide.",
        "resource": {
            "name": "PostgreSQL Tutorial for Beginners (postgresqltutorial.com)",
            "url": "https://www.postgresqltutorial.com/",
            "description": "A beginner-focused website offering plain-language explanations of SQL queries and table design.",
        },
    },
    "sqlite": {
        "explanation": "SQLite is a zero-configuration database that saves all your project data into a single simple file on your hard drive. In this project, it gives you full database capabilities without having to install, configure, or run a complex background server. It is the absolute easiest way for beginners to start with SQL.",
        "resource": {
            "name": "SQLite Tutorial (sqlitetutorial.net)",
            "url": "https://www.sqlitetutorial.net/",
            "description": "A beginner-friendly practical guide covering tables, inserts, queries, and joins.",
        },
    },
    "mongodb": {
        "explanation": "MongoDB is a database that stores data in flexible, document-like formats (similar to JSON) instead of rigid tables. In this project, it allows you to save and modify records quickly without having to run formal database migration steps. It is very intuitive if you are already comfortable with JavaScript objects.",
        "resource": {
            "name": "MongoDB University: Introduction to MongoDB",
            "url": "https://learn.mongodb.com/",
            "description": "Free, self-paced courses and video lessons directly from MongoDB's official education team.",
        },
    },
    "prisma": {
        "explanation": "Prisma is an Object-Relational Mapper (ORM) that lets you read and write database records using plain JavaScript/TypeScript instead of raw SQL queries. In this project, it prevents typos and gives you helpful code autocomplete inside your editor for every database column. It also includes Prisma Studio, a visual web browser for clicking and editing database rows.",
        "resource": {
            "name": "Prisma Getting Started Quickstart",
            "url": "https://www.prisma.io/docs/getting-started",
            "description": "A 5-minute interactive tutorial showing how to connect Prisma to a database and query data.",
        },
    },
    "tailwind": {
        "explanation": "Tailwind CSS is a utility-first styling tool that lets you design attractive web pages directly inside your HTML or React code. In this project, it styles buttons, cards, and layouts cleanly without having to write separate complicated CSS files. It includes curated colors and spacing out of the box so your app looks modern right away.",
        "resource": {
            "name": "Tailwind CSS Official Documentation & Screencasts",
            "url": "https://tailwindcss.com/docs",
            "description": "Interactive documentation with live preview examples and official short video tutorials.",
        },
    },
    "typescript": {
        "explanation": "TypeScript is JavaScript with added type definitions that act as a safety net while you code. In this project, your code editor will immediately underline mistakes, missing properties, and typos before you even run your application. It dramatically reduces common beginner bugs.",
        "resource": {
            "name": "TypeScript for the New Programmer (typescriptlang.org)",
            "url": "https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html",
            "description": "The official guide written specifically for people new to programming and types.",
        },
    },
    "docker": {
        "explanation": "Docker packages applications and databases into self-contained boxes called containers so they run identically on any computer. In this project, it lets you spin up a full local database instance with a single command without installing software directly onto your operating system. It eliminates 'it works on my machine' headaches.",
        "resource": {
            "name": "Docker 101 Tutorial & Interactive Desktop Guide",
            "url": "https://www.docker.com/101-tutorial/",
            "description": "A quick visual introduction to containers and how to run local services easily.",
        },
    },
}


def build_beginner_guide_items(stack: list[str], idea: str) -> list[dict]:
    items = []
    for tech_str in stack:
        if not isinstance(tech_str, str) or not tech_str.strip():
            continue
        raw = tech_str.strip()
        match = re.match(r"^([^(]+)(?:\s*\(([^)]+)\))?", raw)
        name = match.group(1).strip() if match else raw
        role = match.group(2).strip() if match and match.group(2) else ""
        lower = name.lower()

        matched = False
        for key, info in KNOWN_BEGINNER_RESOURCES.items():
            if key in lower:
                items.append({
                    "technology": raw,
                    "explanation": info["explanation"],
                    "learning_resource": info["resource"],
                })
                matched = True
                break

        if not matched:
            items.append({
                "technology": raw,
                "explanation": (
                    f"{name} is a widely adopted developer tool chosen for this project to handle "
                    f"{role.lower() if role else 'core application functionality'}. "
                    f"In this project, it gives you reliable building blocks so you don't have to build everything from scratch. "
                    f"It has an approachable community with plenty of free beginner guides available."
                ),
                "learning_resource": {
                    "name": f"Official {name} Documentation & Guides",
                    "url": "https://developer.mozilla.org/en-US/docs/Learn",
                    "description": f"Official documentation and introductory tutorials to help you understand {name} from the ground up.",
                },
            })
    return items


def call_groq_llm(messages: list[dict]) -> dict:
    if not LLM_API_KEY:
        logger.error("LLM_API_KEY is not configured.")
        raise HTTPException(status_code=500, detail="LLM_API_KEY is not configured")

    for attempt in range(3):
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
            raise HTTPException(status_code=502, detail="LLM API request failed. Please try again later.")

        if resp.status_code == 429:
            logger.warning(f"Groq API 429 rate limit hit on attempt {attempt+1}. Backing off...")
            if attempt < 2:
                time.sleep(12)
                continue
            else:
                raise HTTPException(
                    status_code=429,
                    detail="LLM API rate limit exceeded. Please wait a few seconds and try again.",
                )

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


def generate_roadmap_with_validation(
    messages: list[dict],
    user_skill_level: str = None,
    idea: str = "",
    previous_answers: list[str] = None
) -> dict:
    attempt_messages = list(messages)
    max_retries = 1
    detected_skill = user_skill_level or detect_user_experience_level(idea, previous_answers)

    parsed = None
    errors = []

    for attempt in range(max_retries + 1):
        try:
            parsed = call_groq_llm(attempt_messages)
            errors = validate_blueprint_v2_schema(parsed)
        except (ValueError, HTTPException) as err:
            logger.warning(f"Blueprint generation attempt {attempt + 1} encountered error: {err}")
            errors = [str(err)]
            parsed = None

        if not errors and parsed:
            # Fully normalize and enrich to guarantee all V2 schema fields are present
            return normalize_blueprint_v2(
                parsed,
                idea=idea,
                experience_level=detected_skill,
                previous_answers=previous_answers
            )

        if attempt < max_retries:
            logger.info(f"Retrying blueprint generation after schema/validation errors: {errors}")
            error_details = "\n".join(f"- {err}" for err in errors)
            retry_content = (
                f"Your previous response had blueprint schema errors:\n{error_details}\n\n"
                "Please fix all errors and respond ONLY with valid JSON matching the schema_version: 2 blueprint schema."
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

    # If retries exhausted but we got a parsed dict, defensively normalize it
    if parsed and isinstance(parsed, dict):
        logger.warning("Normalizing partially valid LLM response after retries.")
        return normalize_blueprint_v2(
            parsed,
            idea=idea,
            experience_level=detected_skill,
            previous_answers=previous_answers
        )

    # Safe fallback if completely failed
    logger.error(f"Blueprint generation failed completely: {errors}. Falling back to normalized scaffold.")
    return normalize_blueprint_v2(
        {"type": "roadmap", "data": {}},
        idea=idea,
        experience_level=detected_skill,
        previous_answers=previous_answers
    )


@app.get("/")
def root_status():
    return {"status": "IdeaForge backend is running"}


@app.get("/health")
@app.get("/ready")
def readiness_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as exc:
        logger.error(f"Database readiness check failed: {exc}", exc_info=True)
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "database": "disconnected"},
        )


@app.post("/auth/signup", response_model=TokenResponse)
@limiter.limit("5/minute")
def signup(request: Request, req: UserAuthRequest, db: Session = Depends(get_db)):
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
@limiter.limit("10/minute")
def login(request: Request, req: UserAuthRequest, db: Session = Depends(get_db)):
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


@app.post("/auth/forgot-password", response_model=MessageResponse)
@limiter.limit("5/hour")
def forgot_password(
    request: Request,
    req: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    email = (req.email or "").strip().lower()
    generic_message = "If an account exists for that email, reset instructions have been sent."

    if not email or "@" not in email:
        return {"message": generic_message}

    user = db.query(models.User).filter(models.User.email == email).first()
    if user:
        now_utc = datetime.now(timezone.utc)
        # Invalidate any existing unused reset tokens for this user
        db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.user_id == user.id,
            models.PasswordResetToken.used_at.is_(None),
        ).update({"used_at": now_utc})

        raw_token = secrets.token_urlsafe(32)
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        expires_at = now_utc + timedelta(minutes=30)

        reset_rec = models.PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        db.add(reset_rec)
        db.commit()

        try:
            email_service.send_password_reset_email(user.email, raw_token)
        except Exception as exc:
            logger.error(f"Failed to dispatch password reset email: {exc}")

    return {"message": generic_message}


@app.post("/auth/reset-password", response_model=MessageResponse)
@limiter.limit("10/hour")
def reset_password(
    request: Request,
    req: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    new_password = req.new_password or ""
    if len(new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters.",
        )

    raw_token = (req.token or "").strip()
    if not raw_token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    reset_rec = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token_hash == token_hash)
        .first()
    )

    if not reset_rec or reset_rec.used_at is not None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    now_utc = datetime.now(timezone.utc)
    expires_at = (
        reset_rec.expires_at.replace(tzinfo=timezone.utc)
        if reset_rec.expires_at.tzinfo is None
        else reset_rec.expires_at
    )
    if now_utc > expires_at:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    user = db.query(models.User).filter(models.User.id == reset_rec.user_id).first()
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    user.hashed_password = hash_password(new_password)
    reset_rec.used_at = now_utc

    # Invalidate other unused reset tokens for this user
    db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.user_id == user.id,
        models.PasswordResetToken.used_at.is_(None),
    ).update({"used_at": now_utc})
    db.commit()

    return {
        "message": "Password has been successfully reset. You can now log in with your new password."
    }


@app.post("/auth/change-password", response_model=MessageResponse)
@limiter.limit("5/hour")
def change_password(
    request: Request,
    req: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_password = req.current_password or ""
    new_password = req.new_password or ""

    if not verify_password(current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect.",
        )

    if len(new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters.",
        )

    if new_password == current_password:
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as the current password.",
        )

    current_user.hashed_password = hash_password(new_password)
    db.commit()

    return {"message": "Password changed successfully."}


@app.get("/account")
def get_account(
    current_user: models.User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "created_at": (
            current_user.created_at.isoformat()
            if current_user.created_at
            else None
        ),
    }


@app.get("/account/export")
def export_account_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    roadmaps = (
        db.query(models.Roadmap)
        .filter(models.Roadmap.user_id == current_user.id)
        .order_by(models.Roadmap.created_at.desc(), models.Roadmap.id.desc())
        .all()
    )

    roadmaps_data = []
    for r in roadmaps:
        roadmaps_data.append({
            "id": r.id,
            "original_idea": r.original_idea,
            "data": r.data,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "account": {
            "id": current_user.id,
            "email": current_user.email,
            "created_at": (
                current_user.created_at.isoformat()
                if current_user.created_at
                else None
            ),
        },
        "roadmaps": roadmaps_data,
    }


@app.delete("/account", response_model=MessageResponse)
@limiter.limit("3/hour")
def delete_account(
    request: Request,
    req: DeleteAccountRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(req.password or "", current_user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail="Incorrect password. Account deletion aborted.",
        )

    try:
        # Explicit transaction-safe deletion of user dependencies
        db.query(models.Roadmap).filter(models.Roadmap.user_id == current_user.id).delete()
        db.query(models.PasswordResetToken).filter(
            models.PasswordResetToken.user_id == current_user.id
        ).delete()
        db.delete(current_user)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"Failed to delete account for user {current_user.id}: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to delete account. Please try again.",
        )

    return {"message": "Account and all associated data have been permanently deleted."}



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
            summary_obj = inner_data.get("project_summary") or {}
            feasibility = summary_obj.get("difficulty") or inner_data.get("feasibility", "intermediate")
            estimated_weeks = inner_data.get("estimated_weeks", 4)
            schema_version = inner_data.get("schema_version", 1)

            results.append({
                "id": r.id,
                "original_idea": r.original_idea,
                "summary": {
                    "title": summary_obj.get("title") or r.original_idea,
                    "feasibility": feasibility,
                    "estimated_weeks": estimated_weeks,
                    "schema_version": schema_version,
                    "project_type": summary_obj.get("project_type", "Full-Stack Web App"),
                    "difficulty_breakdown": inner_data.get("difficulty_breakdown"),
                },
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })
        return results
    except Exception as exc:
        logger.error(f"Error fetching roadmaps: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": True, "message": "Failed to fetch roadmaps."}
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
            content={"error": True, "message": "Failed to fetch roadmap."}
        )


@app.post("/roadmaps/{roadmap_id}/regenerate")
@limiter.limit("20/hour")
def regenerate_roadmap_section(
    request: Request,
    roadmap_id: int,
    req: RegenerateRequest,
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

    current_data = dict(roadmap.data) if isinstance(roadmap.data, dict) else {}
    inner_data = (
        current_data.get("data")
        if isinstance(current_data.get("data"), dict)
        else current_data
    )
    is_v2 = inner_data.get("schema_version") == 2 or "implementation_plan" in inner_data

    section_raw = (req.section or "").strip().lower()
    if section_raw in ["stack", "recommended_stack"]:
        target_key = "recommended_stack"
    elif section_raw in ["setup_guide", "setup", "setupguide"]:
        target_key = "setup_guide"
    elif section_raw in ["suggested_schema", "schema", "database", "database_schema", "tables"]:
        target_key = "database" if (is_v2 and "database" in inner_data) else "suggested_schema"
    elif section_raw in ["milestones", "milestone", "implementation_plan", "plan", "build_plan"]:
        target_key = "implementation_plan" if (is_v2 and "implementation_plan" in inner_data) else "milestones"
    elif is_v2 and section_raw in ["architecture", "arch"]:
        target_key = "architecture"
    elif is_v2 and section_raw in ["features", "feature"]:
        target_key = "features"
    elif is_v2 and section_raw in ["testing_plan", "testing"]:
        target_key = "testing_plan"
    elif is_v2 and section_raw in ["security_plan", "security"]:
        target_key = "security_plan"
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid section.",
        )

    original_idea = roadmap.original_idea
    feasibility = inner_data.get("feasibility", "intermediate")
    estimated_weeks = inner_data.get("estimated_weeks", 4)
    current_stack = inner_data.get("recommended_stack", [])
    current_mvp = inner_data.get("mvp_features", [])
    current_stretch = inner_data.get("stretch_features", [])

    previous_answers = req.previous_answers or []
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
            "section": req.section,
            "target_key": target_key,
            "data": updated_section_data,
            "roadmap": {
                "id": roadmap.id,
                "original_idea": roadmap.original_idea,
                "created_at": roadmap.created_at.isoformat() if roadmap.created_at else None,
                "data": inner_data,
            },
        }
    except HTTPException:
        raise
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
                "message": f"Failed to regenerate section {req.section}. Please try again.",
            },
        )


@app.post("/roadmaps/{roadmap_id}/ask")
@limiter.limit("30/hour")
def ask_about_roadmap(
    request: Request,
    roadmap_id: int,
    req: AskRequest,
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

    user_message = (req.message or "").strip()
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
    current_data = dict(roadmap.data) if isinstance(roadmap.data, dict) else {}
    inner_data = (
        current_data.get("data")
        if isinstance(current_data.get("data"), dict)
        else current_data
    )
    is_v2 = inner_data.get("schema_version") == 2 or "implementation_plan" in inner_data

    if section_raw in ["stack", "recommended_stack"]:
        target_key = "recommended_stack"
    elif section_raw in ["setup_guide", "setup", "setupguide"]:
        target_key = "setup_guide"
    elif section_raw in ["suggested_schema", "schema", "database", "database_schema", "tables"]:
        target_key = "database" if (is_v2 and "database" in inner_data) else "suggested_schema"
    elif section_raw in ["milestones", "milestone", "implementation_plan", "plan", "build_plan"]:
        target_key = "implementation_plan" if (is_v2 and "implementation_plan" in inner_data) else "milestones"
    elif is_v2 and section_raw in ["architecture", "arch"]:
        target_key = "architecture"
    elif is_v2 and section_raw in ["features", "feature"]:
        target_key = "features"
    elif is_v2 and section_raw in ["api_design", "api", "apis"]:
        target_key = "api_design"
    elif is_v2 and section_raw in ["testing_plan", "testing"]:
        target_key = "testing_plan"
    elif is_v2 and section_raw in ["security_plan", "security"]:
        target_key = "security_plan"
    elif is_v2 and section_raw in ["screens", "screen"]:
        target_key = "screens"
    else:
        raise HTTPException(
            status_code=400,
            detail="Invalid section.",
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
@limiter.limit("10/hour")
def compare_ideas(
    request: Request,
    req: CompareRequest,
    current_user: models.User = Depends(get_current_user),
):
    raw_ideas = [i.strip() for i in (req.ideas or []) if i and i.strip()]
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
        "Analyze each idea across the following comprehensive dimensions:\n"
        "- Feasibility level: strictly one of 'beginner', 'intermediate', or 'advanced'\n"
        "- Estimated development effort: realistic duration in integer weeks\n"
        "- Technical complexity: strictly one of 'Low', 'Moderate', or 'High'\n"
        "- Learning difficulty: strictly one of 'Low', 'Moderate', or 'Steep'\n"
        "- Portfolio value: strictly one of 'Moderate', 'High', or 'Very High'\n"
        "- Monetization potential: strictly one of 'Low', 'Moderate', or 'High'\n"
        "- Major risks: 2 to 3 specific technical, scope, or operational risks\n"
        "- Pros: 2 to 4 distinct key advantages and feasibility points\n"
        "- Cons: 2 to 4 distinct hurdles, bottlenecks, or edge case challenges\n"
        "Then synthesize a rich, balanced recommendation explaining which idea to pick and why, comparing trade-offs across all of them.\n\n"
        "Respond ONLY with a valid JSON object matching this exact structure:\n"
        "{\n"
        '  "comparisons": [\n'
        "    {\n"
        '      "idea": "<exact idea text>",\n'
        '      "feasibility": "beginner|intermediate|advanced",\n'
        '      "estimated_weeks": <integer weeks>,\n'
        '      "complexity": "Low|Moderate|High",\n'
        '      "learning_difficulty": "Low|Moderate|Steep",\n'
        '      "portfolio_value": "Moderate|High|Very High",\n'
        '      "monetization_potential": "Low|Moderate|High",\n'
        '      "major_risks": ["<risk 1>", "<risk 2>"],\n'
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
                "complexity": str(item.get("complexity", "Moderate")),
                "learning_difficulty": str(item.get("learning_difficulty", "Moderate")),
                "portfolio_value": str(item.get("portfolio_value", "High")),
                "monetization_potential": str(item.get("monetization_potential", "Moderate")),
                "major_risks": [str(r) for r in (item.get("major_risks") or ["Scope creep under tight timelines"])],
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
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error in /compare endpoint: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "message": "Failed to compare project ideas. Please try again.",
            },
        )


def supplement_viva_questions(existing: list[dict], idea: str, data: dict) -> list[dict]:
    results = list(existing)
    existing_q_texts = {q.get("question", "").lower() for q in results}
    
    stack = data.get("recommended_stack", [])
    if isinstance(stack, list):
        stack_items = [s.get("technology", str(s)) if isinstance(s, dict) else str(s) for s in stack]
        stack_text = ", ".join(stack_items)
    else:
        stack_text = str(stack)

    v2_tables = data.get("database", {}).get("tables", []) if isinstance(data.get("database"), dict) else []
    schema = v2_tables or data.get("suggested_schema", []) or []
    table_names = [t.get("name", t.get("table_name", "record")) for t in schema if isinstance(t, dict)]
    primary_table = table_names[0] if table_names else "primary data records"

    fallback_bank = [
        {
            "category": "Architecture & System Design",
            "question": f"How is the overall architecture decoupled between the client and server for this {idea[:40]} application?",
            "model_answer": "The application follows a decoupled client-server architecture. The frontend handles presentation, routing, and user interaction, communicating with the backend exclusively via stateless RESTful JSON APIs. This guarantees clear separation of concerns, independent deployability, and simplified horizontal scaling.",
            "viva_tip": "Highlight the statelessness of the REST endpoints and why decoupling allows changing the frontend framework without rewriting backend business logic.",
        },
        {
            "category": "Tech Stack & Framework Choices",
            "question": f"What were the technical trade-offs in choosing {stack_text or 'the chosen stack'} instead of alternative frameworks?",
            "model_answer": f"The selected stack ({stack_text or 'the chosen stack'}) was chosen for its mature ecosystem, strong developer velocity, active community support, and robust tooling. Compared to heavier alternatives, it minimizes runtime boilerplate while offering optimal performance for asynchronous I/O and relational data integrity.",
            "viva_tip": "Emphasize specific ecosystem advantages like package availability, type safety, and standard community patterns.",
        },
        {
            "category": "Database Design & Data Modeling",
            "question": f"Explain the database normalization level and relationship design for the '{primary_table}' table.",
            "model_answer": f"The database schema is designed adhering to Third Normal Form (3NF) to prevent redundant data storage, insertion anomalies, and update discrepancies. Foreign keys maintain strict referential integrity, while foreign key indices prevent table scan bottlenecks during join operations.",
            "viva_tip": "Walk the examiner through the primary key and foreign key relationships and describe what happens during cascade deletes.",
        },
        {
            "category": "Database Design & Data Modeling",
            "question": "How do you mitigate the N+1 query problem when fetching relational entity data?",
            "model_answer": "The N+1 problem occurs when querying parent records executes 1 query and fetching child relations executes N additional queries. We mitigate this using eager loading (`JOIN FETCH` or ORM `include`/`select_related`) or batched subquery loading, ensuring all related records are fetched in a single efficient query.",
            "viva_tip": "Clearly contrast lazy loading with eager loading and explain how execution plan analysis (EXPLAIN ANALYZE) identifies this.",
        },
        {
            "category": "Security & Implementation",
            "question": "How is authentication state and session persistence secured against XSS and CSRF attacks?",
            "model_answer": "Authentication uses signed JWT tokens with short expiration lifetimes. Sensitive tokens should be stored in HTTP-only, Secure, SameSite cookies to protect against Cross-Site Scripting (XSS). Additionally, CSRF protection tokens and strict CORS policies safeguard against cross-origin unauthorized state-changing requests.",
            "viva_tip": "Mention why storing tokens in localStorage is vulnerable to XSS and why HTTP-only cookies offer superior defense in depth.",
        },
        {
            "category": "Security & Implementation",
            "question": "How does the backend validate incoming user payloads and prevent SQL or NoSQL injection?",
            "model_answer": "Input payloads undergo strict schema-based validation and sanitization using Pydantic / validation schemas before business processing. All database queries utilize parameterized queries and ORM abstractions, ensuring user input is never directly concatenated into raw SQL strings.",
            "viva_tip": "Emphasize parameterized queries as the gold standard against SQL injection over naive regex escaping.",
        },
        {
            "category": "Architecture & System Design",
            "question": "How would you handle asynchronous background processing and rate limiting under peak user traffic?",
            "model_answer": "Time-consuming operations (such as emails, notifications, and scheduled reports) are offloaded to asynchronous task queues (e.g. Celery, BullMQ, or worker threads) backed by a Redis broker. API endpoints implement sliding-window rate limiting to prevent denial-of-service abuse.",
            "viva_tip": "Explain that long-running operations in the HTTP request-response cycle block worker threads, degrading server throughput.",
        },
        {
            "category": "Architecture & System Design",
            "question": "What caching strategies would you apply to optimize response latency as the dataset grows?",
            "model_answer": "We utilize in-memory key-value caching (like Redis) for read-heavy, infrequently changing queries using a Cache-Aside pattern with TTL expiration. Client-side HTTP caching headers (Cache-Control, ETag) also reduce redundant bandwidth consumption.",
            "viva_tip": "Mention the classic dilemma of cache invalidation and how TTLs combined with explicit invalidation upon mutation maintain consistency.",
        },
        {
            "category": "Tech Stack & Framework Choices",
            "question": "Why is client-side state management separated from server-state management?",
            "model_answer": "Client-side state (UI toggles, modal visibility, active filters) is ephemeral and synchronous, whereas server state is asynchronous, cached, and owned remotely. Separating them avoids synchronization desyncs and simplifies caching and error rollback.",
            "viva_tip": "Cite tools like React Query, SWR, or RTK Query as modern examples of dedicated server-state management.",
        },
        {
            "category": "Security & Implementation",
            "question": "What is your strategy for database migrations and schema evolution in production without downtime?",
            "model_answer": "Database migrations follow the Expand and Contract pattern with toolsets like Alembic or Prisma Migrate. Backward-compatible changes (e.g. adding nullable columns) are deployed first, code is transitioned to write to both old and new columns, and obsolete columns are deprecated and removed in subsequent phases.",
            "viva_tip": "Point out that running breaking DDL migrations during deployment locks tables and can crash active backend processes.",
        },
        {
            "category": "Architecture & System Design",
            "question": "How do you handle unhandled exceptions and client-side error boundaries gracefully?",
            "model_answer": "On the backend, global exception middleware catches unhandled errors, logs detailed stack traces with correlation IDs to application monitoring, and returns sanitized, friendly JSON error responses. The frontend wraps component subtrees with React Error Boundaries to prevent full-screen crashes.",
            "viva_tip": "Highlight that internal server stack traces should never leak to external users in production responses for security reasons.",
        },
        {
            "category": "Tech Stack & Framework Choices",
            "question": "What automated testing pyramid strategy would best validate this project before shipping?",
            "model_answer": "A healthy testing pyramid comprises fast unit tests for utility and business functions, integration tests for API endpoints verifying database transactions with test containers, and a concise suite of end-to-end tests for critical user user journeys.",
            "viva_tip": "Explain why unit tests are fast and cheap while end-to-end tests provide high confidence but are slower to run in CI/CD.",
        },
    ]

    for item in fallback_bank:
        if len(results) >= 14:
            break
        if item["question"].lower() not in existing_q_texts:
            item_copy = dict(item)
            item_copy["id"] = len(results) + 1
            results.append(item_copy)
            existing_q_texts.add(item["question"].lower())

    return results


def build_viva_questions_with_llm(idea: str, data: dict) -> list[dict]:
    clean_idea = (idea or "").strip()
    feasibility = data.get("feasibility", "intermediate")
    weeks = data.get("estimated_weeks", 4)
    stack_list = data.get("recommended_stack", [])
    if isinstance(stack_list, list):
        stack_items = [s.get("technology", str(s)) if isinstance(s, dict) else str(s) for s in stack_list]
        stack_str = ", ".join(stack_items)
    else:
        stack_str = str(stack_list)

    schema_summary = []
    v2_tables = data.get("database", {}).get("tables", []) if isinstance(data.get("database"), dict) else []
    suggested_schema = v2_tables or data.get("suggested_schema", []) or []
    if isinstance(suggested_schema, list):
        for table in suggested_schema:
            if isinstance(table, dict):
                t_name = table.get("name") or table.get("table_name", "unnamed_table")
                fields = table.get("fields", [])
                field_names = [f.get("name") for f in fields if isinstance(f, dict) and f.get("name")]
                schema_summary.append(f"{t_name} ({', '.join(field_names)})")
    schema_str = "; ".join(schema_summary) or "Standard relational tables"

    v2_mvp = data.get("features", {}).get("mvp", []) if isinstance(data.get("features"), dict) else []
    mvp_features = v2_mvp or data.get("mvp_features", []) or []
    mvp_items = [f.get("name", str(f)) if isinstance(f, dict) else str(f) for f in mvp_features]
    mvp_str = "\n- ".join(mvp_items) if mvp_items else "Core application features"

    stretch_features = data.get("stretch_features", []) or []
    stretch_str = "\n- ".join(str(f) for f in stretch_features) if isinstance(stretch_features, list) else str(stretch_features)

    pitfalls = data.get("potential_pitfalls", []) or []
    pitfalls_str = "\n- ".join(str(p) for p in pitfalls) if isinstance(pitfalls, list) else str(pitfalls)

    system_prompt = (
        "You are an expert academic examiner, university professor, and principal software architect.\n"
        "Your task is to generate 10 to 15 rigorous, comprehensive, project-specific viva voce questions and technical interview questions that an examiner would ask about this exact project.\n"
        "Questions must directly reference the user's specific project domain, recommended tech stack, database schema tables, architecture, and feature requirements.\n\n"
        "You must cover all 4 of the following technical domains:\n"
        "1. Architecture & System Design (e.g. client-server separation, API contract, scalability, state flow, caching)\n"
        "2. Tech Stack & Framework Choices (e.g. justification for selected libraries/frameworks over alternatives, trade-offs, language features)\n"
        "3. Database Design & Data Modeling (e.g. normalization level, entity relationships, foreign key constraints, indexes, query bottlenecks based on the schema)\n"
        "4. Security, Edge Cases & Implementation (e.g. auth security, token management, sanitization, handling concurrency, error boundaries, failure recovery)\n\n"
        "Respond ONLY with a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "questions": [\n'
        "    {\n"
        '      "id": 1,\n'
        '      "category": "Architecture & System Design",\n'
        '      "question": "<detailed project-specific question>",\n'
        '      "model_answer": "<thorough, articulate technical answer demonstrating deep understanding in 3-5 sentences>",\n'
        '      "viva_tip": "<practical tip on what examiners look for and how to confidently explain this in oral defense>"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    user_prompt = (
        f"Project Idea: {clean_idea}\n"
        f"Complexity: {feasibility} ({weeks} weeks estimated)\n"
        f"Recommended Tech Stack: {stack_str}\n"
        f"Database Schema Entities: {schema_str}\n\n"
        f"Core MVP Features:\n- {mvp_str}\n\n"
        f"Stretch Features:\n- {stretch_str}\n\n"
        f"Potential Pitfalls & Edge Cases:\n- {pitfalls_str}\n\n"
        "Please generate 10 to 15 high-quality, project-specific viva voce questions with model answers and defense tips."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    cleaned_questions = []
    try:
        llm_resp = call_groq_llm(messages)
        questions_raw = (
            llm_resp.get("questions")
            or llm_resp.get("viva_questions")
            or (llm_resp if isinstance(llm_resp, list) else None)
        )

        if isinstance(questions_raw, list):
            for idx, item in enumerate(questions_raw, 1):
                if isinstance(item, dict) and item.get("question"):
                    cleaned_questions.append({
                        "id": item.get("id", idx),
                        "category": str(item.get("category", "Architecture & System Design")),
                        "question": str(item.get("question", "")).strip(),
                        "model_answer": str(item.get("model_answer", item.get("answer", ""))).strip(),
                        "viva_tip": str(item.get("viva_tip", item.get("tip", ""))).strip(),
                    })
    except Exception as llm_err:
        logger.warning(f"Groq viva generation encountered issue: {llm_err}. Using supplement generator.")

    if len(cleaned_questions) >= 10:
        return cleaned_questions

    return supplement_viva_questions(cleaned_questions, clean_idea, data)


@app.post("/roadmaps/viva")
@limiter.limit("10/hour")
def generate_viva_questions_endpoint(
    request: Request,
    req: VivaRequest,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_current_user),
):
    roadmap_data = None
    idea = (req.idea or "").strip()

    if req.roadmap_id:
        query = db.query(models.Roadmap).filter(models.Roadmap.id == req.roadmap_id)
        if current_user:
            query = query.filter(models.Roadmap.user_id == current_user.id)
        record = query.first()
        if record:
            data_val = record.data or {}
            roadmap_data = data_val.get("data", data_val) if isinstance(data_val, dict) else {}
            if not idea:
                idea = record.original_idea or ""

    if not roadmap_data and req.roadmap_data:
        data_val = req.roadmap_data
        roadmap_data = data_val.get("data", data_val) if isinstance(data_val, dict) else data_val

    if not roadmap_data:
        raise HTTPException(status_code=400, detail="Missing roadmap data or valid roadmap_id")

    try:
        questions = build_viva_questions_with_llm(idea, roadmap_data)
        return {
            "idea": idea,
            "count": len(questions),
            "questions": questions,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating viva questions: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "message": "Failed to generate viva questions with AI. Please try again.",
            },
        )


@app.post("/roadmaps/{roadmap_id}/viva")
@limiter.limit("10/hour")
def generate_viva_questions_by_id_endpoint(
    request: Request,
    roadmap_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[models.User] = Depends(get_optional_current_user),
):
    query = db.query(models.Roadmap).filter(models.Roadmap.id == roadmap_id)
    if current_user:
        query = query.filter(models.Roadmap.user_id == current_user.id)
    record = query.first()
    if not record:
        raise HTTPException(status_code=404, detail=f"Roadmap with id {roadmap_id} not found")

    data_val = record.data or {}
    roadmap_data = data_val.get("data", data_val) if isinstance(data_val, dict) else {}
    idea = record.original_idea or ""

    try:
        questions = build_viva_questions_with_llm(idea, roadmap_data)
        return {
            "roadmap_id": roadmap_id,
            "idea": idea,
            "count": len(questions),
            "questions": questions,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error generating viva questions for roadmap {roadmap_id}: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": True,
                "message": "Failed to generate viva questions with AI. Please try again.",
            },
        )


@app.post("/plan")
@limiter.limit("20/hour")
def generate_plan(
    request: Request,
    req: IdeaRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        previous_answers = req.previous_answers or []
        user_content = f"Project idea: {req.idea}"

        if previous_answers:
            user_content += "\n\nPrevious clarifying answers provided by the user:"
            for idx, ans in enumerate(previous_answers, 1):
                user_content += f"\nQuestion {idx} answer: {ans}"
            user_content += f"\n\nTotal questions answered so far: {len(previous_answers)} of 3."

        detected_skill = detect_user_experience_level(req.idea, previous_answers)

        # Stop conditions:
        # Rule C: 0 questions if idea already contains enough information.
        # Rule F: Maximum 3 questions total.
        # Rule H: Stop interrogating if user says "I don't know", "you decide", "just generate", etc.
        has_stop_signal = any(is_stop_interrogation_signal(ans) for ans in previous_answers)
        is_max_questions = len(previous_answers) >= 3
        is_sufficient_idea = (len(previous_answers) == 0 and is_idea_sufficiently_detailed(req.idea))

        is_blueprint_stage = has_stop_signal or is_max_questions or is_sufficient_idea

        if is_blueprint_stage:
            user_content += "\n\nGenerate the complete Project Execution Blueprint (schema_version: 2) JSON now."
            messages = [
                {"role": "system", "content": V2_BLUEPRINT_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ]
            blueprint_response = generate_roadmap_with_validation(
                messages,
                user_skill_level=detected_skill,
                idea=req.idea,
                previous_answers=previous_answers,
            )
            try:
                user_id_val = current_user.id if isinstance(current_user, models.User) else getattr(current_user, "id", None)
                roadmap_record = models.Roadmap(
                    user_id=user_id_val,
                    original_idea=req.idea,
                    data=blueprint_response.get("data", blueprint_response),
                )
                db.add(roadmap_record)
                db.commit()
                db.refresh(roadmap_record)
                blueprint_response["id"] = roadmap_record.id
                blueprint_response["original_idea"] = req.idea
                if isinstance(blueprint_response.get("data"), dict):
                    blueprint_response["data"]["id"] = roadmap_record.id
                    blueprint_response["data"]["original_idea"] = req.idea
            except Exception as db_err:
                logger.error(f"Database save error in blueprint stage: {db_err}", exc_info=True)
                db.rollback()
            blueprint_response["original_idea"] = req.idea
            return blueprint_response
        else:
            messages = [
                {"role": "system", "content": ADAPTIVE_CLARIFICATION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ]
            response = call_groq_llm(messages)
            if response.get("type") == "roadmap":
                blueprint_response = normalize_blueprint_v2(
                    response,
                    idea=req.idea,
                    experience_level=detected_skill,
                    previous_answers=previous_answers,
                )
                try:
                    user_id_val = current_user.id if isinstance(current_user, models.User) else getattr(current_user, "id", None)
                    roadmap_record = models.Roadmap(
                        user_id=user_id_val,
                        original_idea=req.idea,
                        data=blueprint_response.get("data", blueprint_response),
                    )
                    db.add(roadmap_record)
                    db.commit()
                    db.refresh(roadmap_record)
                    blueprint_response["id"] = roadmap_record.id
                    blueprint_response["original_idea"] = req.idea
                    if isinstance(blueprint_response.get("data"), dict):
                        blueprint_response["data"]["id"] = roadmap_record.id
                        blueprint_response["data"]["original_idea"] = req.idea
                except Exception as db_err:
                    logger.error(f"Database save error in question stage: {db_err}", exc_info=True)
                    db.rollback()
                blueprint_response["original_idea"] = req.idea
                return blueprint_response
            else:
                # LLM returned type == 'question'
                q_text = (response.get("text") or "").strip()
                # Rule G: Never ask technical questions (which db, which framework, etc.)
                if any(re.search(pat, q_text.lower()) for pat in [
                    r"\b(which\s*(database|db|framework|library|backend|frontend)\b)",
                    r"\b(what\s*(database|tech\s*stack|framework)\b)",
                ]):
                    logger.info("Intercepted technical question for user. Generating blueprint directly.")
                    return generate_plan(
                        request,
                        IdeaRequest(idea=req.idea, previous_answers=previous_answers + ["you decide"]),
                        db,
                        current_user,
                    )

                return {"type": "question", "text": q_text, "original_idea": req.idea}
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
            content={"error": True, "message": "Something went wrong. Please try again."}
        )


