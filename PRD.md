# PRD — IdeaForge
**Product Requirements Document**
**Version:** 1.0
**Owner:** Rohan Pawar

---

## 1. Problem Statement

Students and early developers frequently have project ideas but don't know
how to convert them into an actionable, scoped, buildable plan. They get
stuck at "what stack should I use," "what's realistic in my timeframe," and
"where do I even start."

## 2. Product Goal

Build a web app where a user describes a rough project idea in plain
language, answers a short set of clarifying questions from an AI, and
receives a structured roadmap: feasibility, tech stack suggestion, MVP
scope, and a week-by-week milestone plan.

## 3. Target User

Students / early-career developers who have an idea but lack the
experience to scope and plan a project on their own — i.e., a version of
the exact problem you personally described.

## 4. Scope

### 4.1 In Scope (v1 / MVP)
- Single-page web app, no login required (v1 is single-user / local use)
- Text input for a raw project idea
- AI-driven clarifying question flow (max 4 questions, one at a time)
- AI-generated roadmap containing:
  - Feasibility level + estimated timeline
  - Recommended tech stack
  - MVP feature list vs. stretch features
  - Week-by-week milestones with tasks
- Roadmap rendered as a readable timeline/checklist (not raw JSON)
- Roadmap saved to a database (PostgreSQL)
- Deployed, publicly accessible link

### 4.2 Out of Scope (v1)
- User accounts / authentication
- Multi-user roadmap sharing or collaboration
- Payment or subscription logic
- Mobile app (web-only, responsive is a nice-to-have, not required)
- Editing a roadmap after generation (regenerate-from-scratch only in v1)

### 4.3 Explicitly Deferred to v2
- PDF export of roadmap
- "Regenerate this section only" controls
- Progress tracking / checking off completed milestones
- Comparing multiple ideas against each other

## 5. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR1 | User can submit a free-text project idea |
| FR2 | System asks up to 4 clarifying questions, one at a time, based on the idea |
| FR3 | System generates a roadmap only after clarifying questions are answered (or user opts to skip ahead) |
| FR4 | Roadmap output must follow a strict JSON schema (see Section 7) so the frontend can render it reliably |
| FR5 | Roadmap is persisted to the database with the original idea text and timestamp |
| FR6 | If the AI response is not valid JSON, the system retries once before showing an error |
| FR7 | Frontend displays the question flow as a simple chat-style interface |
| FR8 | Frontend displays the final roadmap as a week-by-week timeline, not raw text |

## 6. Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR1 | Roadmap generation should complete within ~15 seconds under normal conditions |
| NFR2 | API keys and DB credentials must never be committed to version control (`.env` only) |
| NFR3 | Backend must handle LLM API failures gracefully (no raw 500 errors shown to the user) |
| NFR4 | App must be deployed and reachable via a public URL by project completion |

## 7. Data Contracts

### 7.1 `/plan` request
```json
{
  "idea": "string",
  "previous_answers": ["string", "string"]
}
```

### 7.2 Clarifying question response
```json
{"type": "question", "text": "string"}
```

### 7.3 Roadmap response
```json
{
  "type": "roadmap",
  "data": {
    "feasibility": "beginner | intermediate | advanced",
    "estimated_weeks": 0,
    "recommended_stack": ["string"],
    "mvp_features": ["string"],
    "stretch_features": ["string"],
    "milestones": [
      {"week": 1, "goal": "string", "tasks": ["string"]}
    ]
  }
}
```

### 7.4 Database table — `roadmaps`
| Column | Type |
|--------|------|
| id | integer, primary key |
| original_idea | string |
| data | JSON |
| created_at | timestamp |

## 8. System Architecture

```
User Browser
     |
     v
[React Frontend] --POST /plan--> [FastAPI Backend]
                                        |
                          builds prompt based on
                          previous_answers count
                                        |
                                        v
                              [LLM API: Groq/Gemini]
                                        |
                         validates + parses JSON response
                                        |
                     -----------------------------------
                     |                                 |
              type=question                     type=roadmap
                     |                                 |
              return to frontend          save to PostgreSQL, then
                                             return to frontend
```

## 9. Tech Stack (final)

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | Python + FastAPI |
| Database | PostgreSQL (hosted free via Neon or Supabase) |
| LLM | Groq API or Google Gemini (free tier) |
| Deployment | Backend → Render/Railway, Frontend → Vercel |

## 10. Milestones (delivery plan)

| Milestone | Deliverable |
|-----------|-------------|
| M1 | Backend + frontend skeleton running locally, connected |
| M2 | Clarifying-question flow working end-to-end with real LLM calls |
| M3 | Roadmap generation working, validated against JSON schema |
| M4 | Roadmap persisted to PostgreSQL |
| M5 | Chat-style frontend UI + timeline roadmap display |
| M6 | Error handling for API/LLM failures |
| M7 | Deployed to production, publicly reachable |

## 11. Success Criteria

The project is "done" for resume/demo purposes when:
1. A stranger can open the deployed link, type any idea, answer 4 questions, and receive a sensible roadmap.
2. The roadmap is saved and doesn't break on page refresh.
3. Malformed AI output doesn't crash the app.
4. The README explains the architecture clearly enough to talk through in an interview.
