import sys
import os
import json
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from schemas import IdeaRequest
from database import SessionLocal
import main

def test_schema_validator():
    print("=== Testing validate_roadmap_schema ===")
    
    valid_obj = {
        "type": "roadmap",
        "data": {
            "feasibility": "beginner",
            "difficulty_breakdown": {
                "frontend_complexity": "beginner",
                "backend_complexity": "beginner",
                "database_complexity": "not_applicable",
                "ai_complexity": "not_applicable",
                "deployment_complexity": "beginner"
            },
            "estimated_weeks": 4,
            "recommended_stack": ["HTML/CSS", "JavaScript", "Vite"],
            "setup_guide": {
                "primary_language": "JavaScript (standard for web frontends and beginner accessible)",
                "editor_recommendation": "VS Code because of its excellent built-in debugger and extensions.",
                "key_tools": [
                    {"name": "Vite", "purpose": "Fast local development server and bundler"},
                    {"name": "Canvas Confetti", "purpose": "Lightweight celebratory animations for completed habits"}
                ],
                "getting_started_command": "npm create vite@latest habit-tracker -- --template vanilla"
            },
            "mvp_features": ["Timer display", "Streak counter"],
            "stretch_features": ["Discord webhook integration"],
            "milestones": [
                {
                    "week": 1,
                    "goal": "Project setup and basic timer UI",
                    "tasks": ["Initialize Vite project", "Create timer layout"]
                }
            ]
        }
    }
    
    errors = main.validate_roadmap_schema(valid_obj)
    assert errors == [], f"Expected 0 errors for valid roadmap, got: {errors}"
    print("✔ Valid roadmap passed validation.")
    
    # Missing difficulty_breakdown
    invalid_no_diff = json.loads(json.dumps(valid_obj))
    del invalid_no_diff["data"]["difficulty_breakdown"]
    errors_no_diff = main.validate_roadmap_schema(invalid_no_diff)
    assert any("difficulty_breakdown" in e for e in errors_no_diff), f"Expected error for missing difficulty_breakdown, got: {errors_no_diff}"
    print(f"✔ Missing difficulty_breakdown correctly rejected: {errors_no_diff}")

    # Invalid rating in difficulty_breakdown
    invalid_rating = json.loads(json.dumps(valid_obj))
    invalid_rating["data"]["difficulty_breakdown"]["frontend_complexity"] = "expert"
    errors_rating = main.validate_roadmap_schema(invalid_rating)
    assert any("frontend_complexity" in e for e in errors_rating), f"Expected error for invalid rating, got: {errors_rating}"
    print(f"✔ Invalid difficulty_breakdown rating correctly rejected: {errors_rating}")

    # Missing setup_guide
    invalid_no_setup = json.loads(json.dumps(valid_obj))
    del invalid_no_setup["data"]["setup_guide"]
    errors_no_setup = main.validate_roadmap_schema(invalid_no_setup)
    assert any("setup_guide" in e for e in errors_no_setup), f"Expected error for missing setup_guide, got: {errors_no_setup}"
    print(f"✔ Missing setup_guide correctly rejected: {errors_no_setup}")
    
    # Invalid key_tools
    invalid_tools = json.loads(json.dumps(valid_obj))
    invalid_tools["data"]["setup_guide"]["key_tools"] = [{"name": "OnlyName"}]
    errors_tools = main.validate_roadmap_schema(invalid_tools)
    assert any("purpose" in e for e in errors_tools), f"Expected error for missing purpose, got: {errors_tools}"
    print(f"✔ Incomplete key_tools correctly rejected: {errors_tools}")
    
    # Empty getting_started_command
    invalid_cmd = json.loads(json.dumps(valid_obj))
    invalid_cmd["data"]["setup_guide"]["getting_started_command"] = ""
    errors_cmd = main.validate_roadmap_schema(invalid_cmd)
    assert any("getting_started_command" in e for e in errors_cmd), f"Expected error for empty command, got: {errors_cmd}"
    print(f"✔ Empty getting_started_command correctly rejected: {errors_cmd}")


def test_full_4_answer_conversation():
    print("\n=== Testing Full 4-Answer Conversation & Setup Guide Output ===")
    db = SessionLocal()
    try:
        idea = "A daily habit and study streak tracker for students that rewards consistency."
        print(f"Initial Idea: {idea}\n")

        # 4 clarifying answers demonstrating a beginner persona
        answers = [
            "The target audience is high school and first-year university students trying to build better study habits.",
            "The core feature is a visual streak tracker where users log daily 25-minute study sessions and see their streak fire animation grow.",
            "My skill level is beginner. I just started learning JavaScript, HTML, and CSS last month and have never built a backend.",
            "I have about 5 to 6 hours per week to work on this, and want to finish the MVP in about 3 to 4 weeks."
        ]

        # Simulate the turns
        for step in range(len(answers)):
            sub_answers = answers[:step]
            req = IdeaRequest(idea=idea, previous_answers=sub_answers)
            resp = main.generate_plan(req, db=db)
            print(f"--- Turn {step + 1} (after {step} previous answers) ---")
            if resp.get("type") == "question":
                print(f"AI Clarifying Question: {resp.get('text')}")
                print(f"User Stated Answer: {answers[step]}\n")
            time.sleep(1)

        # Final turn: with all 4 answers supplied
        print("--- Final Turn (4 previous answers supplied -> generating roadmap) ---")
        final_req = IdeaRequest(idea=idea, previous_answers=answers)
        final_resp = main.generate_plan(final_req, db=db)

        assert final_resp.get("type") == "roadmap", f"Expected 'roadmap', got {final_resp.get('type')}: {final_resp}"
        
        roadmap_data = final_resp.get("data", {})
        assert "setup_guide" in roadmap_data, "Roadmap data missing 'setup_guide'"
        
        setup_guide = roadmap_data["setup_guide"]
        print("\n========================================================")
        print("               GENERATED SETUP_GUIDE OUTPUT             ")
        print("========================================================")
        print(json.dumps(setup_guide, indent=2))
        print("========================================================\n")
        
        # Verify schema conformity
        validation_errors = main.validate_roadmap_schema(final_resp)
        print(f"Validation errors on final roadmap: {validation_errors}")
        assert validation_errors == [], f"Validation failed: {validation_errors}"
        
        # Check beginner consistency
        print("Setup Guide Field Verifications:")
        print(f"1. Primary Language: {setup_guide.get('primary_language')}")
        print(f"2. Editor Recommendation: {setup_guide.get('editor_recommendation')}")
        print(f"3. Key Tools: {setup_guide.get('key_tools')}")
        print(f"4. Getting Started Command: {setup_guide.get('getting_started_command')}")
        
        assert setup_guide.get("primary_language"), "primary_language is required"
        assert setup_guide.get("editor_recommendation"), "editor_recommendation is required"
        assert len(setup_guide.get("key_tools", [])) > 0, "key_tools must not be empty"
        assert setup_guide.get("getting_started_command"), "getting_started_command is required"
        
        print("\n✔ FULL 4-ANSWER CONVERSATION AND SETUP_GUIDE TEST COMPLETED SUCCESSFULLY!")
        return setup_guide

    finally:
        db.close()

if __name__ == "__main__":
    test_schema_validator()
    test_full_4_answer_conversation()
