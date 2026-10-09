import os
import sys
import time
import subprocess
import json
import tempfile
import py_compile
from datetime import datetime, timezone
import requests

TEST_PORT = 8991
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"
VENV_PYTHON = sys.executable if sys.executable else os.path.abspath("backend/.venv/Scripts/python.exe")

# -------------------------------------------------------------
# Embedded Test Server Runner (used when invoked with --server)
# -------------------------------------------------------------
def run_embedded_server(port: int):
    if not os.getenv("SECRET_KEY"):
        os.environ["SECRET_KEY"] = "super_secure_jwt_test_secret_key_2026_ideaforge_at_least_32_chars"

    import uvicorn
    sys.path.insert(0, os.path.abspath("backend"))
    import main

    # Load real sample roadmap and viva data for accurate schema validation
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    with open(os.path.join(root_dir, "sample_generated_roadmap.json"), "r", encoding="utf-8") as f:
        sample_roadmap = json.load(f)
    with open(os.path.join(root_dir, "sample_generated_viva.json"), "r", encoding="utf-8") as f:
        sample_viva = json.load(f)

    # Mock call_groq_llm to avoid consuming external Groq quota during test runs
    def mock_call_groq_llm(messages: list[dict]) -> dict:
        sys_msg = (messages[0].get("content") or "").lower() if messages else ""
        user_msg = (messages[1].get("content") or "").lower() if len(messages) > 1 else ""

        if "trigger_mock_unhandled_llm_error" in user_msg:
            raise RuntimeError("Database connection string postgres://secret_user:secret_pw@host dropped!")

        if "compare and evaluate" in user_msg or "comparisons" in sys_msg:
            return {
                "comparisons": [
                    {
                        "idea": "Idea 1",
                        "feasibility": "beginner",
                        "estimated_weeks": 3,
                        "pros": ["Simple to build", "Fast MVP"],
                        "cons": ["Limited features"]
                    },
                    {
                        "idea": "Idea 2",
                        "feasibility": "intermediate",
                        "estimated_weeks": 6,
                        "pros": ["Scalable design", "Rich ecosystem"],
                        "cons": ["Higher complexity"]
                    }
                ],
                "recommendation": "Idea 1 is recommended for rapid prototyping, Idea 2 for portfolio depth."
            }
        elif "regenerate only the" in sys_msg or "regenerate only the" in user_msg:
            if "recommended_stack" in sys_msg or "recommended tech stack" in sys_msg:
                return {"recommended_stack": ["React", "FastAPI", "PostgreSQL"]}
            elif "setup_guide" in sys_msg:
                return {"setup_guide": sample_roadmap["data"]["setup_guide"]}
            elif "suggested_schema" in sys_msg:
                return {"suggested_schema": sample_roadmap["data"]["suggested_schema"]}
            elif "milestones" in sys_msg:
                return {"milestones": sample_roadmap["data"]["milestones"]}
        elif "viva" in sys_msg or "viva" in user_msg:
            return {"questions": sample_viva["questions"]}
        elif "reply" in sys_msg and "proposed_change" in sys_msg:
            return {
                "reply": "Here is an explanation of the architecture choices in your roadmap.",
                "proposed_change": None
            }
        else:
            return sample_roadmap

    main.call_groq_llm = mock_call_groq_llm

    # Global unhandled error test endpoint
    @main.app.get("/test-unhandled-error")
    def test_unhandled_error():
        raise ValueError("Sensitive internal database connection string leaked!")

    uvicorn.run(main.app, host="127.0.0.1", port=port, log_level="warning")


# -------------------------------------------------------------
# Test Checks
# -------------------------------------------------------------

def check_1_syntax_compile():
    print("\n--- Check 1: Python syntax & compile check ---")
    files_to_check = [
        "backend/main.py",
        "backend/test_security_hardening.py",
    ]
    for f in files_to_check:
        py_compile.compile(f, doraise=True)
        print(f"[PASS] Successfully compiled {f}")


