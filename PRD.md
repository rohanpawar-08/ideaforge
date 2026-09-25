# PRD — IdeaForge
**Product Requirements Document**  
**Version:** 2.0 (Production / Current State)  
**Owner:** Rohan Pawar  
**Live URL:** [https://ideaforge-steel-alpha.vercel.app/](https://ideaforge-steel-alpha.vercel.app/)

---

## 1. Problem Statement

Students and early-career software developers frequently come up with promising project ideas but struggle to bridge the gap between concept and execution. They get blocked by fundamental scoping questions:
- *"Which tech stack is appropriate for my current skill level?"*
- *"What scope is realistic within my available time budget?"*
- *"What should the core MVP include versus optional stretch features?"*
- *"What specific setup commands and tools do I need on Day 1?"*

Without structured guidance, developers either abandon ideas or build without milestones, leading to scope creep and unfinished repositories.

## 2. Product Goal

IdeaForge transforms an unstructured, raw project idea into an actionable, production-grade, week-by-week implementation roadmap. Through an adaptive, conversational AI scoping process, the platform identifies the developer's target audience, core features, skill level, and time budget, generating:
1. Realistic feasibility assessment and timeline estimation.
2. Tailored tech stack recommendation.
3. Practical developer setup guide (language, IDE, key tools, and exact starter command).
4. Clearly separated MVP vs. stretch feature scope.
5. Week-by-week execution milestones with actionable task checklists.
6. Post-generation customization through section regeneration, conversational follow-up iteration, multi-idea comparison, progress tracking, and PDF export.

## 3. Target User

- **Students & Self-Taught Developers:** Building portfolio projects for internships and junior software engineering roles.
- **Early-Career Engineers:** Exploring new frameworks or prototyping side projects with limited weekly hours.
- **Hackathon Participants:** Rapidly scoping MVP vs. stretch features under tight time constraints.

---

## 4. Scope

### 4.1 Implemented & Production Scope (v1 & v2 Features)

The current release represents the full production application, implementing all core features and previously deferred v2 enhancements:

1. **User Authentication & Per-User Data Isolation:**
   - Account registration (`/auth/signup`) and authentication (`/auth/login`) with Bcrypt password hashing.
   - JWT bearer token authentication securing all roadmap and generation endpoints.
   - Per-user roadmap scoping ensuring users only access and modify their own data.
2. **Adaptive Clarifying Flow:**
   - Free-text input for raw project ideas.
   - Context-aware questioning engine (up to 4 questions max, evaluated dynamically).
   - Plain-language explanations with concrete examples when users give vague answers or express uncertainty.
   - "Skip to Roadmap" shortcut allowing instant generation at any point.
3. **Structured Roadmap Generation & Developer Setup Guide:**
   - Feasibility classification (`beginner`, `intermediate`, `advanced`).
   - Development timeline estimation in weeks.
   - Curated tech stack recommendations.
   - Practical developer setup guide with primary language rationale, editor recommendation, companion tools/packages with specific purposes, and a copyable first terminal command.
   - Prioritized MVP features vs. stretch features.
   - Week-by-week milestone schedule with granular task checklists.
4. **Section-Level AI Regeneration:**
   - Dedicated endpoint (`/roadmaps/{id}/regenerate`) to re-generate the Tech Stack, Setup Guide, or Milestones independently while maintaining overall project coherence.
5. **Multi-Idea Comparison Engine:**
   - Dedicated interface and endpoint (`/compare`) allowing users to compare 2 to 3 candidate project ideas side-by-side.
   - Comparative evaluation covering feasibility, timeline, pros, cons, and a synthesized recommendation with direct "Generate Roadmap" handoff.
6. **Contextual Follow-Up Chat ("Ask AI") & Live Plan Mutations:**
   - Embedded interactive assistant (`/roadmaps/{id}/ask`) providing architectural advice, trade-off explanations, and clarification on any part of the roadmap.
   - Automated proposed modification generation for stack, setup guide, or milestones.
   - One-click change application (`/roadmaps/{id}/apply-change`) directly updating the active roadmap in the database.
7. **Interactive Milestone Progress Tracking:**
   - Checkable task items with persistent completion state saved in `localStorage` per roadmap.
   - Real-time animated progress bar showing overall completion percentage.
8. **Roadmap History & Session Persistence:**
   - Persistent roadmap storage in PostgreSQL.
   - Dedicated history view (`/roadmaps`) with cards displaying project idea, feasibility, timeline, and creation timestamp.
   - Full roadmap retrieval (`/roadmaps/{id}`) and seamless session restoration across page reloads.
9. **Client-Side PDF Export:**
   - High-fidelity multi-page PDF generation via `jspdf` containing full roadmap details, setup guides, and task checklists.
10. **Dark / Light Theme System:**
    - Full theme switching with automatic system preference detection (`prefers-color-scheme`) and manual toggle.
11. **Production Deployment:**
    - Backend deployed on cloud container platform (Render / Railway) with PostgreSQL database (Neon / Supabase).
    - Frontend deployed on Vercel with responsive desktop and mobile support.

### 4.2 Out of Scope (Deferred to Future Versions)

- Real-time collaborative multi-user editing (Google Docs-style live cursors).
- Direct GitHub repository initialization via GitHub OAuth / Octokit API.
- Native calendar and task-tracker synchronization (Google Calendar, Linear, Jira, Trello, GitHub Issues).
- Paid subscription tiers or monetization gating.
- Native mobile applications (iOS/Android) — mobile web is supported via responsive layout.

---

## 5. Functional Requirements

| ID | Requirement | Status |
|:---|:---|:---:|
| **FR1** | User can register and log in using email and password with JWT token authentication. | **Implemented** |
| **FR2** | All roadmap generation, viewing, and mutation endpoints require valid Bearer token authentication. | **Implemented** |
| **FR3** | User can submit a raw project idea and receive up to 4 adaptive clarifying questions one at a time. | **Implemented** |
| **FR4** | AI provides plain-language explanations with concrete examples when users give vague answers or ask for guidance. | **Implemented** |
| **FR5** | User can skip the remaining clarifying questions at any time to generate the roadmap immediately. | **Implemented** |
| **FR6** | System produces a strictly validated JSON roadmap matching the target schema (retrying once if malformed). | **Implemented** |
| **FR7** | Generated roadmaps are automatically saved to PostgreSQL linked to the authenticated user ID. | **Implemented** |
| **FR8** | Frontend displays the roadmap as a visual, week-by-week timeline with collapsible weeks and task checklists. | **Implemented** |
| **FR9** | Frontend displays a Developer Setup Guide with language rationale, recommended editor, companion tools, and a 1-click copyable starter command. | **Implemented** |
| **FR10** | User can independently regenerate the Tech Stack, Setup Guide, or Milestones without losing the rest of the roadmap. | **Implemented** |
| **FR11** | User can compare 2 to 3 project ideas simultaneously with feasibility, timeline, pros, cons, and synthesis advice. | **Implemented** |
| **FR12** | User can chat with an AI assistant about their generated roadmap, receive explanations, and apply suggested section changes. | **Implemented** |
| **FR13** | User can check off completed tasks across milestones, with completion state persisted per roadmap and displayed in a progress bar. | **Implemented** |
| **FR14** | User can view their past roadmaps in a history view and click to reload any saved roadmap. | **Implemented** |
| **FR15** | User can export the active roadmap to a cleanly formatted, printable multi-page PDF. | **Implemented** |
| **FR16** | User can toggle between dark and light themes, with system preference detection and localStorage persistence. | **Implemented** |

---

## 6. Non-Functional Requirements

| ID | Requirement | Details |
|:---|:---|:---|
| **NFR1** | **Performance & Latency** | Clarifying question responses within ~2–4 seconds; full roadmap generation within ~10–15 seconds via Groq / Llama-3 acceleration. |
| **NFR2** | **Security & Auth** | Passwords hashed using Bcrypt; stateless JWT tokens with 30-day expiry; CORS restricted; environment credentials excluded from git. |
| **NFR3** | **Data Isolation** | Multi-tenant isolation at the database query level (`user_id == current_user.id`); cross-user data access returns 401/404. |
| **NFR4** | **Schema Resiliency** | Automatic retry on invalid LLM JSON output; backend validation prevents frontend crashes from malformed responses. |
| **NFR5** | **Responsive Design** | Optimized for desktop and mobile displays with clean typography, glassmorphism, and responsive flex/grid layouts. |
| **NFR6** | **Availability** | Production frontend hosted on Vercel CDN; backend running on cloud container infrastructure with PostgreSQL connection pooling. |

---

## 7. Data Contracts & API Specification

All protected endpoints require the HTTP header:  
`Authorization: Bearer <access_token>`

### 7.1 POST `/auth/signup`
Creates a new user account and returns a JWT access token.

**Request:**
```json
{
  "email": "developer@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

### 7.2 POST `/auth/login`
Authenticates existing credentials and returns a JWT access token.

**Request:**
```json
{
  "email": "developer@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

---

### 7.3 POST `/plan`
Handles both Stage 1 (clarifying questions) and Stage 2 (roadmap generation). Requires authentication.

**Request:**
```json
{
  "idea": "An AI-powered recipe planner based on leftover ingredients",
  "previous_answers": [
    "Target audience is busy university students",
    "Core feature is photo recognition of fridge contents",
    "Intermediate Python, beginner React",
    "About 8 hours per week for 1 month"
  ]
}
```

**Stage 1 Response (Question):**
```json
{
  "type": "question",
  "text": "What is your current programming experience and comfort level with web frameworks?"
}
```

**Stage 2 Response (Roadmap):**
```json
{
  "type": "roadmap",
  "id": 42,
  "data": {
    "id": 42,
    "feasibility": "intermediate",
    "difficulty_breakdown": {
      "frontend_complexity": "intermediate",
      "backend_complexity": "intermediate",
      "database_complexity": "beginner",
      "ai_complexity": "intermediate",
      "deployment_complexity": "intermediate"
    },
    "estimated_weeks": 4,
    "recommended_stack": ["FastAPI", "React", "Tailwind CSS", "PostgreSQL", "Google Gemini Vision API"],
    "setup_guide": {
      "primary_language": "Python 3.11 for high-performance async API development and AI integration",
      "editor_recommendation": "VS Code with the Python and ES7+ extensions for seamless full-stack debugging",
      "key_tools": [
        {"name": "Vite", "purpose": "Ultra-fast frontend build tool and dev server"},
        {"name": "Uvicorn", "purpose": "Lightning-fast ASGI web server implementation for FastAPI"},
        {"name": "SQLAlchemy", "purpose": "Object-relational mapping for PostgreSQL database interactions"}
      ],
      "getting_started_command": "npx -y create-vite-app@latest frontend --template react"
    },
    "mvp_features": [
      "Image upload for fridge contents",
      "Recipe generation algorithm based on detected ingredients",
      "Basic bookmarking and ingredient substitution tips"
    ],
    "stretch_features": [
      "Nutritional breakdown and macro tracking",
      "Weekly grocery list auto-generation with export",
      "Expiry date push notifications"
    ],
    "milestones": [
      {
        "week": 1,
        "goal": "Project Setup & Authentication Skeleton",
        "tasks": [
          "Initialize FastAPI backend with database connection",
          "Scaffold React frontend with modern UI components",
          "Verify end-to-end communication via health-check endpoint"
        ]
      },
      {
        "week": 2,
        "goal": "Vision Processing & Core Recipe Engine",
        "tasks": [
          "Integrate Vision API for ingredient identification",
          "Build recipe generation prompt logic",
          "Implement basic error handling for low-quality photos"
        ]
      }
    ]
  }
}
```

---

### 7.4 GET `/roadmaps`
Fetches a list of all saved roadmaps for the authenticated user.

**Response (200 OK):**
```json
[
  {
    "id": 42,
    "original_idea": "An AI-powered recipe planner based on leftover ingredients",
    "summary": {
      "feasibility": "intermediate",
      "estimated_weeks": 4
    },
    "created_at": "2026-09-25T08:30:00Z"
  }
]
```

---

### 7.5 GET `/roadmaps/{roadmap_id}`
Retrieves complete roadmap details for a specific roadmap owned by the authenticated user.

**Response (200 OK):**
```json
{
  "id": 42,
  "original_idea": "An AI-powered recipe planner based on leftover ingredients",
  "created_at": "2026-09-25T08:30:00Z",
  "data": {
    "feasibility": "intermediate",
    "estimated_weeks": 4,
    "recommended_stack": ["FastAPI", "React", "PostgreSQL"],
    "setup_guide": { ... },
    "mvp_features": [ ... ],
    "stretch_features": [ ... ],
    "milestones": [ ... ]
  }
}
```

---

### 7.6 POST `/roadmaps/{roadmap_id}/regenerate`
Regenerates an individual section of the roadmap while preserving the rest of the project context.

**Request:**
```json
{
  "section": "stack",
  "previous_answers": ["Beginner in Python", "Wants to deploy to Vercel"]
}
```
*Valid `section` values: `"stack"`, `"setup_guide"`, `"milestones"`.*

**Response (200 OK):**
```json
{
  "section": "stack",
  "target_key": "recommended_stack",
  "data": ["Next.js", "TypeScript", "Tailwind CSS", "Supabase"],
  "roadmap": {
    "id": 42,
    "original_idea": "...",
    "created_at": "2026-09-25T08:30:00Z",
    "data": { ... }
  }
}
```

---

### 7.7 POST `/roadmaps/{roadmap_id}/ask`
Contextual AI follow-up assistant. Evaluates user inquiry against the active roadmap and optionally generates a structured proposed modification.

**Request:**
```json
{
  "message": "Can we simplify week 1 so I can ship the skeleton in just 2 days?"
}
```

**Response (200 OK):**
```json
{
  "reply": "I streamlined Week 1 to focus strictly on the minimal project scaffolding and an in-memory database mock so you can get the skeleton running in under 48 hours.",
  "proposed_change": {
    "section": "milestones",
    "target_key": "milestones",
    "summary": "Simplified Week 1 tasks to focus on fast scaffolding and mock data",
    "data": [
      {
        "week": 1,
        "goal": "Fast-Track Skeleton & Mock API",
        "tasks": [
          "Create Vite React template with basic layout",
          "Set up FastAPI with mock JSON response",
          "Verify local frontend-to-backend fetch"
        ]
      }
    ]
  }
}
```

---

### 7.8 POST `/roadmaps/{roadmap_id}/apply-change`
Applies a proposed change directly into the active roadmap in the database.

**Request:**
```json
{
  "section": "milestones",
  "data": [
    {
      "week": 1,
      "goal": "Fast-Track Skeleton & Mock API",
      "tasks": [
        "Create Vite React template with basic layout",
        "Set up FastAPI with mock JSON response",
        "Verify local frontend-to-backend fetch"
      ]
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "section": "milestones",
  "target_key": "milestones",
  "roadmap": {
    "id": 42,
    "original_idea": "...",
    "created_at": "2026-09-25T08:30:00Z",
    "data": { ... }
  }
}
```

---

### 7.9 POST `/compare`
Compares 2 to 3 candidate project ideas side-by-side.

**Request:**
```json
{
  "ideas": [
    "AI-powered code snippet search engine with vector embeddings",
    "Peer-to-peer markdown collaborative notes app with WebRTC"
  ]
}
```

**Response (200 OK):**
```json
{
  "comparisons": [
    {
      "idea": "AI-powered code snippet search engine with vector embeddings",
      "feasibility": "intermediate",
      "estimated_weeks": 4,
      "pros": [
        "High recruiter demand for AI/vector search skills",
        "Clear MVP scope with ChromaDB or pgvector"
      ],
      "cons": [
        "LLM API usage costs can scale quickly",
        "Requires data ingestion and chunking pipeline"
      ]
    },
    {
      "idea": "Peer-to-peer markdown collaborative notes app with WebRTC",
      "feasibility": "advanced",
      "estimated_weeks": 6,
      "pros": [
        "Impressive systems/networking portfolio project",
        "Zero server storage costs for peer-to-peer architecture"
      ],
      "cons": [
        "NAT traversal and signaling server complexities",
        "CRDT conflict resolution has a steep learning curve"
      ]
    }
  ],
  "recommendation": "If your primary goal is landing AI engineering interviews, build Idea 1 — it directly showcases practical RAG and embeddings. If you want to demonstrate deep systems understanding, tackle Idea 2."
}
```

---

### 7.10 Database Schema

```sql
-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX ix_users_email ON users (email);
CREATE INDEX ix_users_id ON users (id);

-- Roadmaps Table
CREATE TABLE roadmaps (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    original_idea TEXT NOT NULL,
    data JSON NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX ix_roadmaps_id ON roadmaps (id);
CREATE INDEX ix_roadmaps_user_id ON roadmaps (user_id);
```

---

## 8. System Architecture

```
                                 [ Browser Client ]
                                         │
                   ┌─────────────────────┴─────────────────────┐
                   │               React 18 SPA                │
                   │   • Glassmorphic UI (Vanilla CSS)         │
                   │   • JWT Auth State (localStorage)         │
                   │   • Interactive Milestone Progress Track  │
                   │   • Client-Side PDF Generation (jsPDF)    │
                   │   • Dark / Light Theme Controller         │
                   └─────────────────────┬─────────────────────┘
                                         │ HTTPS / Bearer Token
                                         ▼
                                [ FastAPI Backend ]
                   ┌───────────────────────────────────────────┐
                   │  • HTTPBearer Security & JWT Validation   │
                   │  • Multi-Tenant User Scoping              │
                   │  • Prompt Engineering & Stage Routing     │
                   │  • JSON Schema Enforcement & Auto-Retry   │
                   │  • Roadmap Mutation / Diff Engine         │
                   └───────────────┬───────────┬───────────────┘
                                   │           │
                 SQLAlchemy / ORM  │           │ REST / JSON
                                   ▼           ▼
                         [ PostgreSQL DB ]   [ Groq LLM API ]
                         • users             • Llama-3 / 70b
                         • roadmaps          • Structured JSON Mode
```

---

## 9. Tech Stack Summary

| Layer | Technologies | Justification |
|:---|:---|:---|
| **Frontend** | React 18, Vite, Vanilla CSS, jsPDF | Zero bulky UI framework overhead; custom glassmorphism design system; instant client-side PDF export. |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, Pydantic v2 | High-throughput asynchronous endpoints, strict type-checking, and automatic OpenAPI schema generation. |
| **Security** | PyJWT, Passlib / Bcrypt | Stateless cryptographic JWT tokens; salt-based password hashing for robust user security. |
| **Database** | PostgreSQL, SQLAlchemy 2.0 | Proven relational persistence with native JSON storage for dynamic roadmap payloads and user foreign keys. |
| **AI Inference** | Groq API (Llama 3 / open-source models) | Sub-second token generation latency, high reliability, and JSON formatting compliance. |
| **Hosting** | Vercel (Frontend), Render / Railway (Backend), Neon (DB) | Scalable, cloud-native global edge delivery with continuous deployment via Git. |

---

## 10. Milestones & Delivery Status

| Milestone | Deliverable | Status |
|:---|:---|:---:|
| **M1** | Project skeleton running locally with connected backend and frontend | **Completed** |
| **M2** | Adaptive clarifying-question engine with dynamic context tracking | **Completed** |
| **M3** | Strict JSON schema validation with automated retry logic | **Completed** |
| **M4** | PostgreSQL persistence for generated roadmaps | **Completed** |
| **M5** | Interactive timeline UI with collapsible weeks and setup guide | **Completed** |
| **M6** | Client-side PDF export for offline viewing and sharing | **Completed** |
| **M7** | System-aware dark/light theme switching | **Completed** |
| **M8** | Section-level AI regeneration (Stack, Setup Guide, Milestones) | **Completed** |
| **M9** | Multi-idea comparison engine with synthesis recommendations | **Completed** |
| **M10** | Contextual follow-up chat ("Ask AI") with live roadmap diff application | **Completed** |
| **M11** | JWT Authentication and per-user roadmap data isolation | **Completed** |
| **M12** | Production deployment (Vercel + Cloud Backend + Managed DB) | **Completed** |

---

## 11. Success Criteria Evaluation

1. **User Scoping Usability:** Anyone can open the deployed link, submit an idea, navigate the conversational scoping flow, and receive an actionable, week-by-week implementation plan.
2. **Session Persistence:** Roadmaps persist in PostgreSQL and survive page refreshes, tab closures, and cross-session visits.
3. **Data Protection:** Roadmaps are isolated per user; unauthenticated requests are rejected.
4. **Architectural Coherence:** Every generated roadmap provides consistent skill-level alignment across the developer setup guide, tech stack, and milestone breakdown.
5. **Production Readiness:** Comprehensive test suites, robust error handling, schema retries, and high-performance inference ensure zero 500-level crashes under normal operations.
