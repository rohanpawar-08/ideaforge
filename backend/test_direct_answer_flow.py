import sys
import os
import json
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from schemas import IdeaRequest
from database import SessionLocal
import main

def test_direct_answer_flow():
    db = SessionLocal()
    try:
        idea = "A web app that summarizes YouTube videos into clean markdown study notes."
        print(f"Project Idea: {idea}")

        # Step 1: Initial question
        req1 = IdeaRequest(idea=idea, previous_answers=[])
        res1 = main.generate_plan(req1, db=db)
        print("\n--- Turn 1 Response ---")
        print(json.dumps(res1, indent=2))

        assert res1.get("type") == "question", f"Expected type 'question', got: {res1.get('type')}"
        q1_text = res1.get("text", "")
        assert q1_text, "Question text should not be empty"

        time.sleep(2)

        # Step 2: Clear, direct, normal answer from user
        direct_answer = "The target audience is college students studying for exams who need lecture summaries."
        print(f"\nUser Answer to Q1 (Direct): \"{direct_answer}\"")
        req2 = IdeaRequest(idea=idea, previous_answers=[direct_answer])
        res2 = main.generate_plan(req2, db=db)
        print("\n--- Turn 2 Response ---")
        print(json.dumps(res2, indent=2))

        assert res2.get("type") == "question", f"Expected type 'question', got: {res2.get('type')}"
        q2_text = res2.get("text", "")
        assert q2_text, "Question text should not be empty"

        # Check that it moves to another piece of info (e.g., core feature, skill level, or time budget)
        # and doesn't unnecessarily explain what "target audience" is
        over_explaining_phrases = [
            "target audience means",
            "target audience refers to",
            "an audience is",
            "what target audience means"
        ]
        has_over_explanation = any(phrase in q2_text.lower() for phrase in over_explaining_phrases)

        print(f"\nVerification:")
        print(f"- Question 1: {q1_text}")
        print(f"- Question 2 (after direct answer): {q2_text}")
        print(f"- Over-explaining detected: {has_over_explanation}")

        assert not has_over_explanation, "Turn 2 should not over-explain a concept that the user already understood and answered."

        time.sleep(2)

        # Step 3: Another direct answer (e.g. core feature)
        direct_answer_2 = "The single core feature is pasting a YouTube URL and getting a bulleted markdown summary."
        print(f"\nUser Answer to Q2 (Direct): \"{direct_answer_2}\"")
        req3 = IdeaRequest(idea=idea, previous_answers=[direct_answer, direct_answer_2])
        res3 = main.generate_plan(req3, db=db)
        print("\n--- Turn 3 Response ---")
        print(json.dumps(res3, indent=2))

        q3_text = res3.get("text", "")
        has_core_feature_over_explanation = any(
            phrase in q3_text.lower() for phrase in ["core feature means", "mvp means", "a core feature is"]
        )
        print(f"- Question 3 (after direct answer): {q3_text}")
        print(f"- Over-explaining in Q3: {has_core_feature_over_explanation}")
        assert not has_core_feature_over_explanation, "Turn 3 should not over-explain core features when user answered directly."

        print("\nPASS: Direct answer flow test passed! The AI asked appropriately without unnecessary concept explanations.")

    finally:
        db.close()

if __name__ == "__main__":
    test_direct_answer_flow()
