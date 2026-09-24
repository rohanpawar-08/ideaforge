from pydantic import BaseModel
from typing import Optional


class IdeaRequest(BaseModel):
    idea: str
    session_id: Optional[str] = None
    previous_answers: Optional[list[str]] = None


class RegenerateRequest(BaseModel):
    section: str  # "stack", "setup_guide", or "milestones"
    previous_answers: Optional[list[str]] = None


class CompareRequest(BaseModel):
    ideas: list[str]


class AskRequest(BaseModel):
    message: str


class ApplyChangeRequest(BaseModel):
    section: str
    data: object
