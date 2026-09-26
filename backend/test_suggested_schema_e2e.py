import sys
import os
import json
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from schemas import IdeaRequest
from database import SessionLocal
import main

def test_schema_full_conversation():
    print("=== Testing Full 4-Answer Conversation for Database-Backed Project ===")
    db = SessionLocal()
    try:
        idea = "A subscription and recurring expense management platform where users sign up, track monthly subscriptions, organize by category, and get renewal alerts."
        print(f"Project Idea: {idea}\n")

        answers = [
            "The target audience is young professionals and freelancers who juggle 10+ software, streaming, and utility subscriptions.",
            "Key features are user authentication, a dashboard showing active subscriptions with costs and billing cycles, categorization (Work, Entertainment, Utilities), and email alerts 3 days before renewal.",
            "I'm an intermediate developer comfortable with React and Node.js/Express or Python/FastAPI, but I want a clean relational database setup with PostgreSQL.",
            "I plan to spend 8 hours a week for 6 weeks to ship a functional MVP with real authentication and persistent data storage."
        ]

        # Simulate 4 turns
        for step in range(len(answers)):
            sub_answers = answers[:step]
            req = IdeaRequest(idea=idea, previous_answers=sub_answers)
            resp = main.generate_plan(req, db=db)
            print(f"--- Turn {step + 1} (after {step} answers) ---")
            if resp.get("type") == "question":
                print(f"AI Clarifying Question: {resp.get('text')}")
                print(f"User Stated Answer: {answers[step]}\n")
            time.sleep(1)

        # Final turn
        print("--- Final Turn: Submitting 4 answers to generate roadmap ---")
        final_req = IdeaRequest(idea=idea, previous_answers=answers)
        final_resp = main.generate_plan(final_req, db=db)

        assert final_resp.get("type") == "roadmap", f"Expected 'roadmap', got {final_resp.get('type')}: {final_resp}"
        
        roadmap_data = final_resp.get("data", {})
        
        # Verify schema conformity
        validation_errors = main.validate_roadmap_schema(final_resp)
        print(f"\nValidation errors on final roadmap: {validation_errors}")
        assert validation_errors == [], f"Validation failed with errors: {validation_errors}"
        
        # Inspect suggested_schema
        assert "suggested_schema" in roadmap_data, "Missing 'suggested_schema' in roadmap data"
        suggested_schema = roadmap_data["suggested_schema"]
        
        print("\n" + "="*60)
        print("         GENERATED SUGGESTED DATABASE SCHEMA OUTPUT         ")
        print("="*60)
        print(json.dumps(suggested_schema, indent=2))
        print("="*60 + "\n")
        
        # Verify suggested_schema structure
        assert isinstance(suggested_schema, list), "suggested_schema must be a list"
        assert len(suggested_schema) > 0, "suggested_schema should have at least one table for a DB project"
        
        table_names = [t.get("table_name") for t in suggested_schema]
        print(f"Generated Tables: {table_names}")
        
        for table in suggested_schema:
            t_name = table.get("table_name")
            fields = table.get("fields", [])
            print(f"\nTable: {t_name} ({len(fields)} fields)")
            for f in fields:
                print(f"  - {f.get('name')} ({f.get('type')}): {f.get('notes')}")
            assert len(fields) > 0, f"Table {t_name} should have fields"

        print("\n✔ FULL 4-ANSWER CONVERSATION AND SUGGESTED SCHEMA TEST PASSED!")
        return suggested_schema

    finally:
        db.close()

if __name__ == "__main__":
    test_schema_full_conversation()
