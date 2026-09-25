import requests
import json
import sys
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=== Testing JWT-based Authentication & Authorization ===")
    ts = int(time.time())
    email1 = f"alice_{ts}@example.com"
    email2 = f"bob_{ts}@example.com"
    pwd = "password123"

    # 1. Test Unauthenticated Access (should return 401)
    print("\n--- Test 1: Unauthenticated Endpoints (Expect 401) ---")
    assert requests.get(f"{BASE_URL}/roadmaps").status_code == 401, "Expected 401 for GET /roadmaps without token"
    assert requests.get(f"{BASE_URL}/roadmaps/9999").status_code == 401, "Expected 401 for GET /roadmaps/9999 without token"
    assert requests.post(f"{BASE_URL}/plan", json={"idea": "test"}).status_code == 401, "Expected 401 for POST /plan without token"
    assert requests.post(f"{BASE_URL}/roadmaps/1/regenerate", json={"section": "stack"}).status_code == 401, "Expected 401 for /regenerate without token"
    assert requests.post(f"{BASE_URL}/roadmaps/1/ask", json={"message": "hello"}).status_code == 401, "Expected 401 for /ask without token"
    assert requests.post(f"{BASE_URL}/roadmaps/1/apply-change", json={"section": "stack", "data": []}).status_code == 401, "Expected 401 for /apply-change without token"
    print("[PASS] All protected endpoints rejected unauthenticated requests with HTTP 401.")

    # 2. Test Signup
    print("\n--- Test 2: User Signup (POST /auth/signup) ---")
    signup_resp = requests.post(
        f"{BASE_URL}/auth/signup",
        json={"email": email1, "password": pwd}
    )
    assert signup_resp.status_code == 200, f"Signup failed: {signup_resp.text}"
    signup_data = signup_resp.json()
    assert "access_token" in signup_data, "Missing access_token in signup response"
    token1 = signup_data["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}
    print(f"[PASS] User {email1} registered successfully.")

    # Duplicate signup should fail
    dup_resp = requests.post(f"{BASE_URL}/auth/signup", json={"email": email1, "password": pwd})
    assert dup_resp.status_code == 400, "Expected 400 for duplicate email"
    print("[PASS] Duplicate email rejected with HTTP 400.")

    # 3. Test Login
    print("\n--- Test 3: User Login (POST /auth/login) ---")
    login_fail = requests.post(f"{BASE_URL}/auth/login", json={"email": email1, "password": "wrongpassword"})
    assert login_fail.status_code == 401, "Expected 401 for wrong password"
    print("[PASS] Wrong password rejected with HTTP 401.")

    login_resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email1, "password": pwd})
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"
    token1 = login_resp.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}
    print(f"[PASS] User {email1} logged in successfully.")

    # 4. User 1 generates a roadmap via /plan
    print("\n--- Test 4: User 1 Creates Roadmap (POST /plan) ---")
    plan_resp = requests.post(
        f"{BASE_URL}/plan",
        headers=headers1,
        json={
            "idea": f"A minimalist habit tracker app for Alice ({ts})",
            "previous_answers": ["just generate it"]
        },
        timeout=60
    )
    assert plan_resp.status_code == 200, f"Plan generation failed: {plan_resp.text}"
    roadmap_1_id = plan_resp.json()["id"]
    print(f"Created Roadmap ID: {roadmap_1_id} for User 1.")

    # User 1 lists roadmaps
    user1_roadmaps = requests.get(f"{BASE_URL}/roadmaps", headers=headers1).json()
    assert any(r["id"] == roadmap_1_id for r in user1_roadmaps), "Roadmap 1 not in User 1's list"
    print(f"[PASS] User 1 roadmap list contains roadmap {roadmap_1_id}.")

    # User 1 fetches full roadmap
    resp_r1 = requests.get(f"{BASE_URL}/roadmaps/{roadmap_1_id}", headers=headers1)
    assert resp_r1.status_code == 200, f"Failed to get roadmap 1: {resp_r1.text}"
    print("[PASS] User 1 can view their own roadmap.")

    # 5. Create User 2 and Test Isolation
    print("\n--- Test 5: User 2 Cross-Access Isolation (Expect 404, not 403) ---")
    signup_resp2 = requests.post(
        f"{BASE_URL}/auth/signup",
        json={"email": email2, "password": pwd}
    )
    assert signup_resp2.status_code == 200
    token2 = signup_resp2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # User 2 list should not contain roadmap_1_id
    user2_roadmaps = requests.get(f"{BASE_URL}/roadmaps", headers=headers2).json()
    assert not any(r["id"] == roadmap_1_id for r in user2_roadmaps), "Roadmap 1 leaked into User 2's list!"
    print("[PASS] User 2 roadmap list does NOT contain User 1's roadmap.")

    # User 2 trying to GET User 1's roadmap -> 404 (NOT 403)
    resp_u2_get = requests.get(f"{BASE_URL}/roadmaps/{roadmap_1_id}", headers=headers2)
    assert resp_u2_get.status_code == 404, f"Expected 404 for cross-user GET, got {resp_u2_get.status_code}"
    print("[PASS] User 2 accessing User 1's roadmap returned HTTP 404 (no existence leak).")

    # User 2 trying to POST /regenerate User 1's roadmap -> 404
    resp_u2_regen = requests.post(
        f"{BASE_URL}/roadmaps/{roadmap_1_id}/regenerate",
        headers=headers2,
        json={"section": "stack"}
    )
    assert resp_u2_regen.status_code == 404, f"Expected 404 for cross-user regenerate, got {resp_u2_regen.status_code}"
    print("[PASS] User 2 regenerating User 1's roadmap returned HTTP 404.")

    # User 2 trying to POST /ask User 1's roadmap -> 404
    resp_u2_ask = requests.post(
        f"{BASE_URL}/roadmaps/{roadmap_1_id}/ask",
        headers=headers2,
        json={"message": "can I simplify week 3?"}
    )
    assert resp_u2_ask.status_code == 404, f"Expected 404 for cross-user ask, got {resp_u2_ask.status_code}"
    print("[PASS] User 2 asking on User 1's roadmap returned HTTP 404.")

    # User 2 trying to POST /apply-change User 1's roadmap -> 404
    resp_u2_apply = requests.post(
        f"{BASE_URL}/roadmaps/{roadmap_1_id}/apply-change",
        headers=headers2,
        json={"section": "stack", "data": ["Vue.js"]}
    )
    assert resp_u2_apply.status_code == 404, f"Expected 404 for cross-user apply-change, got {resp_u2_apply.status_code}"
    print("[PASS] User 2 apply-change on User 1's roadmap returned HTTP 404.")

    print("\nALL AUTHENTICATION & AUTHORIZATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
