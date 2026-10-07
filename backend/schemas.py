from typing import Optional, List
from pydantic import BaseModel, field_validator


class IdeaRequest(BaseModel):
    idea: str
    session_id: Optional[str] = None
    previous_answers: Optional[list[str]] = None

    @field_validator("idea")
    @classmethod
    def validate_idea(cls, v: str) -> str:
        if v and len(v) > 5000:
            raise ValueError("Original idea exceeds maximum allowed length of 5000 characters.")
        return v

    @field_validator("previous_answers")
    @classmethod
    def validate_previous_answers(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v:
            for idx, ans in enumerate(v, 1):
                if ans and len(ans) > 3000:
                    raise ValueError(f"Clarification answer {idx} exceeds maximum allowed length of 3000 characters.")
        return v


class RegenerateRequest(BaseModel):
    section: str  # "stack", "setup_guide", "suggested_schema", or "milestones"
    previous_answers: Optional[list[str]] = None
    instruction: Optional[str] = None

    @field_validator("instruction")
    @classmethod
    def validate_instruction(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 2000:
            raise ValueError("Regeneration instruction exceeds maximum allowed length of 2000 characters.")
        return v

    @field_validator("previous_answers")
    @classmethod
    def validate_previous_answers(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v:
            for idx, ans in enumerate(v, 1):
                if ans and len(ans) > 3000:
                    raise ValueError(f"Clarification answer {idx} exceeds maximum allowed length of 3000 characters.")
        return v


class CompareRequest(BaseModel):
    ideas: list[str]

    @field_validator("ideas")
    @classmethod
    def validate_ideas(cls, v: list[str]) -> list[str]:
        if v:
            for idx, idea in enumerate(v, 1):
                if idea and len(idea) > 3000:
                    raise ValueError(f"Compare idea {idx} exceeds maximum allowed length of 3000 characters.")
        return v


class AskRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        if v and len(v) > 4000:
            raise ValueError("Chat message exceeds maximum allowed length of 4000 characters.")
        return v


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

    @field_validator("idea")
    @classmethod
    def validate_idea(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 5000:
            raise ValueError("Project idea exceeds maximum allowed length of 5000 characters.")
        return v


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
