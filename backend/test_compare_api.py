import requests
import json
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_URL = "http://127.0.0.1:8000"

def run_tests():
    print("=== Testing POST /compare API ===")

    # 1. Validation test: less than 2 ideas
    resp_invalid_few = requests.post(f"{BASE_URL}/compare", json={"ideas": ["Just one idea"]})
    assert resp_invalid_few.status_code == 400, f"Expected 400 for < 2 ideas, got {resp_invalid_few.status_code}"
    print("[PASS] Successfully rejected payload with fewer than 2 ideas (HTTP 400).")

    # 2. Validation test: more than 3 ideas
    resp_invalid_many = requests.post(f"{BASE_URL}/compare", json={"ideas": ["Idea 1", "Idea 2", "Idea 3", "Idea 4"]})
    assert resp_invalid_many.status_code == 400, f"Expected 400 for > 3 ideas, got {resp_invalid_many.status_code}"
    print("[PASS] Successfully rejected payload with more than 3 ideas (HTTP 400).")

    # 3. 3-ideas test with different difficulties
    ideas = [
        "A simple command-line pomodoro timer in Python that beeps when time is up",
        "A fullstack collaborative Kanban board web application with real-time updates and user auth",
        "A distributed real-time event streaming analytics engine with Apache Kafka and Raft consensus",
    ]

    payload = {"ideas": ideas}
    resp = requests.post(f"{BASE_URL}/compare", json=payload, timeout=60)
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"

    data = resp.json()
    assert "comparisons" in data, "Missing 'comparisons'"
    assert "recommendation" in data, "Missing 'recommendation'"

    comparisons = data["comparisons"]
    assert len(comparisons) == 3, f"Expected 3 comparisons, got {len(comparisons)}"

    feasibilities = []
    for idx, comp in enumerate(comparisons, 1):
        f = comp.get("feasibility")
        w = comp.get("estimated_weeks")
        feasibilities.append(f)
        print(f"\nIdea {idx} ({f.upper()}, ~{w}w): {comp.get('idea')}")
        print(f"  Pros: {comp.get('pros')}")
        print(f"  Cons: {comp.get('cons')}")
        assert f in ["beginner", "intermediate", "advanced"]
        assert isinstance(w, (int, float)) and w > 0
        assert len(comp.get("pros", [])) >= 2
        assert len(comp.get("cons", [])) >= 2

    # Verify that different difficulty ideas were recognized with differing levels
    assert len(set(feasibilities)) >= 2, f"Expected diverse feasibility levels, got: {feasibilities}"

    rec = data["recommendation"]
    print(f"\nArchitect Recommendation:\n{rec}")
    assert len(rec) > 50, "Recommendation text too short"

    # 4. 2-ideas test
    resp_2 = requests.post(
        f"{BASE_URL}/compare",
        json={"ideas": [ideas[0], ideas[1]]},
        timeout=60
    )
    if resp_2.status_code != 200:
        print(f"2-ideas failed with status {resp_2.status_code}: {resp_2.text}")
    assert resp_2.status_code == 200, f"Expected 200, got {resp_2.status_code}: {resp_2.text}"
    data_2 = resp_2.json()
    assert len(data_2["comparisons"]) == 2
    assert len(data_2["recommendation"]) > 30
    print("\n[PASS] Successfully compared 2 candidate ideas.")

    print("\nALL IDEA COMPARISON TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
