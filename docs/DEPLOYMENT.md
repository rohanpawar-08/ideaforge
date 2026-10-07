# IdeaForge Production Deployment & Rollback Runbook

> **IMPORTANT NOTICE**:  
> This runbook is a standard operating procedure document.  
> **DO NOT EXECUTE PRODUCTION DEPLOYMENT COMMANDS AUTOMATICALLY.** All deployments must be reviewed and executed manually by designated release operators.

---

## 1. Release Order of Operations

To ensure zero downtime and prevent schema-code mismatches, deployments must always follow this strict ordering:

```
[Pre-Deploy Gate]
       │ (CI Green, Working Tree Clean, Pre-flight Passed)
       ▼
[1. Database Migration]
       │ (Alembic Upgrade: Forward Additive Changes)
       ▼
[2. Backend Deployment]
       │ (Render Web Service Rollout, Health & Version Verification)
       ▼
[3. Frontend Deployment]
       │ (Vercel Build & Deploy, CDN Cache Invalidation)
       ▼
[4. Post-Deploy Smoke Verification]
```

---

## 2. Phase 1 — Pre-Deploy Verification

Before touching production infrastructure:

1. **GitHub Actions CI Status**:
   - GitHub Actions workflows have been created (`Backend CI`, `Frontend CI`, and `Quality`).
   - Workflow configuration was validated locally.
   - Note: They have NOT yet executed on GitHub because the branch has not been pushed to remote.
   - First remote CI run remains a mandatory launch/release prerequisite.
2. **Working Tree Cleanliness**:
   - Verify local git status is completely clean with zero uncommitted changes:
     ```bash
     git status --short
     ```
3. **Local Release Pre-Flight Check**:
   - Execute the local offline release verification script:
     ```bash
     python backend/release_check.py
     ```
   - Must output `ALL RELEASE SAFETY PRE-FLIGHT CHECKS PASSED SUCCESSFULLY!`.
4. **Neon Backup & Recovery Verification**:
   - Before production migrations, verify the backup, restore, snapshot, or point-in-time recovery capabilities available for the current Neon plan in the Neon dashboard. Create an appropriate backup/export when required.
5. **Read-Only Schema Inspection**:
   - Inspect the current production schema state using the read-only inspector tool:
     ```bash
     python backend/inspect_production_schema.py
     ```
   - Ensure the current database state matches the expected baseline.

---

## 3. Phase 2 — Database Migration (Additive First)

Database changes must be deployed and verified **before** new backend application code is activated.

1. **Verify Alembic State**:
   - Run Alembic current command against production to inspect the active revision:
     ```bash
     alembic current
     ```
2. **Handle Baseline Stamping (First Launch Only)**:
   - If the database was originally created without Alembic and already contains `users` and `roadmaps` tables matching baseline, stamp baseline first:
     ```bash
     alembic stamp 0001_baseline_schema
     ```
3. **Upgrade Migrations Forward**:
   - Apply pending migrations up to head (`0002_password_reset_tokens` and `0003_ai_usage_tracking`):
     ```bash
     alembic upgrade head
     ```
4. **Verify Applied Revisions**:
   - Confirm migration head is now `0003_ai_usage_tracking`:
     ```bash
     alembic current
     ```
   - Confirm new tables and indexes exist:
     - Table `password_reset_tokens` with index on `token_hash`
     - Table `ai_usage_events` with composite index on `(user_id, created_at)`
     - Column `users.updated_at`

---

## 4. Phase 3 — Backend Deployment (Render)

1. **Configure Environment Variables**:
   - In Render Dashboard under Service Settings > Environment, verify:
     - `APP_ENV=production`
     - `APP_VERSION=<NEW_VERSION_TAG>`
     - `SECRET_KEY` (>=32 characters)
     - `DATABASE_URL` (SSL enabled, pooled connection string)
     - `CORS_ORIGINS=https://ideaforge-steel-alpha.vercel.app`
     - `GROQ_API_KEY`
     - `RENDER=true`
2. **Trigger Deployment**:
   - Trigger Manual Deploy or Push to Render linked production branch.
3. **Monitor Startup Logs**:
   - Observe build and container boot logs.
   - Look for: `[INFO] ideaforge: Startup configuration validated successfully for environment 'production'.`
   - Confirm Uvicorn starts listening on port `$PORT`.
4. **Verify Health Probes**:
   - Probe liveness:
     ```bash
     curl -i https://ideaforge-senx.onrender.com/
     ```
     *Expect HTTP 200 with status "online".*
   - Probe database readiness:
     ```bash
     curl -i https://ideaforge-senx.onrender.com/ready
     ```
     *Expect HTTP 200 with status "ready" and database "connected".*
   - Probe version:
     ```bash
     curl -i https://ideaforge-senx.onrender.com/version
     ```
     *Expect HTTP 200 with matching APP_VERSION.*