def check_2_and_3_secret_key_startup():
    print("\n--- Checks 2 & 3: Startup SECRET_KEY enforcement ---")
    python_exe = VENV_PYTHON

    # Check 2: Missing / empty SECRET_KEY must fail clearly
    code_empty = "import os; os.environ['SECRET_KEY'] = ''; import main"
    res_empty = subprocess.run([python_exe, "-c", code_empty], cwd="backend", capture_output=True, text=True)
    assert res_empty.returncode != 0, f"Expected error exit code, got {res_empty.returncode}"
    assert "SECRET_KEY environment variable is required" in res_empty.stderr, f"Stderr: {res_empty.stderr}"
    print("[PASS] Check 2: Startup without SECRET_KEY failed clearly with RuntimeError.")

    # Check 2b: Short key (<32 chars)
    code_short = "import os; os.environ['SECRET_KEY'] = 'short_secret_key_123'; import main"
    res_short = subprocess.run([python_exe, "-c", code_short], cwd="backend", capture_output=True, text=True)
    assert res_short.returncode != 0, f"Expected error exit code for short key, got {res_short.returncode}"
    assert "SECRET_KEY must be at least 32 characters long" in res_short.stderr, f"Stderr: {res_short.stderr}"
    print("[PASS] Check 2b: Startup with <32 char SECRET_KEY failed clearly with RuntimeError.")

    # Check 3: Valid SECRET_KEY starts normally
    code_valid = "import os; os.environ['SECRET_KEY'] = 'valid_secret_key_for_ideaforge_production_123456'; import main; print('STARTUP_SUCCESS')"
    res_valid = subprocess.run([python_exe, "-c", code_valid], cwd="backend", capture_output=True, text=True)
    assert res_valid.returncode == 0, f"Expected 0 exit code, got {res_valid.returncode}, stderr: {res_valid.stderr}"
    assert "STARTUP_SUCCESS" in res_valid.stdout
    print("[PASS] Check 3: Startup with valid >=32 char SECRET_KEY starts normally.")


def check_4_jwt_expiry_unit():
    print("\n--- Check 4: JWT Expiration (24 Hours) ---")
    sys.path.insert(0, os.path.abspath("backend"))
    import main
    token = main.create_access_token(user_id=101, email="test_jwt@example.com")
    decoded = main.decode_access_token(token)

    exp_dt = datetime.fromtimestamp(decoded["exp"], tz=timezone.utc)
    now_dt = datetime.now(timezone.utc)
    diff_hours = (exp_dt - now_dt).total_seconds() / 3600.0

    print(f"Decoded token expiry: {diff_hours:.2f} hours from now")
    assert 23.9 <= diff_hours <= 24.1, f"Expected ~24h, got {diff_hours} hours!"
    print("[PASS] Check 4: Token expiration verified to be exactly 24 hours (not 30 days).")


