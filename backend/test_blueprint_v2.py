"""
test_blueprint_v2.py

Comprehensive test suite for Phase 5 — Project Intelligence Engine V2:
- Zero-question generation when idea contains sufficient detail
- 1-2 question flows with adaptive questions
- Absolute maximum 3 questions enforced
- 'I don't know', 'you decide', 'just generate', 'skip' trigger immediate generation
- Detection of user experience levels (beginner, intermediate, advanced)
- Beginner mode depth (prerequisites, exact setup commands, learning path, concept explanations)
- Strict blueprint schema validation and defensive normalization (schema_version: 2)
- Resilient recovery from malformed or sparse LLM output
- Backward compatibility: legacy V1 roadmaps load and summarize properly
- Regeneration, AI chat adjustments, and enhanced Compare mode
"""

import os
import sys
import unittest
from unittest.mock import patch, MagicMock

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(__file__))

import blueprint_v2
from blueprint_v2 import (
    is_stop_interrogation_signal,
    is_idea_sufficiently_detailed,
    detect_user_experience_level,
    validate_blueprint_v2_schema,
    normalize_blueprint_v2,
)
from starlette.requests import Request
import main


def make_request(path: str = "/plan") -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": path,
        "headers": [],
        "client": ("127.0.0.1", 12345),
    }
    return Request(scope)


