import sys
import json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from fastapi import HTTPException
from database import SessionLocal
import main

def test_roadmaps_endpoints():
    db = SessionLocal()
    try:
        print("Testing get_roadmaps()...")
        roadmaps = main.get_roadmaps(db=db)
        print(f"Retrieved {len(roadmaps)} roadmaps from get_roadmaps()")
        assert isinstance(roadmaps, list), "Expected list of roadmaps"
        
        if roadmaps:
            first = roadmaps[0]
            print(f"Sample preview card item: {json.dumps(first, indent=2)}")
            assert "id" in first, "Expected 'id' in roadmap preview"
            assert "original_idea" in first, "Expected 'original_idea' in roadmap preview"
            assert "summary" in first, "Expected 'summary' in roadmap preview"
            assert "feasibility" in first["summary"], "Expected 'feasibility' in summary"
            assert "estimated_weeks" in first["summary"], "Expected 'estimated_weeks' in summary"
            assert "created_at" in first, "Expected 'created_at' in roadmap preview"
            assert "data" not in first, "Full data blob should NOT be in list view preview"

            # Check sorting: created_at descending
            for i in range(len(roadmaps) - 1):
                curr_date = roadmaps[i].get("created_at") or ""
                next_date = roadmaps[i+1].get("created_at") or ""
                assert curr_date >= next_date, f"Roadmaps should be ordered newest first: {curr_date} < {next_date}"

            # Test get_roadmap(id)
            target_id = first["id"]
            print(f"\nTesting get_roadmap({target_id})...")
            single = main.get_roadmap(roadmap_id=target_id, db=db)
            print(f"Retrieved full roadmap: id={single.get('id')}, idea='{single.get('original_idea')[:40]}...'")
            assert single.get("id") == target_id
            assert "data" in single, "Expected 'data' blob in full roadmap response"
            assert isinstance(single["data"], dict)
            assert "feasibility" in single["data"]
            assert "estimated_weeks" in single["data"]

        # Test non-existent id
        try:
            main.get_roadmap(roadmap_id=99999999, db=db)
            assert False, "Expected HTTPException 404 for non-existent id"
        except HTTPException as he:
            assert he.status_code == 404, f"Expected 404, got {he.status_code}"
            print("Non-existent ID correctly raised 404 HTTPException")

        print("\nALL BACKEND ROADMAP ENDPOINT TESTS PASSED!")
    finally:
        db.close()

if __name__ == "__main__":
    test_roadmaps_endpoints()
