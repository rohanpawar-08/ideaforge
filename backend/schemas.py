from pydantic import BaseModel
from typing import Optional


class IdeaRequest(BaseModel):
    idea: str
    session_id: Optional[str] = None
    previous_answers: Optional[list[str]] = None


class RegenerateRequest(BaseModel):
    section: str  # "stack", "setup_guide", "suggested_schema", or "milestones"
    previous_answers: Optional[list[str]] = None


class CompareRequest(BaseModel):
    ideas: list[str]


class AskRequest(BaseModel):
    message: str


class ApplyChangeRequest(BaseModel):
    section: str
    data: object


class UserAuthRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class VivaRequest(BaseModel):
    idea: Optional[str] = ""
    roadmap_data: Optional[dict] = None
    roadmap_id: Optional[int] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DeleteAccountRequest(BaseModel):
    password: str


class MessageResponse(BaseModel):
    message: str