def check_4b_client_ip_resolution():
    print("\n--- Check 4b: Client IP Resolution & Spoofing Protection ---")
    sys.path.insert(0, os.path.abspath("backend"))
    from main import get_client_ip
    from starlette.requests import Request

    def make_req(client_host, headers=None):
        raw_headers = []
        if headers:
            for k, v in headers.items():
                raw_headers.append((k.lower().encode("latin1"), v.encode("latin1")))
        scope = {
            "type": "http",
            "client": (client_host, 12345) if client_host else None,
            "headers": raw_headers,
        }
        return Request(scope)

    # 1. RENDER=true + valid CF-Connecting-IP -> returns CF IP
    os.environ["RENDER"] = "true"
    req1 = make_req("10.226.90.65", {"CF-Connecting-IP": "81.97.145.24", "X-Forwarded-For": "1.2.3.4"})
    assert get_client_ip(req1) == "81.97.145.24"
    print("[PASS] 1. RENDER=true + valid CF-Connecting-IP -> returns CF IP.")

    # 2. RENDER=true + spoofed X-Forwarded-For but NO CF-Connecting-IP -> returns request.client.host
    req2 = make_req("10.226.90.65", {"X-Forwarded-For": "1.2.3.4, 5.6.7.8"})
    assert get_client_ip(req2) == "10.226.90.65", f"Expected client host, got: {get_client_ip(req2)}"
    print("[PASS] 2. RENDER=true + spoofed X-Forwarded-For but NO CF-Connecting-IP -> returns request.client.host (does NOT trust XFF).")

    # 3. RENDER=true + malformed CF-Connecting-IP + spoofed XFF -> returns request.client.host
    req3 = make_req("10.226.90.65", {"CF-Connecting-IP": "not-an-ip", "X-Forwarded-For": "1.2.3.4"})
    assert get_client_ip(req3) == "10.226.90.65", f"Expected client host, got: {get_client_ip(req3)}"
    print("[PASS] 3. RENDER=true + malformed CF-Connecting-IP + spoofed XFF -> returns request.client.host.")

    # 4. local/non-Render + spoofed forwarding headers -> returns request.client.host
    os.environ.pop("RENDER", None)
    req4 = make_req("127.0.0.1", {"CF-Connecting-IP": "1.2.3.4", "X-Forwarded-For": "5.6.7.8"})
    assert get_client_ip(req4) == "127.0.0.1"
    print("[PASS] 4. local/non-Render + spoofed forwarding headers -> returns request.client.host.")

    # Reset RENDER for live server tests
    os.environ["RENDER"] = "true"


