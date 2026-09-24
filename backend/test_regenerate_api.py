import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=== Testing Section Regeneration API ===")

    # 1. Fetch available roadmaps
    resp = requests.get(f"{BASE_URL}/roadmaps")
    assert resp.status_code == 200, f"Failed to list roadmaps: {resp.text}"
    roadmaps = resp.json()
    if not roadmaps:
        print("No roadmaps found, generating one via /plan...")
        plan_resp = requests.post(
            f"{BASE_URL}/plan",
            json={"idea": "A collaborative markdown notes app for dev teams", "previous_answers": ["just generate it"]}
        )
        assert plan_resp.status_code == 200, f"Failed to generate roadmap: {plan_resp.text}"
        target_id = plan_resp.json()["id"]
    else:
        target_id = roadmaps[0]["id"]

    print(f"Target Roadmap ID: {target_id}")

    # Fetch initial full roadmap
    resp = requests.get(f"{BASE_URL}/roadmaps/{target_id}")
    assert resp.status_code == 200, f"Failed to fetch roadmap: {resp.text}"
    initial_full = resp.json()["data"]

    orig_stack = json.dumps(initial_full.get("recommended_stack", []), sort_keys=True)
    orig_setup = json.dumps(initial_full.get("setup_guide", {}), sort_keys=True)
    orig_milestones = json.dumps(initial_full.get("milestones", []), sort_keys=True)
    orig_feasibility = initial_full.get("feasibility")
    orig_weeks = initial_full.get("estimated_weeks")
    orig_mvp = json.dumps(initial_full.get("mvp_features", []), sort_keys=True)

    print("\n--- Test 1: Regenerate 'stack' ---")
    regen_stack_resp = requests.post(
        f"{BASE_URL}/roadmaps/{target_id}/regenerate",
        json={"section": "stack"}
    )
    assert regen_stack_resp.status_code == 200, f"Stack regen failed: {regen_stack_resp.text}"
    stack_result = regen_stack_resp.json()
    assert "data" in stack_result, "Missing data in response"
    new_stack = stack_result["data"]
    print(f"Old stack: {orig_stack}")
    print(f"New stack: {new_stack}")

    # Fetch from DB to verify persistence and isolation
    db_after_stack = requests.get(f"{BASE_URL}/roadmaps/{target_id}").json()["data"]
    assert json.dumps(db_after_stack.get("recommended_stack"), sort_keys=True) == json.dumps(new_stack, sort_keys=True), "DB stack mismatch"
    assert json.dumps(db_after_stack.get("setup_guide", {}), sort_keys=True) == orig_setup, "Setup guide was unexpectedly changed!"
    assert json.dumps(db_after_stack.get("milestones", []), sort_keys=True) == orig_milestones, "Milestones were unexpectedly changed!"
    assert db_after_stack.get("feasibility") == orig_feasibility, "Feasibility was unexpectedly changed!"
    assert db_after_stack.get("estimated_weeks") == orig_weeks, "Estimated weeks was unexpectedly changed!"
    print("[PASS] Test 1 Passed: 'stack' updated, other sections remained untouched.")

    print("\n--- Test 2: Regenerate 'setup_guide' ---")
    regen_setup_resp = requests.post(
        f"{BASE_URL}/roadmaps/{target_id}/regenerate",
        json={"section": "setup_guide"}
    )
    assert regen_setup_resp.status_code == 200, f"Setup guide regen failed: {regen_setup_resp.text}"
    setup_result = regen_setup_resp.json()
    assert "data" in setup_result, "Missing data in response"
    new_setup = setup_result["data"]
    print(f"New setup guide primary language: {new_setup.get('primary_language')}")

    db_after_setup = requests.get(f"{BASE_URL}/roadmaps/{target_id}").json()["data"]
    assert json.dumps(db_after_setup.get("setup_guide"), sort_keys=True) == json.dumps(new_setup, sort_keys=True), "DB setup_guide mismatch"
    assert json.dumps(db_after_setup.get("recommended_stack"), sort_keys=True) == json.dumps(new_stack, sort_keys=True), "Stack was unexpectedly changed!"
    assert json.dumps(db_after_setup.get("milestones", []), sort_keys=True) == orig_milestones, "Milestones were unexpectedly changed!"
    assert db_after_setup.get("feasibility") == orig_feasibility, "Feasibility was unexpectedly changed!"
    print("[PASS] Test 2 Passed: 'setup_guide' updated, other sections remained untouched.")

    print("\n--- Test 3: Regenerate 'milestones' ---")
    regen_milestones_resp = requests.post(
        f"{BASE_URL}/roadmaps/{target_id}/regenerate",
        json={"section": "milestones"}
    )
    assert regen_milestones_resp.status_code == 200, f"Milestones regen failed: {regen_milestones_resp.text}"
    milestones_result = regen_milestones_resp.json()
    assert "data" in milestones_result, "Missing data in response"
    new_milestones = milestones_result["data"]
    print(f"New milestones count: {len(new_milestones)}")

    db_after_milestones = requests.get(f"{BASE_URL}/roadmaps/{target_id}").json()["data"]
    assert json.dumps(db_after_milestones.get("milestones"), sort_keys=True) == json.dumps(new_milestones, sort_keys=True), "DB milestones mismatch"
    assert json.dumps(db_after_milestones.get("recommended_stack"), sort_keys=True) == json.dumps(new_stack, sort_keys=True), "Stack was unexpectedly changed!"
    assert json.dumps(db_after_milestones.get("setup_guide"), sort_keys=True) == json.dumps(new_setup, sort_keys=True), "Setup guide was unexpectedly changed!"
    assert db_after_milestones.get("feasibility") == orig_feasibility, "Feasibility was unexpectedly changed!"
    print("[PASS] Test 3 Passed: 'milestones' updated, other sections remained untouched.")

    print("\nALL 3 SECTION REGENERATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
