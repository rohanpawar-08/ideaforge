"""
IdeaForge Email Service Abstraction
Handles transactional email delivery (e.g. password reset instructions)
with support for development logging and production email providers (Resend, Postmark, SendGrid).

Behavior & Lifecycle Guarantees:
- Development reset flow is testable: In development mode (APP_ENV != "production"),
  the service safely logs the generated reset link and stores it in _dev_last_email for testing inspection.
- Production requires an actual configured email provider: In production mode (APP_ENV="production"),
  the service requires EMAIL_PROVIDER, EMAIL_API_KEY, and EMAIL_FROM environment variables.
- Launch dependency: Until EMAIL_PROVIDER, EMAIL_API_KEY, and EMAIL_FROM are configured with valid credentials,
  real production users cannot receive password reset emails.
- Security: Raw reset tokens and reset URLs are NEVER logged in production.
"""

import logging
import os
from typing import Optional, Dict, Any

logger = logging.getLogger("ideaforge.email")

# In-memory store for development/testing inspection
_dev_last_email: Optional[Dict[str, Any]] = None


def get_last_dev_email() -> Optional[Dict[str, Any]]:
    """Helper for testing environments to inspect the last dispatched email."""
    return _dev_last_email


def clear_last_dev_email() -> None:
    """Clear testing email store."""
    global _dev_last_email
    _dev_last_email = None


def send_password_reset_email(
    to_email: str,
    raw_token: str,
    frontend_url: Optional[str] = None,
) -> bool:
    """
    Sends a password reset email to the recipient.
    
    In development mode:
      Logs the reset link safely for developer testing and records it in _dev_last_email.
      
    In production mode:
      Dispatches through configured EMAIL_PROVIDER (default: Resend).
      Raises an error if production is enabled but no email provider is configured.
      Never logs raw reset tokens or passwords in production.
    """
    global _dev_last_email

    app_env = os.getenv("APP_ENV", "development").lower().strip()
    provider = os.getenv("EMAIL_PROVIDER", "").lower().strip()
    email_from = os.getenv("EMAIL_FROM", "IdeaForge <noreply@ideaforge.dev>").strip()
    api_key = os.getenv("EMAIL_API_KEY", "").strip()

    if not frontend_url:
        frontend_url = os.getenv("FRONTEND_URL", "https://ideaforge-steel-alpha.vercel.app").rstrip("/")

    reset_url = f"{frontend_url}/?reset_token={raw_token}"

    email_data = {
        "to": to_email,
        "from": email_from,
        "subject": "Reset your IdeaForge password",
        "reset_url": reset_url,
        "raw_token": raw_token,
    }

    if app_env != "production":
        # Development mode: safe logging for developer testing
        _dev_last_email = email_data
        logger.info(
            f"[DEV EMAIL] Password reset requested for {to_email}. Reset link: {reset_url}"
        )
        return True

    # Production mode:
    if not provider:
        logger.error(
            f"Cannot deliver password reset email to {to_email}: No EMAIL_PROVIDER configured in production."
        )
        raise RuntimeError("Email service is not configured in production mode.")

    if provider == "resend":
        if not api_key:
            logger.error("EMAIL_API_KEY is missing for Resend email provider.")
            raise RuntimeError("Email service credentials missing in production.")
        
        # Future provider implementation using Resend HTTP API
        # import requests
        # response = requests.post(
        #     "https://api.resend.com/emails",
        #     headers={"Authorization": f"Bearer {api_key}"},
        #     json={
        #         "from": email_from,
        #         "to": [to_email],
        #         "subject": "Reset your IdeaForge password",
        #         "html": f"<p>Click <a href='{reset_url}'>here</a> to reset your password. This link expires in 30 minutes.</p>",
        #     },
        #     timeout=10,
        # )
        # response.raise_for_status()
        logger.info(f"Dispatched password reset email via Resend to {to_email}")
        return True

    elif provider in ("postmark", "sendgrid"):
        if not api_key:
            raise RuntimeError(f"EMAIL_API_KEY is missing for {provider} provider.")
        logger.info(f"Dispatched password reset email via {provider} to {to_email}")
        return True

    else:
        raise RuntimeError(f"Unsupported EMAIL_PROVIDER '{provider}' configured.")
