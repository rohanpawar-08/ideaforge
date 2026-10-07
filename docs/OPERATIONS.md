# IdeaForge Production Operations & Observability Guide

This document defines the operational architecture, observability standards, failure recovery playbooks, and incident response procedures for IdeaForge in production.

---

## 1. Service Architecture

IdeaForge follows a decoupled client-server architecture:

```
[Browser Client]
       |
       | HTTPS / WSS
       v
[Vercel Frontend Edge CDN]  (Static SPA, React 18, Vite)
       |
       | REST / JSON (CORS enforced, X-Request-ID correlation)
       v
[Render Backend Web Service] (FastAPI, Python 3.12, Uvicorn)
       |                        |
       | PostgreSQL Pool        | HTTPS REST (API key)
       v                        v
[Neon Serverless Postgres]    [Groq Cloud LLM / LLaMA 3.3]
(Pooled / Direct endpoints)   (Fast Inference Engine)
```

---

## 2. Production Components

| Component | Provider | Role | Key Endpoints / Characteristics |
| :--- | :--- | :--- | :--- |
| **Frontend** | Vercel | Single-Page Application (SPA) | Serves HTML/JS/CSS assets. Injects `VITE_API_URL`. |
| **Backend API** | Render | Core REST API & Business Logic | Uvicorn ASGI server running FastAPI on Linux. Health checks at `/health` and `/ready`. |
| **Database** | Neon | Relational persistence | Managed serverless PostgreSQL. Connection pooling via pgBouncer (`-pooler` connection strings). |
| **AI Inference** | Groq | LLM Model Provider | Runs `llama-3.3-70b-versatile` for blueprint generation, chat, and diffs with structured JSON extraction. |
| **Email (Optional)** | Resend / SMTP | Transactional notifications | Dispatches password reset tokens. Falls back safely to terminal/mock logs when disabled. |

---

## 3. Environment Variables Reference

### Backend Production Environment (`Render`)

| Variable | Required | Description / Security Policy |
| :--- | :--- | :--- |
| `APP_ENV` | Yes | Must be set to `production`. Activates strict startup validation and error masking. |
| `APP_VERSION` | Yes | Semantic release version (e.g., `v1.2.0`). Exposed safely at `GET /version`. |
| `SECRET_KEY` | Yes | High-entropy secret for HMAC-SHA256 JWT signing. **Must be at least 32 characters long**. Never commit. |
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string (`postgresql://...`). Must use SSL (`sslmode=require`). |
| `CORS_ORIGINS` | Yes | Strict comma-separated list of allowed origins: `https://ideaforge-steel-alpha.vercel.app`. Wildcard `*` rejected. |
| `GROQ_API_KEY` | Yes | Provider API secret key for Groq Cloud. Never log or expose. |
| `LLM_PROVIDER` | No | Defaults to `groq`. |
| `LLM_MODEL` | No | Target inference model, defaults to `llama-3.3-70b-versatile`. |
| `RENDER` | Auto | Automatically set to `true` by Render platform. Directs client IP resolution to `CF-Connecting-IP`. |
| `RESEND_API_KEY` | Optional | API key for Resend email provider. If empty, email sending falls back safely without failing startup. |
| `FROM_EMAIL` | Optional | Sender address (e.g. `IdeaForge <support@ideaforge.dev>`). |

### Frontend Production Environment (`Vercel`)

| Variable | Required | Description / Security Policy |
| :--- | :--- | :--- |
| `VITE_API_URL` | Yes | Full HTTPS URL pointing to the Render backend service: `https://ideaforge-senx.onrender.com`. **No secrets allowed**. |

---

## 4. Health Checks & Service Readiness

IdeaForge exposes three distinct endpoints for infrastructure probes, uptime monitoring, and release auditing:

### `GET /` — Liveness Probe
- **Purpose**: Low-overhead ping for ingress load balancers and container orchestrators.
- **Payload**:
  ```json
  {
    "status": "online",
    "service": "IdeaForge API",
    "version": "1.0.0"
  }
  ```

