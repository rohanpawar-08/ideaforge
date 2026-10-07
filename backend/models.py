from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Boolean, Index
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


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    original_idea = Column(String, nullable=False)
    data = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="roadmaps")


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

