import sys
import os
import json
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from schemas import IdeaRequest
from database import SessionLocal
import main

def test_adaptive_conversation():
    db = SessionLocal()
    try:
        idea = "A podcast bookmarking app where listeners can save and annotate key audio moments."
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

        # Step 2: Vague answer / asking for explanation
        vague_answer = "I don't know, can you explain?"
        print(f"\nUser Answer to Q1: \"{vague_answer}\"")
        req2 = IdeaRequest(idea=idea, previous_answers=[vague_answer])
        res2 = main.generate_plan(req2, db=db)
        print("\n--- Turn 2 Response ---")
        print(json.dumps(res2, indent=2))

        assert res2.get("type") == "question", f"Expected type 'question', got: {res2.get('type')}"
        q2_text = res2.get("text", "")
        assert q2_text, "Question text should not be empty"

        # Check that it did not repeat the exact same question
        assert q1_text.strip().lower() != q2_text.strip().lower(), (
            f"Expected AI to adapt instead of repeating the question verbatim.\nQ1: {q1_text}\nQ2: {q2_text}"
        )

        # Check that it explains the concept (e.g., provides explanatory language / examples)
        explanation_indicators = [
            "means", "for example", "such as", "think of", "is", "e.g.", "like", "in other words", "refers to"
        ]
        has_explanation = any(ind in q2_text.lower() for ind in explanation_indicators) or len(q2_text) > len(q1_text)
        print(f"\nVerification:")
        print(f"- Question 1: {q1_text}")
        print(f"- Question 2 (after 'I don't know, can you explain?'): {q2_text}")
        print(f"- Not repeated: True")
        print(f"- Contains concept explanation / guidance: {has_explanation}")

        assert has_explanation, "Turn 2 should include an explanation of the concept."

        print("\nPASS: Adaptive clarifying flow test passed successfully!")

    finally:
        db.close()

if __name__ == "__main__":
    test_adaptive_conversation()
