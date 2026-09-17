# Antigravity Prompts — run in this exact order

Rules to save tokens:
- Paste ONE step at a time. Wait for it to finish and test it before the next.
- Don't re-explain the whole project in every prompt — Antigravity already
  sees the full codebase in the folder, so just describe the one change.
- If something breaks, tell it exactly what error you see, don't say
  "it doesn't work" — that costs extra back-and-forth turns.
- Never say "rebuild the project" or "start over" — always say "fix X in
  file Y" so it only touches what's broken.

---

### Step 1 — Verify the skeleton runs
Prompt:
> Run the backend with uvicorn and confirm the `/` and `/plan` endpoints
> respond. Then run the frontend with npm run dev and confirm it loads and
> can call the backend's /plan endpoint successfully. Don't change any code
> yet — just verify and report what you find.

(This costs almost nothing and confirms your local setup is correct before
any real feature work starts.)

---

### Step 2 — Wire up the real LLM call (Stage 1: clarifying questions)
Prompt:
> In backend/main.py, replace the hardcoded response in the /plan endpoint
> with a real call to the LLM API (key is in .env as LLM_API_KEY). Use this
> exact system prompt for the call: [paste the "Stage 1 — Clarifying
> question prompt" from the project spec]. The LLM must ask a maximum of 4
> questions total before returning a roadmap. Track how many questions have
> been asked using the previous_answers field already in the request schema.
> Return the LLM's JSON response directly.

---

### Step 3 — Wire up Stage 2 (roadmap generation)
Prompt:
> When previous_answers has 4 or more entries, switch to the "Stage 2 —
> Roadmap generation prompt" instead: [paste Stage 2 prompt from the spec].
> Validate that the LLM's response is valid JSON matching this schema
> before returning it: [paste the roadmap JSON schema]. If it isn't valid
> JSON, retry the call once before giving up.

---

### Step 4 — Save completed roadmaps to the database
Prompt:
> When the /plan endpoint returns a "roadmap" type response, save it to
> the roadmaps table using the existing Roadmap model in models.py before
> returning it to the frontend.

---

### Step 5 — Build the real chat-style frontend
Prompt:
> Replace the single-shot form in frontend/src/App.jsx with a chat-style
> flow: show each question from the backend one at a time, let the user
> type an answer, send it back to /plan along with previous_answers, and
> repeat until the backend returns a "roadmap" type response. Then render
> the roadmap as a clean timeline showing each week's goal and tasks.

---

### Step 6 — Polish + error handling
Prompt:
> Add basic error handling: show a friendly message in the frontend if the
> backend is unreachable or returns malformed JSON. In the backend, catch
> and log any LLM API failures and return a clear error response instead of
> crashing.

---

### Step 7 — Deploy
Prompt:
> Give me step-by-step instructions to deploy this backend to Render (or
> Railway) and this frontend to Vercel, including which environment
> variables I need to set on each platform.

(Deployment instructions are mostly informational — you can also just ask
me this instead of spending Antigravity tokens on it.)
