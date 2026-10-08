from typing import Optional, List
from pydantic import BaseModel, field_validator, model_validator, ConfigDict


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


class TaskPatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[str] = None
    note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v_norm = v.strip().lower()
            if v_norm not in ("todo", "in_progress", "done"):
                raise ValueError("Status must be one of: 'todo', 'in_progress', 'done'.")
            return v_norm
        return v

    @field_validator("note")
    @classmethod
    def validate_note(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 2000:
            raise ValueError("Task note exceeds maximum allowed length of 2000 characters.")
        return v

    @model_validator(mode="after")
    def validate_at_least_one(self):
        if self.status is None and self.note is None:
            raise ValueError("At least one of 'status' or 'note' must be provided.")
        return self


class ImportProgressItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    legacy_task_key: str
    completed: bool = True

    @field_validator("legacy_task_key")
    @classmethod
    def validate_legacy_task_key(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("legacy_task_key cannot be empty.")
        if len(v) > 500:
            raise ValueError("legacy_task_key exceeds maximum length of 500 characters.")
        return v.strip()


class ImportProgressRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: List[ImportProgressItem]

    @field_validator("items")
    @classmethod
    def validate_items(cls, v: List[ImportProgressItem]) -> List[ImportProgressItem]:
        if len(v) > 500:
            raise ValueError("Exceeded maximum batch size of 500 import items.")
        return v


class ImportProgressResponse(BaseModel):
    imported: int
    skipped: int

