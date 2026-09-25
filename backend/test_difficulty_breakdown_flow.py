import sys
import json
import time

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from schemas import IdeaRequest
from database import SessionLocal
import main
import models

def test_full_4_answer_difficulty_breakdown():
    print("=================================================================")
    print("   TESTING FULL 4-ANSWER CONVERSATION & DIFFICULTY BREAKDOWN    ")
    print("=================================================================\n")
    
    db = SessionLocal()
    try:
        # Create or fetch a test user for DB attribution
        test_email = "tester_diff_breakdown@example.com"
        test_user = db.query(models.User).filter(models.User.email == test_email).first()
        if not test_user:
            test_user = models.User(email=test_email, hashed_password="hashed_pw_dummy")
            db.add(test_user)
            db.commit()
            db.refresh(test_user)

        idea = "An AI-powered meeting summary tool that captures audio, generates action items, and syncs tasks to Notion."
        print(f"Project Idea: \"{idea}\"\n")

        # 4 clarifying answers
        answers = [
            "Target audience is busy remote software engineering teams and product managers.",
            "Core feature is real-time speech-to-text with LLM-generated markdown meeting summaries and action items.",
            "Skill level is intermediate. Comfortable with Python and React, basic PostgreSQL, but new to audio streaming APIs.",
            "Time budget is roughly 8 hours per week for about 5 weeks."
        ]

        # Simulate the clarifying flow
        for step in range(len(answers)):
            sub_answers = answers[:step]
            req = IdeaRequest(idea=idea, previous_answers=sub_answers)
            resp = main.generate_plan(req, db=db, current_user=test_user)
            print(f"--- Turn {step + 1} ({step}/4 answers provided) ---")
            assert resp.get("type") == "question", f"Expected 'question', got: {resp.get('type')}"
            print(f"AI Clarifying Question: {resp.get('text')}")
            print(f"User Stated Answer:     {answers[step]}\n")
            time.sleep(1)

        # Final turn with 4 answers -> triggers roadmap generation
        print("--- Turn 5 (All 4 answers provided -> Generating Full Roadmap) ---")
        final_req = IdeaRequest(idea=idea, previous_answers=answers)
        final_resp = main.generate_plan(final_req, db=db, current_user=test_user)

        assert final_resp.get("type") == "roadmap", f"Expected type 'roadmap', got: {final_resp.get('type')}"
        
        roadmap_data = final_resp.get("data", {})
        print("\n✔ Successfully received roadmap response!")
        print(f"Overall Feasibility: {roadmap_data.get('feasibility')}")
        print(f"Estimated Weeks:     {roadmap_data.get('estimated_weeks')}")
        print(f"Recommended Stack:   {roadmap_data.get('recommended_stack')}")

        # Check difficulty breakdown
        assert "difficulty_breakdown" in roadmap_data, "Missing 'difficulty_breakdown' in roadmap data!"
        diff_breakdown = roadmap_data["difficulty_breakdown"]

        print("\n=================================================================")
        print("                 DIFFICULTY BREAKDOWN OUTPUT                     ")
        print("=================================================================")
        print(json.dumps(diff_breakdown, indent=2))
        print("=================================================================\n")

        required_fields = [
            "frontend_complexity",
            "backend_complexity",
            "database_complexity",
            "ai_complexity",
            "deployment_complexity",
        ]
        valid_ratings = {"beginner", "intermediate", "advanced", "not_applicable"}

        for field in required_fields:
            assert field in diff_breakdown, f"Missing field '{field}' in difficulty_breakdown!"
            rating = diff_breakdown[field]
            assert rating.lower() in valid_ratings, f"Invalid rating '{rating}' for field '{field}'! Must be in {valid_ratings}"
            print(f"✔ {field}: {rating}")

        # Validate with validate_roadmap_schema
        validation_errors = main.validate_roadmap_schema(final_resp)
        print(f"\nSchema validation errors: {validation_errors}")
        assert validation_errors == [], f"Validation errors found: {validation_errors}"
        print("✔ validate_roadmap_schema passed with 0 errors!")

        print("\nALL BACKEND DIFFICULTY BREAKDOWN TESTS PASSED SUCCESSFULLY!")
        return final_resp
    finally:
        db.close()

if __name__ == "__main__":
    test_full_4_answer_difficulty_breakdown()