---

## 5. Phase 4 — Frontend Deployment (Vercel)

1. **Configure Environment Variables**:
   - In Vercel Project Settings > Environment Variables:
     - `VITE_API_URL=https://ideaforge-senx.onrender.com`
2. **Deploy to Production**:
   - Push to GitHub `main` or run `vercel --prod` through Vercel CLI.
3. **Verify Edge Deployment**:
   - Ensure build succeeds cleanly without bundle or import errors.
   - Confirm static assets are distributed across Vercel edge network.

---

## 6. Phase 5 — Post-Deployment Smoke Test Checklist

Execute the complete end-to-end user journey smoke test in the browser:

- [ ] **1. Authentication**:
  - Sign up with a new test account (`test_release_<timestamp>@example.com`).
  - Log out and log back in to verify JWT generation and storage.
- [ ] **2. Blueprint Generation (V2)**:
  - Submit a new project prompt on `/` (e.g., "Developer book recommendation tracker").
  - Answer clarifying questions or trigger direct technical generation.
  - Verify complete Blueprint V2 renders (Summary, Tech Stack, Milestones, Setup Guide, DB Schema).
- [ ] **3. Roadmap History**:
  - Navigate to `/history` and verify the new roadmap appears in the list.
  - Open roadmap from history and confirm data fidelity.
- [ ] **4. Interactive Features**:
  - Check off a milestone task; refresh page and confirm progress persists in localStorage.
  - Click section regenerate on Tech Stack; verify regeneration succeeds without duplicate quota charge.
  - Send an AI follow-up chat message; verify response streams back.
- [ ] **5. Side-by-Side Comparison**:
  - Navigate to `/compare` and compare two distinct project ideas.
- [ ] **6. Document Exports**:
  - Generate README.md, SRS document, Synopsis, and Viva defense questions.
  - Export PDF and verify clean layout formatting.
- [ ] **7. Account Lifecycle**:
  - Navigate to `/account`.
  - Verify daily AI usage widget displays accurate counts for today's date.
  - Export account data JSON and verify structure.
  - Change account password.
  - Test password reset flow.

---

## 7. Rollback Playbook

When an unexpected critical failure occurs post-deploy, follow these procedures:

### Application Rollback (Code Revert)

1. **Backend Rollback**:
   - In Render Dashboard > Deploys: Locate the previous healthy deploy and click **Rollback**.
   - Render will re-deploy the previous container image within 60 seconds.
2. **Frontend Rollback**:
   - In Vercel Dashboard > Deployments: Locate the previous production deployment and click **Promote to Production**.
   - Rollback is instantaneous via Vercel Edge routing.

### Database Migration Rollback Strategy

> **CRITICAL RULE**:  
> Never blindly run `alembic downgrade` in production. Always assess reversibility and potential data loss first. Prefer a "forward fix" migration whenever possible.

#### Migration `0003_ai_usage_tracking`:
- **Downgrade Impact**: Drops table `ai_usage_events`.
- **Data Loss**: Drops historical audit logs of AI token usage and daily rate metrics. Does NOT damage user accounts, roadmaps, or login credentials.
- **Action**: Only downgrade if `ai_usage_events` causes fatal database engine lockups:
  ```bash
  alembic downgrade 0002_password_reset_tokens
  ```

#### Migration `0002_password_reset_tokens`:
- **Downgrade Impact**: Drops table `password_reset_tokens` and removes column `users.updated_at`.
- **Data Loss**: Drops any pending password reset requests. Users with valid passwords remain completely unaffected.
- **Action**:
  ```bash
  alembic downgrade 0001_baseline_schema
  ```

---

## 8. Backup & Data Safety Guidance

1. **Neon Backup & Recovery Guidance**:
   - Before production migrations, verify the backup, restore, snapshot, or point-in-time recovery capabilities available for the current Neon plan in the Neon dashboard. Create an appropriate backup/export when required.
   - Do not claim or assume plan-specific automated backup, snapshot, or PITR capabilities without confirming the active Neon plan limits in the dashboard.
2. **Pre-Migration Manual Export**:
   - Before executing non-trivial migrations in production, take a logical SQL dump:
     ```bash
     pg_dump "$DATABASE_URL" -F c -b -v -f ideaforge_pre_deploy_backup.dump
     ```
3. **Zero Manual DDL Alterations**:
   - Do NOT execute raw `ALTER TABLE` or `DROP TABLE` commands directly in the Neon SQL editor during regular operations.
   - All schema changes must originate from version-controlled Alembic migrations tested locally first.
