import requests
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=== Testing Follow-up Chat (/ask & /apply-change) ===")

    # 1. Get an existing roadmap
    resp = requests.get(f"{BASE_URL}/roadmaps")
    assert resp.status_code == 200, f"Failed to get roadmaps: {resp.text}"
    roadmaps = resp.json()
    assert len(roadmaps) > 0, "No roadmaps available to test"
    roadmap_id = roadmaps[0]["id"]
    print(f"Testing with Roadmap ID: {roadmap_id}")

    # 2. Test General Question: "why is week 2 focused on auth?"
    print("\n--- Test 1: General Question ('why is week 2 focused on auth?') ---")
    resp_general = requests.post(
        f"{BASE_URL}/roadmaps/{roadmap_id}/ask",
        json={"message": "why is week 2 focused on auth?"},
        timeout=60
    )
    assert resp_general.status_code == 200, f"Ask failed: {resp_general.text}"
    data_general = resp_general.json()
    assert "reply" in data_general, "Response missing 'reply'"
    assert isinstance(data_general["reply"], str) and len(data_general["reply"]) > 20
    print("Assistant Reply:\n", data_general["reply"][:250], "...")
    assert data_general.get("proposed_change") is None, f"Expected proposed_change=None for general question, got: {data_general.get('proposed_change')}"
    print("[PASS] Test 1 Passed: General question produced conversational reply with proposed_change=None.")

    # 3. Test Change Request: "simplify week 3"
    print("\n--- Test 2: Change Request ('simplify week 3') ---")
    resp_change = requests.post(
        f"{BASE_URL}/roadmaps/{roadmap_id}/ask",
        json={"message": "simplify week 3"},
        timeout=60
    )
    assert resp_change.status_code == 200, f"Ask failed: {resp_change.text}"
    data_change = resp_change.json()
    assert "reply" in data_change, "Response missing 'reply'"
    print("Assistant Reply:\n", data_change["reply"][:250], "...")

    proposed = data_change.get("proposed_change")
    assert proposed is not None, "Expected proposed_change to be present for 'simplify week 3'"
    assert proposed.get("section") in ["milestones", "milestone"], f"Expected section='milestones', got: {proposed.get('section')}"
    assert isinstance(proposed.get("data"), list), "Milestones data must be a list"
    assert len(proposed.get("data")) > 0, "Milestones data cannot be empty"
    print(f"Proposed Change Section: {proposed.get('section')}")
    print(f"Summary: {proposed.get('summary')}")
    print("[PASS] Test 2 Passed: Change request produced conversational reply with updated section data.")

    # 4. Test Apply Change: POST /roadmaps/{id}/apply-change
    print("\n--- Test 3: Apply Change Endpoint ---")
    resp_apply = requests.post(
        f"{BASE_URL}/roadmaps/{roadmap_id}/apply-change",
        json={
            "section": proposed["section"],
            "data": proposed["data"]
        },
        timeout=30
    )
    assert resp_apply.status_code == 200, f"Apply change failed: {resp_apply.text}"
    apply_result = resp_apply.json()
    assert apply_result.get("success") is True

    # Verify from DB
    resp_db = requests.get(f"{BASE_URL}/roadmaps/{roadmap_id}")
    assert resp_db.status_code == 200
    db_milestones = resp_db.json()["data"]["milestones"]
    assert json.dumps(db_milestones, sort_keys=True) == json.dumps(proposed["data"], sort_keys=True), "DB milestones did not match applied change!"
    print("[PASS] Test 3 Passed: Applied change successfully persisted in database.")

    print("\nALL FOLLOW-UP CHAT TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
