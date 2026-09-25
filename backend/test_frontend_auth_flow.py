import requests
import json
import time
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def test_full_auth_scenarios():
    print("=== Testing Full User Signup, Login, Roadmap Isolation & 401 Flow ===")
    ts = int(time.time())
    email1 = f"e2e_user1_{ts}@test.com"
    email2 = f"e2e_user2_{ts}@test.com"
    password = "password123"

    # Step 1: User 1 Signup
    print(f"\n1. Signing up User 1 ({email1})...")
    res1 = requests.post(f"{BASE_URL}/auth/signup", json={"email": email1, "password": password})
    assert res1.status_code == 200, f"Signup failed: {res1.text}"
    token1 = res1.json()["access_token"]
    assert token1, "No access token received"
    print(f"   [PASS] User 1 signed up successfully. Token received.")

    # Step 2: User 1 generates roadmap
    print(f"\n2. User 1 generating roadmap via POST /plan...")
    headers1 = {"Authorization": f"Bearer {token1}"}
    plan_res = requests.post(
        f"{BASE_URL}/plan",
        json={"idea": "A CLI pomodoro timer in Rust with sound alerts", "previous_answers": ["Beginner", "Rust CLI timer", "2 hours/day", "Audio alerts"]},
        headers=headers1,
        timeout=60
    )
    assert plan_res.status_code == 200, f"Plan creation failed: {plan_res.text}"
    plan_data = plan_res.json()
    assert plan_data.get("type") == "roadmap", f"Expected roadmap type, got {plan_data.get('type')}"
    roadmap_id = plan_data.get("id") or plan_data.get("data", {}).get("id")
    print(f"   [PASS] Roadmap created with ID: {roadmap_id}")

    # Step 3: User 1 logs in
    print(f"\n3. User 1 logging in via POST /auth/login...")
    login_res = requests.post(f"{BASE_URL}/auth/login", json={"email": email1, "password": password})
    assert login_res.status_code == 200
    login_token = login_res.json()["access_token"]
    assert login_token

    # Step 4: User 1 checks history
    print(f"\n4. User 1 fetching history via GET /roadmaps...")
    history_res1 = requests.get(f"{BASE_URL}/roadmaps", headers={"Authorization": f"Bearer {login_token}"})
    assert history_res1.status_code == 200
    history1 = history_res1.json()
    assert any(r["id"] == roadmap_id for r in history1), f"Roadmap {roadmap_id} not in user 1 history"
    print(f"   [PASS] User 1 roadmap is present in history (total {len(history1)} roadmaps).")

    # Step 5: User 2 Signup
    print(f"\n5. Signing up User 2 ({email2})...")
    res2 = requests.post(f"{BASE_URL}/auth/signup", json={"email": email2, "password": password})
    assert res2.status_code == 200
    token2 = res2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}
    print(f"   [PASS] User 2 signed up successfully.")

    # Step 6: User 2 checks history (must be empty, not showing User 1's roadmaps)
    print(f"\n6. User 2 fetching history via GET /roadmaps...")
    history_res2 = requests.get(f"{BASE_URL}/roadmaps", headers=headers2)
    assert history_res2.status_code == 200
    history2 = history_res2.json()
    assert len(history2) == 0, f"Expected empty history for User 2, got: {history2}"
    print(f"   [PASS] User 2 history is completely empty ([]) - user isolation verified.")

    # Step 7: User 2 attempts to access User 1's roadmap by ID (must return 404, not 403)
    print(f"\n7. User 2 accessing User 1's roadmap ({roadmap_id})...")
    detail_res2 = requests.get(f"{BASE_URL}/roadmaps/{roadmap_id}", headers=headers2)
    assert detail_res2.status_code == 404, f"Expected 404, got {detail_res2.status_code}"
    print(f"   [PASS] User 2 access returned 404 (does not leak existence).")

    # Step 8: Verify 401 unauthorized handling
    print(f"\n8. Testing 401 Unauthorized handling...")
    unauth_res = requests.get(f"{BASE_URL}/roadmaps")
    assert unauth_res.status_code == 401, f"Expected 401, got {unauth_res.status_code}"
    invalid_token_res = requests.get(f"{BASE_URL}/roadmaps", headers={"Authorization": "Bearer invalid_token_xyz"})
    assert invalid_token_res.status_code == 401, f"Expected 401, got {invalid_token_res.status_code}"
    print(f"   [PASS] Missing and invalid tokens correctly return 401.")

    print("\nALL END-TO-END AUTH & USER ISOLATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_full_auth_scenarios()
