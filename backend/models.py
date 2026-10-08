from sqlalchemy import Column, Integer, String, Text, JSON, DateTime, ForeignKey, Boolean, Index, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    roadmaps = relationship("Roadmap", back_populates="user", cascade="all, delete-orphan")
    reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    ai_usage_events = relationship("AIUsageEvent", back_populates="user", cascade="all, delete-orphan")
    task_states = relationship("ProjectTaskState", back_populates="user", cascade="all, delete-orphan")


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    original_idea = Column(String, nullable=False)
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="roadmaps")
    task_states = relationship("ProjectTaskState", back_populates="roadmap", cascade="all, delete-orphan")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token_hash = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="reset_tokens")


class AIUsageEvent(Base):
    __tablename__ = "ai_usage_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    provider = Column(String, nullable=False, default="groq")
    model = Column(String, nullable=False, default="llama-3.3-70b-versatile")
    success = Column(Boolean, nullable=False, default=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)

    user = relationship("User", back_populates="ai_usage_events")

    __table_args__ = (
        Index("ix_ai_usage_events_user_action_created", "user_id", "action", "created_at"),
    )


class ProjectTaskState(Base):
    __tablename__ = "project_task_states"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(String(160), nullable=False)
    task_fingerprint = Column(String(160), nullable=False)
    phase_key = Column(String(120), nullable=True)
    task_order = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="todo")
    note = Column(Text, nullable=True)
    source_schema = Column(Integer, nullable=False, default=2)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", back_populates="task_states")
    roadmap = relationship("Roadmap", back_populates="task_states")

    __table_args__ = (
        UniqueConstraint("roadmap_id", "task_id", name="uq_project_task_states_roadmap_task"),
        Index("ix_project_task_states_roadmap_status", "roadmap_id", "status"),
        Index("ix_project_task_states_user_roadmap", "user_id", "roadmap_id"),
    )
