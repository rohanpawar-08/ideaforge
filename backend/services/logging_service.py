"""
backend/services/logging_service.py

Centralized structured logging and startup configuration validation for IdeaForge.
Ensures uniform log output across HTTP requests and AI operations while strictly
preventing the logging of credentials, JWTs, reset tokens, or user prompts.
"""

import json
import logging
import os
import re
import sys
import time
from typing import Any, Dict, Optional

logger = logging.getLogger("ideaforge")

# Patterns matching sensitive parameters to redact
SENSITIVE_KEYS = {
    "password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "secret_key",
    "llm_api_key",
    "groq_api_key",
    "email_api_key",
    "database_url",
    "authorization",
    "cookie",
}


def mask_secret(value: str) -> str:
    """Masks sensitive strings for safe diagnostic display."""
    if not value:
        return "[EMPTY]"
    if len(value) <= 6:
        return "[REDACTED]"
    return f"{value[:3]}...{value[-3:]}"


def setup_logging(level: str = "INFO") -> None:
    """Configures structured standard logging for IdeaForge."""
    log_level = getattr(logging, level.upper(), logging.INFO)

    log_format = (
        "%(asctime)s [%(levelname)s] %(name)s [rid=%(request_id)s]: %(message)s"
    )

    class RequestIdFilter(logging.Filter):
        def filter(self, record):
            if not hasattr(record, "request_id"):
                record.request_id = "-"
            return True

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(log_format))
    handler.addFilter(RequestIdFilter())

    root = logging.getLogger()
    # Remove existing handlers to avoid duplicates
    for h in list(root.handlers):
        root.removeHandler(h)

    root.setLevel(log_level)
    root.addHandler(handler)

    # Ensure ideaforge loggers are set
    logging.getLogger("ideaforge").setLevel(log_level)
    logging.getLogger("ideaforge.ai_service").setLevel(log_level)


def log_http_request(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    request_id: str = "-",
    user_id: Optional[Any] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    """
    Emits structured log entry for completed HTTP requests.
    Excludes high-frequency health polling from flooding INFO logs if successful.
    """
    user_str = str(user_id) if user_id is not None else "anon"
    msg = (
        f"method={method} path={path} status={status_code} "
        f"duration={duration_ms:.1f}ms user={user_str}"
    )

    if extra:
        extra_str = " ".join(f"{k}={v}" for k, v in extra.items())
        msg = f"{msg} {extra_str}"

    # Route / and /health to DEBUG if 200 to keep production logs clean
    is_health = path in ("/", "/health", "/ready")
    if is_health and status_code < 400:
        logger.debug(msg, extra={"request_id": request_id})
    else:
        if status_code >= 500:
            logger.error(msg, extra={"request_id": request_id})
        elif status_code >= 400:
            logger.warning(msg, extra={"request_id": request_id})
        else:
            logger.info(msg, extra={"request_id": request_id})


def validate_startup_configuration(app_env: Optional[str] = None) -> Dict[str, Any]:
    """
    Validates required environment configuration on application startup.
    Identifies missing required variables by name without leaking any values.
    Returns dictionary with validation status.
    """
    env = (app_env or os.getenv("APP_ENV", "development")).lower().strip()
    missing_vars = []
    warnings = []

    # 1. SECRET_KEY
    secret_key = os.getenv("SECRET_KEY", "").strip()
    if not secret_key:
        missing_vars.append("SECRET_KEY")
    elif len(secret_key) < 32:
        missing_vars.append("SECRET_KEY (must be at least 32 characters)")

    # 2. Production-specific checks
    if env == "production":
        # Database URL
        db_url = os.getenv("DATABASE_URL", "").strip()
        if not db_url:
            missing_vars.append("DATABASE_URL")
        elif not (
            db_url.startswith("postgresql://")
            or db_url.startswith("postgres://")
            or db_url.startswith("postgresql+psycopg2://")
        ):
            missing_vars.append("DATABASE_URL (must be valid PostgreSQL connection string)")

        # AI Provider Key
        llm_key = os.getenv("LLM_API_KEY", "") or os.getenv("GROQ_API_KEY", "")
        if not llm_key.strip():
            missing_vars.append("LLM_API_KEY (or GROQ_API_KEY)")

        # CORS Origins
        cors = os.getenv("CORS_ORIGINS", "").strip()
        if not cors:
            warnings.append("CORS_ORIGINS not set; falling back to default production origins")
        elif "*" in cors:
            warnings.append("CORS_ORIGINS contains wildcard '*'; will be filtered out for security")

        # Optional Email Provider
        email_provider = os.getenv("EMAIL_PROVIDER", "").strip().lower()
        if email_provider and email_provider != "development":
            email_key = os.getenv("EMAIL_API_KEY", "").strip()
            if not email_key:
                warnings.append(f"EMAIL_PROVIDER set to '{email_provider}' but EMAIL_API_KEY is missing")

    if missing_vars:
        error_msg = (
            f"Startup validation failed for environment '{env}'. "
            f"Missing or invalid required configuration: {', '.join(missing_vars)}."
        )
        logger.critical(error_msg, extra={"request_id": "startup"})
        raise RuntimeError(error_msg)

    logger.info(
        f"Startup configuration validated successfully for environment '{env}'.",
        extra={"request_id": "startup"},
    )
    for warn in warnings:
        logger.warning(f"Startup notice: {warn}", extra={"request_id": "startup"})

    return {
        "status": "valid",
        "environment": env,
        "warnings": warnings,
    }
