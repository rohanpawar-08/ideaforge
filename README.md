# IdeaForge

AI-powered tool that turns a rough project idea into a structured, week-by-week
build roadmap through a short clarifying-question conversation.

**Stack:** FastAPI (backend) + React/Vite (frontend) + PostgreSQL (database)

## Folder structure

```
ideaforge/
├── backend/
│   ├── main.py          FastAPI app + /plan endpoint (stub — see PROMPTS.md)
│   ├── database.py       PostgreSQL connection setup
│   ├── models.py         SQLAlchemy table for saved roadmaps
│   ├── schemas.py        Request/response validation
│   ├── requirements.txt
│   └── .env.example      Copy to .env and fill in real keys
├── frontend/
│   ├── src/
│   │   ├── App.jsx        Main UI (stub — see PROMPTS.md)
│   │   ├── App.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── PROMPTS.md            Exact prompts to paste into Antigravity, in order
└── README.md
```

## Before opening in Antigravity

1. **Backend:** `cd backend && pip install -r requirements.txt`
2. **Frontend:** `cd frontend && npm install`
3. Get a free Postgres DB at neon.tech or supabase.com, copy the connection
   string into `backend/.env` (based on `.env.example`)
4. Get a free LLM API key from console.groq.com or aistudio.google.com,
   also into `backend/.env`

## Then

Open this folder in Antigravity and work through `PROMPTS.md` **one step at
a time** — don't paste all steps in a single prompt. Each step is scoped
tightly on purpose to keep agent runs short and avoid wasting tokens on
re-generating things that already work.