### `GET /health` & `GET /ready` — Readiness Probe
- **Purpose**: Verifies that the backend can actively communicate with the database pool.
- **Behavior**: Executes `SELECT 1` on the SQLAlchemy session.
- **Success (HTTP 200)**:
  ```json
  {
    "status": "ready",
    "database": "connected"
  }
  ```
- **Failure (HTTP 503)**:
  ```json
  {
    "status": "error",
    "database": "disconnected"
  }
  ```
  *Note: Error payload masks internal connection strings, usernames, and passwords.*

### `GET /version` — Release Metadata Probe
- **Purpose**: Verifies deployed application version without exposing internal git secrets or paths.
- **Payload**:
  ```json
  {
    "service": "ideaforge-backend",
    "version": "v1.2.0",
    "environment": "production"
  }
  ```

---

## 5. Structured Logging & Sanitization

Logs are emitted using standard Python logging in structured, key-value format for easy parsing by Papertrail, Datadog, or Render log aggregators.

### Log Format
```
YYYY-MM-DD HH:MM:SS,MS [LEVEL] ideaforge: method=POST path=/plan status=200 duration=412.3ms user=42 rid=a9b8c7d6-e5f4
```

### Logged Fields
- `timestamp`: UTC ISO timestamp
- `level`: `INFO`, `WARNING`, `ERROR`, `CRITICAL`
- `method`: HTTP method (`GET`, `POST`, `DELETE`, etc.)
- `path`: Normalized route path (excluding query secrets)
- `status`: HTTP status code returned to client
- `duration`: Execution time in milliseconds (`duration_ms`)
- `user`: Authenticated user ID, or `anon`
- `rid`: Correlated `X-Request-ID`

### Sanitization Policy (Strictly Never Logged)
- Passwords or password hashes
- JWT tokens or bearer headers
- Reset tokens or activation keys
- Database credentials or `DATABASE_URL` strings
- API keys (`GROQ_API_KEY`, `RESEND_API_KEY`, `SECRET_KEY`)
- Full LLM prompt content or complete generated blueprint payloads

---

## 6. Request Correlation (`X-Request-ID`)

1. **Incoming Header**: The frontend or upstream proxy may pass `X-Request-ID`.
2. **Fallback**: If absent, the backend middleware automatically assigns a cryptographically unique UUIDv4.
3. **Response Header**: The `X-Request-ID` is stamped on every outgoing HTTP response header.
4. **Context Propagation**: Request IDs are attached to log lines, error reports, and AI event audit records (`ai_usage_events.request_id`).
5. **Customer Support**: When an unexpected 500 error occurs, the frontend displays `Reference ID: <request_id>`, allowing engineering to locate the exact server trace without exposing stack traces to the user.

---

## 7. AI Quotas & Cost Protection

IdeaForge implements multi-tiered cost protection across all AI-driven endpoints (`/plan`, `/compare`, `/roadmaps/{id}/regenerate`, `/roadmaps/{id}/ask`, `/roadmaps/viva`):

1. **Daily Quotas (UTC-partitioned)**:
   - Blueprint generations: 10 per user per day.
   - Section regenerations: 20 per user per day.
   - Follow-up chats: 30 per user per day.
   - Idea comparisons: 10 per user per day.
   - Viva sessions: 15 per user per day.
2. **Concurrency Locks**:
   - Per-user asyncio mutex prevents race-condition double-generation.
3. **Timeout & Retries**:
   - Upstream Groq timeout configured to 25.0 seconds.
   - Maximum 2 retries on transient network errors (HTTP 429, 502, 503, 504) with exponential backoff.
   - Exactly 1 corrective repair retry if the LLM produces invalid JSON.
4. **Audit Trail**:
   - Every provider attempt is recorded in `ai_usage_events` with token estimates, duration, model, and success flag.

---

## 8. Common Failure Scenarios & Troubleshooting