class TestProjectIntelligenceEngineV2(unittest.TestCase):


    def test_stop_interrogation_signals(self):
        """User phrases that must stop questioning and trigger immediate generation."""
        stop_phrases = [
            "I don't know",
            "dont know",
            "not sure",
            "you decide",
            "whatever is best",
            "just generate",
            "just generate it",
            "generate it",
            "up to you",
            "no preference",
            "skip questions",
        ]
        for phrase in stop_phrases:
            self.assertTrue(
                is_stop_interrogation_signal(phrase),
                f"Failed to identify stop signal for phrase: '{phrase}'"
            )

        non_stop_phrases = [
            "It is for hospital doctors and patients",
            "We want to track appointments and medical records",
            "Targeting college students studying computer science",
        ]
        for phrase in non_stop_phrases:
            self.assertFalse(
                is_stop_interrogation_signal(phrase),
                f"Incorrectly identified stop signal for: '{phrase}'"
            )

    def test_sufficiently_detailed_idea_zero_questions(self):
        """Ideas with sufficient context must trigger 0 questions (Rule C)."""
        detailed_idea = (
            "I want to build a comprehensive dairy management system for local cooperative milk farms. "
            "It must track daily milk collection, fat percentage testing, farmer payouts, cattle vaccinations, "
            "and inventory for animal feed with daily SMS receipts."
        )
        self.assertTrue(is_idea_sufficiently_detailed(detailed_idea))

        simple_idea = "build a dairy system"
        self.assertFalse(is_idea_sufficiently_detailed(simple_idea))

    def test_experience_level_detection(self):
        """Infers beginner, intermediate, and advanced automatically."""
        # Beginner indicators
        self.assertEqual(
            detect_user_experience_level("I want to build a blog but I don't know how to code"),
            "beginner"
        )
        self.assertEqual(
            detect_user_experience_level("portfolio site", ["I am a beginner learning web development"]),
            "beginner"
        )

        # Advanced indicators
        self.assertEqual(
            detect_user_experience_level("High throughput distributed microservice with kubernetes deployment"),
            "advanced"
        )

        # Intermediate default / standard
        self.assertEqual(
            detect_user_experience_level("A booking platform for barbershops in React and Python"),
            "intermediate"
        )

    def test_schema_v2_validation_and_normalization(self):
        """Validates that normalize_blueprint_v2 produces a pristine V2 schema blueprint."""
        raw_partial_data = {
            "type": "roadmap",
            "data": {
                "project_summary": {
                    "title": "Dairy Milk Manager",
                    "one_line_description": "A milk management platform for farms.",
                },
                "recommended_stack": [
                    {"technology": "React", "purpose": "UI"}
                ],
                "implementation_plan": [
                    {
                        "phase": 1,
                        "name": "Database and Models",
                        "goal": "Setup DB",
                        "tasks": [
                            {
                                "task": "Create Milk Entry Model",
                                "description": "Table for milk batches",
                                "files_or_modules": ["backend/models/milk.py"],
                                "how_to_test": "Run pytest",
                                "definition_of_done": "Model exists in migrations"
                            }
                        ]
                    }
                ]
            }
        }

        # Normalize and enrich
        normalized = normalize_blueprint_v2(raw_partial_data, idea="Dairy farm system", experience_level="beginner")
        inner = normalized["data"]

        # Check required schema sections
        self.assertEqual(inner["schema_version"], 2)
        self.assertIn("project_summary", inner)
        self.assertIn("assumptions", inner)
        self.assertIn("requirements", inner)
        self.assertIn("user_roles", inner)
        self.assertIn("features", inner)
        self.assertIn("user_flows", inner)
        self.assertIn("screens", inner)
        self.assertIn("recommended_stack", inner)
        self.assertIn("architecture", inner)
        self.assertIn("database", inner)
        self.assertIn("api_design", inner)
        self.assertIn("folder_structure", inner)
        self.assertIn("setup_guide", inner)
        self.assertIn("implementation_plan", inner)
        self.assertIn("testing_plan", inner)
        self.assertIn("security_plan", inner)
        self.assertIn("deployment_plan", inner)
        self.assertIn("common_mistakes", inner)
        self.assertIn("learning_path", inner)
        self.assertIn("launch_checklist", inner)

        # Validate with strict schema validator
        errors = validate_blueprint_v2_schema(normalized)
        self.assertEqual(errors, [], f"Validation errors found in normalized blueprint: {errors}")

        # Check beginner specifics
        self.assertGreaterEqual(len(inner["setup_guide"]["commands"]), 1)
        self.assertGreaterEqual(len(inner["learning_path"]), 1)

    def test_plan_zero_question_flow(self):
        """Detailed idea must return a blueprint immediately without asking clarifying questions."""
        mock_user = MagicMock()
        mock_user.id = 1
        mock_db = MagicMock()

        detailed_idea = (
            "I want to build a comprehensive dairy management system for local cooperative milk farms. "
            "It must track daily milk collection, fat percentage testing, farmer payouts, cattle vaccinations, "
            "and inventory for animal feed with daily SMS receipts."
        )

        with patch("main.call_groq_llm") as mock_groq:
            # LLM returns a blueprint
            mock_groq.return_value = {
                "type": "roadmap",
                "data": {
                    "schema_version": 2,
                    "project_summary": {
                        "title": "Cooperative Dairy Management System",
                        "one_line_description": "Tracks milk collections and farmer payouts.",
                    },
                    "recommended_stack": [{"technology": "FastAPI", "purpose": "Backend"}],
                    "implementation_plan": [{"phase": 1, "name": "DB Setup", "tasks": [{"task": "Init DB"}]}]
                }
            }

            req = main.IdeaRequest(idea=detailed_idea, previous_answers=[])
            response = main.generate_plan(make_request("/plan"), req, mock_db, mock_user)

            self.assertEqual(response["type"], "roadmap")
            inner_data = response.get("data", {})
            self.assertEqual(inner_data.get("schema_version"), 2)
            self.assertEqual(mock_groq.call_count, 1)

    def test_plan_stop_signals_trigger_immediate_generation(self):
        """User saying 'you decide' or 'just generate' triggers immediate blueprint generation."""
        mock_user = MagicMock()
        mock_user.id = 1
        mock_db = MagicMock()

        for stop_answer in ["I don't know, you decide", "just generate it", "whatever is best"]:
            with patch("main.call_groq_llm") as mock_groq:
                mock_groq.return_value = {
                    "type": "roadmap",
                    "data": {
                        "schema_version": 2,
                        "project_summary": {
                            "title": "Automated Project Blueprint",
                            "one_line_description": "Generated according to best practices.",
                        },
                        "recommended_stack": [{"technology": "React", "purpose": "UI"}],
                        "implementation_plan": [{"phase": 1, "name": "Phase 1", "tasks": [{"task": "Task 1"}]}]
                    }
                }

                req = main.IdeaRequest(idea="hospital booking site", previous_answers=[stop_answer])
                response = main.generate_plan(make_request("/plan"), req, mock_db, mock_user)

                self.assertEqual(response["type"], "roadmap")
                self.assertEqual(response["data"]["schema_version"], 2)

    def test_plan_maximum_three_questions_enforced(self):
        """After 3 questions answered, the next request MUST generate the blueprint, never ask question 4."""
        mock_user = MagicMock()
        mock_user.id = 1
        mock_db = MagicMock()

        with patch("main.call_groq_llm") as mock_groq:
            mock_groq.return_value = {
                "type": "roadmap",
                "data": {
                    "schema_version": 2,
                    "project_summary": {"title": "Final Project", "one_line_description": "Done"},
                    "recommended_stack": [{"technology": "Vue", "purpose": "UI"}],
                    "implementation_plan": [{"phase": 1, "name": "Build", "tasks": [{"task": "Code"}]}]
                }
            }

            req = main.IdeaRequest(
                idea="hospital booking site",
                previous_answers=["For local clinics", "Needs doctor appointments", "Intermediate developer"]
            )
            response = main.generate_plan(make_request("/plan"), req, mock_db, mock_user)

            self.assertEqual(response["type"], "roadmap")
            self.assertEqual(response["data"]["schema_version"], 2)

    def test_backward_compatibility_legacy_roadmap(self):
        """Legacy V1 roadmaps in database must summarize correctly in get_roadmaps."""
        mock_user = MagicMock()
        mock_user.id = 42

        # Mock an old roadmap from database with V1 schema (no schema_version, legacy milestones)
        legacy_record = MagicMock()
        legacy_record.id = 101
        legacy_record.original_idea = "A simple portfolio website"
        legacy_record.created_at = None
        legacy_record.data = {
            "feasibility": "beginner",
            "estimated_weeks": 3,
            "recommended_stack": ["HTML", "CSS", "JavaScript"],
            "milestones": [
                {"week": 1, "goal": "Setup HTML", "tasks": ["Create index.html"]}
            ]
        }

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [legacy_record]

        roadmaps_list = main.get_roadmaps(mock_db, mock_user)
        self.assertEqual(len(roadmaps_list), 1)
        item = roadmaps_list[0]
        self.assertEqual(item["id"], 101)
        self.assertEqual(item["summary"]["feasibility"], "beginner")
        self.assertEqual(item["summary"]["estimated_weeks"], 3)
        self.assertEqual(item["summary"]["schema_version"], 1)

    def test_compare_endpoint_enhanced_dimensions(self):
        """Compare mode returns enhanced evaluation dimensions."""
        mock_user = MagicMock()
        mock_user.id = 1
        req = main.CompareRequest(ideas=[
            "A habit tracker with discord alerts",
            "A hospital doctor appointment booking system"
        ])

        with patch("main.call_groq_llm") as mock_groq:
            mock_groq.return_value = {
                "comparisons": [
                    {
                        "idea": "A habit tracker with discord alerts",
                        "feasibility": "beginner",
                        "estimated_weeks": 3,
                        "complexity": "Low",
                        "learning_difficulty": "Low",
                        "portfolio_value": "High",
                        "monetization_potential": "Moderate",
                        "major_risks": ["Discord webhook rate limits"],
                        "pros": ["Quick to build", "Fun Discord integration"],
                        "cons": ["Limited standalone market"]
                    },
                    {
                        "idea": "A hospital doctor appointment booking system",
                        "feasibility": "intermediate",
                        "estimated_weeks": 6,
                        "complexity": "Moderate",
                        "learning_difficulty": "Moderate",
                        "portfolio_value": "Very High",
                        "monetization_potential": "High",
                        "major_risks": ["HIPAA/medical data privacy concerns"],
                        "pros": ["High commercial relevance", "Relational database complexity"],
                        "cons": ["Sensitive healthcare domain requirements"]
                    }
                ],
                "recommendation": "Choose the habit tracker if shipping in 3 weeks; choose the appointment system for a resume-defining portfolio project."
            }

            result = main.compare_ideas(make_request("/compare"), req, mock_user)
            self.assertIn("comparisons", result)
            self.assertEqual(len(result["comparisons"]), 2)
            c1 = result["comparisons"][0]
            self.assertEqual(c1["complexity"], "Low")
            self.assertEqual(c1["learning_difficulty"], "Low")
            self.assertEqual(c1["portfolio_value"], "High")
            self.assertEqual(c1["monetization_potential"], "Moderate")
            self.assertIn("Discord webhook rate limits", c1["major_risks"])

    def test_plan_question_flow_when_ambiguous(self):
        """When an idea is short or ambiguous, IdeaForge asks an adaptive clarifying question."""
        mock_user = MagicMock()
        mock_user.id = 1
        mock_db = MagicMock()

        with patch("main.call_groq_llm") as mock_groq:
            mock_groq.return_value = {
                "type": "question",
                "text": "Are you building this appointment booking system for a single doctor clinic or a multi-specialty hospital?"
            }

            req = main.IdeaRequest(idea="hospital appointment system", previous_answers=[])
            response = main.generate_plan(make_request("/plan"), req, mock_db, mock_user)

            self.assertEqual(response["type"], "question")
            self.assertIn("single doctor", response["text"])

    def test_technical_question_interception(self):
        """Rule G: If LLM asks technical question ('Which database do you want?'), it is intercepted and blueprint is generated."""
        mock_user = MagicMock()
        mock_user.id = 1
        mock_db = MagicMock()

        with patch("main.call_groq_llm") as mock_groq:
            # First call returns forbidden technical question; second call in recursion returns blueprint
            mock_groq.side_effect = [
                {
                    "type": "question",
                    "text": "Which database do you want to use: PostgreSQL or MongoDB?"
                },
                {
                    "type": "roadmap",
                    "data": {
                        "schema_version": 2,
                        "project_summary": {"title": "App", "one_line_description": "Descr"},
                        "recommended_stack": [{"technology": "PostgreSQL", "purpose": "DB"}],
                        "implementation_plan": [{"phase": 1, "name": "DB", "tasks": [{"task": "Schema"}]}]
                    }
                }
            ]

            req = main.IdeaRequest(idea="hospital booking site", previous_answers=[])
            response = main.generate_plan(make_request("/plan"), req, mock_db, mock_user)

            self.assertEqual(response["type"], "roadmap")
            self.assertEqual(response["data"]["schema_version"], 2)

    def test_regenerate_v2_sections(self):
        """Tests regenerating V2 sections in a roadmap record."""
        mock_user = MagicMock()
        mock_user.id = 1

        v2_record = MagicMock()
        v2_record.id = 200
        v2_record.user_id = 1
        v2_record.original_idea = "A dairy management system"
        v2_record.data = {
            "schema_version": 2,
            "project_summary": {"title": "Dairy Forge", "difficulty": "intermediate", "estimated_duration": "4 Weeks"},
            "recommended_stack": [{"technology": "Vue", "purpose": "UI"}],
            "implementation_plan": [{"phase": 1, "name": "P1", "tasks": [{"task": "T1"}]}]
        }

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = v2_record

        with patch("main.call_groq_llm") as mock_groq:
            mock_groq.return_value = {
                "recommended_stack": [
                    {"technology": "React", "purpose": "UI"},
                    {"technology": "FastAPI", "purpose": "Backend"}
                ]
            }

            req = main.RegenerateRequest(section="recommended_stack")
            res = main.regenerate_roadmap_section(make_request("/roadmaps/200/regenerate"), 200, req, mock_db, mock_user)
            self.assertEqual(res["target_key"], "recommended_stack")
            self.assertTrue(mock_db.commit.called)

    def test_ask_and_apply_v2_changes(self):
        """Tests AI follow-up chat and apply-change on V2 blueprint."""
        mock_user = MagicMock()
        mock_user.id = 1

        v2_record = MagicMock()
        v2_record.id = 300
        v2_record.user_id = 1
        v2_record.original_idea = "A dairy management system"
        v2_record.data = {
            "schema_version": 2,
            "project_summary": {"title": "Dairy Forge"},
            "recommended_stack": [{"technology": "Vue", "purpose": "UI"}],
            "database": {"tables": [{"name": "milk_batches"}]}
        }

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.first.return_value = v2_record

        # Test apply change
        apply_req = main.ApplyChangeRequest(
            section="database",
            data={"tables": [{"name": "milk_batches"}, {"name": "farmer_payouts"}]}
        )
        res = main.apply_roadmap_change(300, apply_req, mock_db, mock_user)
        self.assertTrue(res["success"])
        self.assertEqual(res["target_key"], "database")
        self.assertEqual(len(v2_record.data["database"]["tables"]), 2)


if __name__ == "__main__":
    unittest.main()