def run_live_server_checks():
    repo_root = (
        os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        if os.path.basename(os.path.abspath(os.curdir)) == "backend" or not os.path.exists("backend/alembic.ini")
        else os.path.abspath(os.curdir)
    )
    alembic_ini_path = os.path.join(repo_root, "backend", "alembic.ini")

    # If a valid test DATABASE_URL is set in environment (e.g., CI runner with sqlite:///./ci_test.db),
    # use it and ensure it is migrated to head.
    # Otherwise, create an isolated temporary SQLite database so local tests never touch
    # or depend on pre-existing development databases.
    env_db_url = os.environ.get("DATABASE_URL", "").strip()
    is_temp_db = False
    temp_db_path = None

    if env_db_url.startswith("sqlite://") and "ideaforge.db" not in env_db_url:
        test_db_url = env_db_url
    elif env_db_url.startswith("postgresql://"):
        test_db_url = env_db_url
    else:
        temp_db_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        temp_db_path = temp_db_file.name.replace("\\", "/")
        temp_db_file.close()
        test_db_url = f"sqlite:///{temp_db_path}"
        is_temp_db = True

    # Ensure target test database is migrated to head using Alembic
    mig_env = os.environ.copy()
    mig_env["DATABASE_URL"] = test_db_url
    mig_env["APP_ENV"] = "testing"
    mig_res = subprocess.run(
        [VENV_PYTHON, "-m", "alembic", "-c", alembic_ini_path, "upgrade", "head"],
        capture_output=True,
        text=True,
        cwd=repo_root,
        env=mig_env,
    )
    assert mig_res.returncode == 0, f"Alembic migration failed for test database:\n{mig_res.stderr}\n{mig_res.stdout}"

    print("\nStarting live test server on port", TEST_PORT, "...")
    server_env = os.environ.copy()
    server_env["DATABASE_URL"] = test_db_url
    server_env["APP_ENV"] = "testing"
    server_env["SECRET_KEY"] = "super_secure_jwt_test_secret_key_2026_ideaforge_at_least_32_chars"
    server_env["CORS_ORIGINS"] = "https://ideaforge-steel-alpha.vercel.app,http://localhost:5173,http://127.0.0.1:5173"

    proc = subprocess.Popen(
        [VENV_PYTHON, "backend/test_security_hardening.py", "--server", str(TEST_PORT)],
        cwd=repo_root,
        env=server_env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        text=True,
    )

    # Wait for server to come up
    server_ready = False
    for attempt in range(40):
        time.sleep(0.3)
        if proc.poll() is not None:
            raise RuntimeError(f"Server exited prematurely with code {proc.returncode}.")
        try:
            r = requests.get(f"{BASE_URL}/docs", timeout=1)
            if r.status_code == 200:
                server_ready = True
                break
        except Exception:
            pass

    if not server_ready:
        proc.kill()
        raise RuntimeError(f"Server timed out starting on port {TEST_PORT}.")

    print("Test server is running!")

    try:
        # Check 5: Existing Authentication
        print("\n--- Check 5: Existing Authentication ---")
        # 5a: Protected route without token returns 401
        res_unauth = requests.get(f"{BASE_URL}/roadmaps")
        assert res_unauth.status_code == 401, f"Expected 401 for unauth /roadmaps, got {res_unauth.status_code}"
        print("[PASS] Unauthenticated request to /roadmaps returned 401.")

        # 5b: Valid signup
        ts = int(time.time())
        email = f"user_{ts}@example.com"
        pwd = "securepassword123"
        res_signup = requests.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": pwd})
        assert res_signup.status_code == 200, f"Signup failed: {res_signup.text}"
        token = res_signup.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print(f"[PASS] Valid signup succeeded for {email}.")

        # 5c: Invalid password login returns 401
        res_bad_login = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": "wrong_password"})
        assert res_bad_login.status_code == 401, f"Expected 401 for wrong password, got {res_bad_login.status_code}"
        print("[PASS] Invalid password rejected with HTTP 401.")

        # 5d: Valid login succeeds
        res_login = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": pwd})
        assert res_login.status_code == 200, f"Login failed: {res_login.text}"
        login_token = res_login.json()["access_token"]
        assert login_token, "No access_token returned in login"
        print("[PASS] Valid login succeeded.")

        # Check 6: CORS
        print("\n--- Check 6: CORS Origin Enforcement ---")
        # 6a: Official Vercel origin gets proper Access-Control-Allow-Origin
        res_vercel = requests.options(
            f"{BASE_URL}/roadmaps",
            headers={
                "Origin": "https://ideaforge-steel-alpha.vercel.app",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert res_vercel.headers.get("access-control-allow-origin") == "https://ideaforge-steel-alpha.vercel.app", \
            f"Vercel origin failed CORS: {res_vercel.headers}"
        print("[PASS] Official Vercel origin gets Access-Control-Allow-Origin header.")

        # 6b: Localhost development origin works
        res_local = requests.options(
            f"{BASE_URL}/roadmaps",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert res_local.headers.get("access-control-allow-origin") == "http://localhost:5173", \
            f"Localhost origin failed CORS: {res_local.headers}"
        print("[PASS] Localhost development origin gets Access-Control-Allow-Origin header.")

        # 6c: Unapproved origin does NOT receive allow-origin response
        res_evil = requests.options(
            f"{BASE_URL}/roadmaps",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert res_evil.headers.get("access-control-allow-origin") is None or \
               res_evil.headers.get("access-control-allow-origin") != "https://evil.example", \
            f"Evil origin was unexpectedly allowed! Headers: {res_evil.headers}"
        print("[PASS] Unapproved origin https://evil.example is NOT allowed.")

        # Check 7: Error Sanitization
        print("\n--- Check 7: Error Sanitization ---")
        # 7a: Global unhandled exception handler
        res_err = requests.get(f"{BASE_URL}/test-unhandled-error")
        assert res_err.status_code == 500, f"Expected 500, got {res_err.status_code}"
        err_json = res_err.json()
        assert err_json.get("error") is True, f"Expected error: True, got {err_json}"
        assert err_json.get("message") == "Something went wrong. Please try again.", f"Unexpected message: {err_json}"
        assert "Sensitive internal database" not in res_err.text, "CRITICAL: Raw exception text leaked to client!"
        assert "detail" not in err_json or "Sensitive" not in str(err_json.get("detail")), "CRITICAL: Exception detail leaked!"
        print("[PASS] Unhandled server error sanitized to safe generic payload without internal detail.")

        # 7b: Real IdeaForge endpoint unhandled 500 error sanitization
        res_endpoint_err = requests.post(
            f"{BASE_URL}/compare",
            headers=headers,
            json={"ideas": ["trigger_mock_unhandled_llm_error", "second idea"]}
        )
        assert res_endpoint_err.status_code == 500, f"Expected 500, got {res_endpoint_err.status_code}"
        comp_err_json = res_endpoint_err.json()
        assert comp_err_json.get("error") is True
        assert comp_err_json.get("message") == "Failed to compare project ideas. Please try again."
        assert "secret_pw" not in res_endpoint_err.text, "CRITICAL: Database connection secret leaked from endpoint!"
        assert "detail" not in comp_err_json, "Endpoint still exposes internal detail field!"
        print("[PASS] Real endpoint 500 error sanitized without exposing raw exception detail.")

        # Check 8: Rate Limiting
        print("\n--- Check 8: Rate Limiting ---")
        # 8a: POST /auth/login limit = 10/minute
        print("Testing /auth/login rate limit (10 requests/min/IP)...")
        got_429_login = False
        for i in range(12):
            r = requests.post(f"{BASE_URL}/auth/login", json={"email": "dummy@example.com", "password": "wrong"})
            if r.status_code == 429:
                got_429_login = True
                print(f"Request {i+1} received HTTP 429 Rate Limit Exceeded as expected: {r.text}")
                break
        assert got_429_login, "Expected HTTP 429 on /auth/login after limit exceeded!"
        print("[PASS] Login endpoint rate limiting returns HTTP 429.")

        # 8b: AI endpoint rate limit: POST /compare limit = 10/hour
        print("Testing /compare rate limit (10 requests/hour/IP)...")
        got_429_compare = False
        for i in range(12):
            r = requests.post(
                f"{BASE_URL}/compare",
                headers=headers,
                json={"ideas": ["Idea 1 to build", "Idea 2 to build"]},
            )
            if r.status_code == 429:
                got_429_compare = True
                print(f"Request {i+1} on /compare received HTTP 429 as expected: {r.text}")
                break
        assert got_429_compare, "Expected HTTP 429 on /compare after limit exceeded!"
        print("[PASS] AI endpoint /compare rate limiting returns HTTP 429.")

        # 8c: Proxy IP Isolation (different CF-Connecting-IPs do not block each other)
        print("Testing proxy IP isolation across distinct clients...")
        ip_a = "198.51.100.1"
        ip_b = "198.51.100.2"
        # ip_a makes 5 requests (below limit of 10)
        for _ in range(5):
            r = requests.post(f"{BASE_URL}/auth/login", json={"email": "dummy@example.com", "password": "wrong"}, headers={"CF-Connecting-IP": ip_a})
            assert r.status_code == 401

        # ip_b should also succeed normally (independent counter)
        r_b = requests.post(f"{BASE_URL}/auth/login", json={"email": "dummy@example.com", "password": "wrong"}, headers={"CF-Connecting-IP": ip_b})
        assert r_b.status_code == 401, f"Expected 401 for independent IP_B, got {r_b.status_code}"
        print("[PASS] Proxy clients with different IPs maintain independent rate-limit quotas.")

        # Check 9: Regression Tests across remaining endpoints
        print("\n--- Check 9: Regression Testing ---")
        # 9a: GET /roadmaps (unlimited)
        res_list = requests.get(f"{BASE_URL}/roadmaps", headers=headers)
        assert res_list.status_code == 200, f"GET /roadmaps failed: {res_list.text}"
        print("[PASS] GET /roadmaps works normally.")

        # 9b: POST /plan (generate a roadmap)
        res_plan = requests.post(
            f"{BASE_URL}/plan",
            headers=headers,
            json={"idea": "Modern Task Tracker", "previous_answers": ["just generate it"]},
        )
        assert res_plan.status_code == 200, f"POST /plan failed: {res_plan.text}"
        plan_data = res_plan.json()
        assert "id" in plan_data, f"Missing id in plan response: {plan_data}"
        roadmap_id = plan_data["id"]
        print(f"[PASS] POST /plan successfully generated roadmap ID {roadmap_id}.")

        # 9c: GET /roadmaps/{roadmap_id}
        res_get_r = requests.get(f"{BASE_URL}/roadmaps/{roadmap_id}", headers=headers)
        assert res_get_r.status_code == 200, f"GET /roadmaps/{roadmap_id} failed: {res_get_r.text}"
        print(f"[PASS] GET /roadmaps/{roadmap_id} fetched successfully.")

        # 9d: POST /roadmaps/{roadmap_id}/regenerate
        res_regen = requests.post(
            f"{BASE_URL}/roadmaps/{roadmap_id}/regenerate",
            headers=headers,
            json={"section": "stack"},
        )
        assert res_regen.status_code == 200, f"POST /regenerate failed: {res_regen.text}"
        regen_data = res_regen.json()
        assert "data" in regen_data, f"Regenerate response missing data: {regen_data}"
        print(f"[PASS] POST /roadmaps/{roadmap_id}/regenerate succeeded.")

        # 9e: POST /roadmaps/{roadmap_id}/ask
        res_ask = requests.post(
            f"{BASE_URL}/roadmaps/{roadmap_id}/ask",
            headers=headers,
            json={"message": "Can you explain the stack choices?"},
        )
        assert res_ask.status_code == 200, f"POST /ask failed: {res_ask.text}"
        assert "reply" in res_ask.json()
        print(f"[PASS] POST /roadmaps/{roadmap_id}/ask succeeded.")

        # 9f: POST /roadmaps/{roadmap_id}/apply-change
        res_apply = requests.post(
            f"{BASE_URL}/roadmaps/{roadmap_id}/apply-change",
            headers=headers,
            json={"section": "stack", "data": ["Vue", "FastAPI", "PostgreSQL"]},
        )
        assert res_apply.status_code == 200, f"POST /apply-change failed: {res_apply.text}"
        assert res_apply.json().get("success") is True
        print(f"[PASS] POST /roadmaps/{roadmap_id}/apply-change succeeded.")

        # 9g: POST /roadmaps/{roadmap_id}/viva
        res_viva = requests.post(
            f"{BASE_URL}/roadmaps/{roadmap_id}/viva",
            headers=headers,
        )
        assert res_viva.status_code == 200, f"POST /roadmaps/{roadmap_id}/viva failed: {res_viva.text}"
        assert "questions" in res_viva.json()
        print(f"[PASS] POST /roadmaps/{roadmap_id}/viva succeeded.")

        # 9h: POST /roadmaps/viva
        res_viva_body = requests.post(
            f"{BASE_URL}/roadmaps/viva",
            headers=headers,
            json={"roadmap_id": roadmap_id, "idea": "Modern Task Tracker"},
        )
        assert res_viva_body.status_code == 200, f"POST /roadmaps/viva failed: {res_viva_body.text}"
        assert "questions" in res_viva_body.json()
        print(f"[PASS] POST /roadmaps/viva succeeded.")

        print("\n==================================================")
        print("ALL 9 TEST CHECKS PASSED SUCCESSFULLY!")
        print("==================================================")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except Exception:
            proc.kill()
        if is_temp_db and temp_db_path and os.path.exists(temp_db_path):
            try:
                os.remove(temp_db_path)
            except OSError:
                pass


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--server":
        port_num = int(sys.argv[2]) if len(sys.argv) > 2 else TEST_PORT
        run_embedded_server(port_num)
    else:
        check_1_syntax_compile()
        check_2_and_3_secret_key_startup()
        check_4_jwt_expiry_unit()
        check_4b_client_ip_resolution()
        run_live_server_checks()