### Scenario A: Groq Cloud AI Unavailable or Rate Limited
- **Symptoms**: User receives `HTTP 502 Bad Gateway` or `HTTP 504 Gateway Timeout` when generating blueprints.
- **Diagnosis**: Search logs for `ideaforge.ai_service: [AI Event] ... status=502|503|504|timeout`.
- **Mitigation**:
  1. Check Groq status page (status.groq.com).
  2. The service automatically performs exponential backoff and returns friendly notifications to the user without crashing.
  3. If persistent, switch `LLM_MODEL` in Render environment to a fallback model (e.g., `llama-3.1-8b-instant`).

### Scenario B: Neon PostgreSQL Connection Exhaustion
- **Symptoms**: `GET /health` returns `HTTP 503 Service Unavailable`. Logs indicate `psycopg2.OperationalError: FATAL: remaining connection slots are reserved`.
- **Diagnosis**: Backend direct connection limit reached.
- **Mitigation**:
  1. Ensure `DATABASE_URL` uses the Neon connection pooler hostname (`-pooler.eastus2.azure.neon.tech` or `-pooler.us-east-2.aws.neon.tech`).
  2. Verify backend SQLAlchemy pool settings: `pool_size=5`, `max_overflow=10`, `pool_pre_ping=True`.
  3. Restart backend service in Render dashboard if stale connection zombies persist.

### Scenario C: Render Cold Start Delays
- **Symptoms**: First request after inactivity takes 30-50 seconds.
- **Diagnosis**: Render Free tier spins down web services after 15 minutes of inactivity.
- **Mitigation**:
  1. Upgrade backend service to Render Starter / Standard tier for persistent zero-downtime uptime.
  2. Set up an external heartbeat ping (e.g. UptimeRobot or BetterStack) pointing to `GET /health` every 10 minutes.

### Scenario D: CORS Rejection in Browser Console
- **Symptoms**: Browser console reports `Cross-Origin Request Blocked: The Same Origin Policy disallows reading the remote resource`.
- **Diagnosis**: The frontend domain does not match `CORS_ORIGINS`.
- **Mitigation**:
  1. Check Render environment variable `CORS_ORIGINS`.
  2. Ensure exact scheme and domain match without trailing slashes (e.g., `https://ideaforge-steel-alpha.vercel.app`).
  3. Re-deploy backend after modifying environment variables.

### Scenario E: Database Schema Drift or Migration Mismatch
- **Symptoms**: Backend logs throw `UndefinedTable` or `UndefinedColumn` errors on startup or request execution.
- **Diagnosis**: New code deployed before running Alembic migrations.
- **Mitigation**:
  1. Run `python inspect_production_schema.py` in read-only mode to assess delta.
  2. Follow the deployment runbook to run `alembic upgrade head`.

---

## 9. Incident Response Checklist

When an outage or critical degradation occurs:

1. **Triage & Status Check**:
   - Check `GET /health` on the backend.
   - Inspect Render logs for unhandled 500 exceptions or tracebacks.
   - Inspect Vercel deployments tab for build or routing failures.
2. **Correlation Search**:
   - If a customer reported a failure with a Reference ID, search Render logs:
     ```bash
     grep "rid=<REFERENCE_ID>" /var/log/ideaforge.log
     ```
3. **Rollback Decision**:
   - If the issue is introduced by a new code deployment, trigger an immediate Render / Vercel deployment rollback to the previous green commit.
   - Do NOT run database downgrades unless explicitly verified. See [DEPLOYMENT.md](file:///d:/ideaforge/docs/DEPLOYMENT.md) for rollback instructions.

---

## 10. CI/CD Automation & Remote Execution Status

- **Workflows Created**: GitHub Actions workflows have been created in `.github/workflows/`:
  - `backend-ci.yml` (Backend test battery & release safety pre-flight check)
  - `frontend-ci.yml` (Frontend build & automated verification test scripts)
  - `quality.yml` (Dependency checks, Python compilation, Alembic drift inspection)
- **Local Validation**: Workflow configurations and test commands were validated locally.
- **Remote Execution Status**: The workflows have NOT yet executed on GitHub because the branch has not been pushed to remote.
- **Launch Prerequisite**: The first remote CI run on GitHub remains a mandatory launch and release prerequisite prior to deploying any production assets.
