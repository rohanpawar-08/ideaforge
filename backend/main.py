import json
import logging
import os
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from schemas import IdeaRequest
import models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ideaforge")

load_dotenv()

Base.metadata.create_all(bind=engine)

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
    '{"type": "roadmap", "data": {"feasibility": "beginner|intermediate|advanced", "estimated_weeks": <number>, '
    '"recommended_stack": ["<tech>"], '
    '"setup_guide": {"primary_language": "<string>", "editor_recommendation": "<string>", "key_tools": [{"name": "<string>", "purpose": "<string>"}], "getting_started_command": "<string>"}, '
    '"mvp_features": ["<feature>"], "stretch_features": ["<feature>"], '
    '"milestones": [{"week": <number>, "goal": "<goal>", "tasks": ["<task>"]}]}}'
)
STAGE1_SYSTEM_PROMPT = SYSTEM_PROMPT


ROADMAP_SYSTEM_PROMPT = (
    "You are a technical project planning assistant. Based on the user's project idea and previous clarifying answers, "
    "generate a comprehensive and realistic project roadmap.\n\n"
    "CRITICAL REQUIREMENT — Skill Level Consistency:\n"
    "Review the user's stated technical skill level from their previous answers. "
    "Keep the 'setup_guide' (primary language reason, editor recommendation, key tools, and getting started command) "
    "strictly consistent with the user's stated skill level — recommend accessible, beginner-friendly tools/editors (like VS Code or beginner-friendly CLIs) "
    "for beginners, and appropriately advanced tools for more experienced developers.\n\n"
    "Respond ONLY in this exact JSON schema, with no additional commentary or markdown wrapping:\n"
    "{\n"
    '  "type": "roadmap",\n'
    '  "data": {\n'
    '    "feasibility": "beginner|intermediate|advanced",\n'
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


@app.get("/roadmaps")
def get_roadmaps(db: Session = Depends(get_db)):
    try:
        roadmaps = (
            db.query(models.Roadmap)
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
def get_roadmap(roadmap_id: int, db: Session = Depends(get_db)):
    try:
        roadmap = (
            db.query(models.Roadmap)
            .filter(models.Roadmap.id == roadmap_id)
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


@app.post("/plan")
def generate_plan(request: IdeaRequest, db: Session = Depends(get_db)):
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
                roadmap_record = models.Roadmap(
                    original_idea=request.idea,
                    data=roadmap_response.get("data", roadmap_response),
                )
                db.add(roadmap_record)
                db.commit()
                db.refresh(roadmap_record)
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
                    roadmap_record = models.Roadmap(
                        original_idea=request.idea,
                        data=response.get("data", response),
                    )
                    db.add(roadmap_record)
                    db.commit()
                    db.refresh(roadmap_record)
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


