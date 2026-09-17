from pydantic import BaseModel
from typing import Optional


class IdeaRequest(BaseModel):
    idea: str
    session_id: Optional[str] = None
    previous_answers: Optional[list[str]] = None
