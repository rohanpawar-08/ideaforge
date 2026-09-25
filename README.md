# IdeaForge 🚀

> **AI-powered project scoping and roadmap engine that transforms raw software ideas into structured, week-by-week execution plans.**

[![Live Demo](https://img.shields.io/badge/Demo-ideaforge--steel--alpha.vercel.app-blue?style=for-the-badge&logo=vercel)](https://ideaforge-steel-alpha.vercel.app/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Groq](https://img.shields.io/badge/LLM-Groq%20%2F%20Llama--3-F55036?style=for-the-badge)](https://groq.com/)
[![JWT Auth](https://img.shields.io/badge/Security-JWT%20%2B%20Bcrypt-black?style=for-the-badge&logo=jsonwebtokens)](https://jwt.io/)

---

## 🌐 Live Demo

Explore the live application: **[https://ideaforge-steel-alpha.vercel.app/](https://ideaforge-steel-alpha.vercel.app/)**

---

## 💡 Overview

Many developers and students encounter the same bottleneck: they have exciting project ideas but struggle to transition from concept to execution. Questions like *"What stack suits my timeframe?"*, *"What belongs in the MVP vs. stretch scope?"*, and *"What exact commands do I run to start?"* stall momentum.

**IdeaForge** solves this through an intelligent, multi-stage scoping workflow:
1. **Interactive Scoping:** Conducts an adaptive clarifying conversation to identify target users, technical skill level, core feature requirements, and time availability.
2. **Actionable Roadmap:** Generates an end-to-end implementation plan featuring a developer setup guide, curated tech stack, scope boundaries, and week-by-week task breakdowns.
3. **Continuous Iteration:** Allows developers to regenerate individual sections, compare alternative ideas, track progress with interactive checklists, export professional PDFs, and chat directly with an AI project coach to refine their plan.

---

## ✨ Features

### 🎯 Adaptive Clarifying Questions
- Dynamically gathers four critical dimensions: target audience, core MVP feature, user skill level, and weekly time budget.
- Avoids rigid scripts: evaluates user inputs contextually, skips questions if details were already provided, and asks logical follow-ups.
- Detects vague answers, `"I don't know"`, or questions from the user, responding with plain-language explanations and relatable examples before proceeding.
- Includes a **"Skip to Roadmap"** button for developers who want instant plan generation.

### 🗺️ Comprehensive Roadmap & Developer Setup Guide
- **Feasibility & Timeline:** Evaluates complexity (`Beginner`, `Intermediate`, `Advanced`) and projects realistic completion in weeks.
- **Granular Difficulty Breakdown:** In addition to overall feasibility, rates 5 specific complexity dimensions—Frontend, Backend, Database, AI (or N/A), and Deployment—displayed as responsive difficulty badges.
- **Developer Setup Guide:** Provides the primary language choice with clear rationale, editor recommendations, companion tools/packages with specific purposes, and the initial terminal command to kick off the project with a 1-click clipboard copy button.
- **Scope Segmentation:** Separates critical MVP features from optional stretch goals to protect against scope creep.
- **Milestone Breakdown:** Delivers week-by-week execution goals paired with granular, actionable task checklists.

### 🔐 JWT Authentication & Per-User Data Isolation
- Secure user registration (`/auth/signup`) and login (`/auth/login`) using Bcrypt password hashing.
- Stateless JSON Web Tokens (JWT) authenticate all API interactions via Bearer headers.
- Multi-tenant data scoping at the database query level guarantees users only view and modify their own roadmaps.

### 📂 Roadmap History & Session Persistence
- All roadmaps automatically persist to PostgreSQL tied to the user's account.
- Dedicated **History View** displays saved roadmaps with idea titles, feasibility tags, timeline estimates, and timestamps.
- Active roadmaps and task states persist seamlessly across browser tab switches and page refreshes.

### ⚡ Section-Level AI Regeneration
- Need a different tech stack or a revised timeline? Regenerate individual sections—**Tech Stack**, **Setup Guide**, or **Milestones**—independently.
- Preserves the overall project context and constraints while swapping out the target section in-place.

### ⚖️ Multi-Idea Comparison Engine
- Compare 2 to 3 candidate project concepts side-by-side before writing a line of code.
- Generates side-by-side cards analyzing feasibility, timeline, pros, cons, and architectural trade-offs.
- Synthesizes an objective recommendation based on developer goals, with a direct 1-click handoff to generate a full roadmap for the winning idea.

### 💬 Contextual Follow-Up Chat ("Ask AI")
- Embedded AI project advisor with full contextual awareness of your active roadmap.
- Ask architectural questions (*"Why use Redis here?"*, *"How should I organize my database models?"*).
- Instruct the AI to modify sections (*"Simplify week 2 tasks"*, *"Switch from React to Svelte"*).
- The assistant produces a **Proposed Change** preview card that can be applied directly to the live roadmap with a single click.

### ✅ Interactive Milestone Progress Tracking
- Check off individual tasks across milestone weeks as you build.
- Task completion state persists in `localStorage` per roadmap.
- Real-time animated progress bar displays overall milestone completion percentage.

### 📄 Client-Side PDF Export
- Generates clean, professional, publication-ready multi-page PDF documents directly in the browser via `jspdf`.
- Formats roadmap metadata, developer setup guide, MVP scope, and milestone task checklists for easy sharing or offline tracking.

### 🌓 Dynamic Dark / Light Themes
- Sleek glassmorphic interface with tailored modern typography and color palettes.
- Automatically synchronizes with system preference (`prefers-color-scheme`) with instant manual toggle and localStorage persistence.

---

## 🏗️ Architecture Overview

IdeaForge follows a clean, decoupled client-server architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     React 18 SPA                      │  │
│  │  • Responsive Glassmorphic UI (Vanilla CSS)           │  │
│  │  • JWT Auth State & Local Storage Persistence         │  │
│  │  • Interactive Milestone Task Checklist               │  │
│  │  • Client-Side PDF Generation (jsPDF)                 │  │
│  │  • Dark / Light Theme Controller                      │  │
│  └──────────────────────────┬────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │ HTTPS / Bearer Token
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   FastAPI Backend Server                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  • HTTPBearer Security Middleware                     │  │
│  │  • Per-User Authorization & Scoped Queries            │  │
│  │  • Adaptive Clarifying Dialogue Engine                │  │
│  │  • Strict JSON Schema Validation & Auto-Retry         │  │
│  │  • Granular Section Mutation & Diff Engine            │  │
│  └───────────────┬───────────────────────────┬───────────┘  │
└──────────────────┼───────────────────────────┼──────────────┘
                   │                           │
    SQLAlchemy ORM │                           │ REST API
                   ▼                           ▼
        ┌─────────────────────┐     ┌─────────────────────┐
        │    PostgreSQL DB    │     │    Groq LLM API     │
        │  • users            │     │  • Llama-3 / OSS    │
        │  • roadmaps (JSON)  │     │  • Fast inference   │
        └─────────────────────┘     └─────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technologies | Description |
|:---|:---|:---|
| **Frontend** | React 18, Vite, Vanilla CSS, jsPDF | Ultra-fast client application with zero heavy UI framework overhead; custom glassmorphism design system; client-side PDF export. |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, Pydantic v2 | High-performance asynchronous REST API with automatic schema validation and comprehensive OpenAPI documentation. |
| **Authentication** | PyJWT, Passlib / Bcrypt | Salted password hashing and stateless cryptographic Bearer token authentication. |
| **Database** | PostgreSQL, SQLAlchemy 2.0 | Production relational database with JSON storage for dynamic roadmap data and foreign key user isolation. |
| **AI Engine** | Groq API (Llama 3 / open-source models) | High-speed LLM inference delivering structured JSON outputs with schema validation retries. |
| **Deployment** | Vercel (Frontend), Render / Railway (Backend), Neon (Postgres) | Cloud edge static hosting connected to scalable containerized backend services and serverless PostgreSQL. |

---

## 🔌 API Endpoints

| Method | Endpoint | Description | Auth Required |
|:---|:---|:---|:---:|
| `POST` | `/auth/signup` | Register a new account; returns JWT bearer token | No |
| `POST` | `/auth/login` | Authenticate existing credentials; returns JWT bearer token | No |
| `POST` | `/plan` | Submit project idea for clarifying questions or generate full roadmap | Yes |
| `GET` | `/roadmaps` | List all saved roadmaps for the authenticated user | Yes |
| `GET` | `/roadmaps/{id}` | Retrieve complete roadmap data by ID (user-isolated) | Yes |
| `POST` | `/roadmaps/{id}/regenerate` | Regenerate specific section (`stack`, `setup_guide`, `milestones`) | Yes |
| `POST` | `/roadmaps/{id}/ask` | Conversational assistant inquiry with structured change proposal | Yes |
| `POST` | `/roadmaps/{id}/apply-change` | Apply proposed modification directly to the active roadmap | Yes |
| `POST` | `/compare` | Compare 2 to 3 candidate project ideas side-by-side | Yes |
| `GET` | `/` | Backend health and status check | No |

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|:---|:---:|:---|:---|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (`postgresql://user:pass@host:port/dbname`). |
| `LLM_API_KEY` | **Yes** | — | API key for LLM inference (from [console.groq.com](https://console.groq.com) or [aistudio.google.com](https://aistudio.google.com)). |
| `LLM_PROVIDER` | No | `groq` | Provider identifier (`groq` or `gemini`). |
| `LLM_MODEL` | No | `openai/gpt-oss-20b` | Model identifier used for inference calls. |
| `SECRET_KEY` | **Yes** | *fallback provided* | Secret cryptographic key used to sign and verify JWT tokens. |

### Frontend (`frontend/.env`)

| Variable | Required | Default | Description |
|:---|:---:|:---|:---|
| `VITE_API_URL` | No | `http://localhost:8000` | Backend API base URL (set to your deployed backend URL in production). |

---

## 💻 Local Development Setup

### Prerequisites
- **Python:** 3.10 or higher
- **Node.js:** 18 or higher (with `npm`)
- **PostgreSQL Database:** Local instance or free cloud database from [Neon](https://neon.tech) / [Supabase](https://supabase.com)

---

### 1. Clone the Repository
```bash
git clone https://github.com/rohanpawar-08/ideaforge.git
cd ideaforge
```

---

### 2. Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   # Windows (PowerShell)
   python -m venv .venv
   .venv\Scripts\activate

   # macOS / Linux
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Open `.env` and provide your real `DATABASE_URL`, `LLM_API_KEY`, and a secure `SECRET_KEY`.

5. **Start the FastAPI server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   The backend will be running at `http://localhost:8000` (interactive API docs available at `http://localhost:8000/docs`).

---

### 3. Frontend Setup

1. **Open a new terminal and navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables (optional for local):**
   ```bash
   # By default, frontend connects to http://localhost:8000
   # To point to another URL, create a .env file:
   echo VITE_API_URL=http://localhost:8000 > .env
   ```

4. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

### 4. Running Backend Tests

The backend includes comprehensive test suites covering authentication, adaptive scoping, schema validation, section regeneration, follow-up chat, and idea comparison:

```bash
cd backend
python -m pytest
# or run individual test suites:
python test_auth_api.py
python test_adaptive_conversation.py
python test_regenerate_api.py
python test_ask_api.py
python test_compare_api.py
```

---

## 📂 Project Structure

```
ideaforge/
├── backend/
│   ├── main.py                     # FastAPI application, route handlers & LLM prompts
│   ├── database.py                 # SQLAlchemy engine, session maker & Base
│   ├── models.py                   # User & Roadmap relational database models
│   ├── schemas.py                  # Pydantic request/response validation schemas
│   ├── requirements.txt            # Pinned Python package dependencies
│   ├── .env.example                # Template for environment variables
│   └── test_*.py                   # Backend automated test suites
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Main application UI, state & views
│   │   ├── App.css                 # Custom glassmorphic responsive styles
│   │   ├── pdfExport.js            # jsPDF client-side document export engine
│   │   └── main.jsx                # React application entry point
│   ├── index.html                  # HTML5 template & meta tags
│   ├── package.json                # Frontend package dependencies & scripts
│   └── vite.config.js              # Vite bundler configuration
├── PRD.md                          # Product Requirements Document (v2.0)
├── PROMPTS.md                      # Antigravity development prompt history
└── README.md                       # Project overview & documentation
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
