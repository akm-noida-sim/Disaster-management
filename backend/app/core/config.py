"""Configuration for the SMART EVAC API.

Environment variables are deliberately the integration boundary for deployments;
never put live credentials or customer configuration in source code.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("SMART_EVAC_APP_NAME", "SMART EVAC API")
    environment: str = os.getenv("SMART_EVAC_ENV", "development")
    max_floor_plan_bytes: int = int(os.getenv("SMART_EVAC_MAX_FLOOR_PLAN_BYTES", "10485760"))
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv(
            "SMART_EVAC_CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,"
            "http://localhost:5173,http://127.0.0.1:5173,"
            "http://localhost:5500,http://127.0.0.1:5500,null",
        ).split(",")
        if origin.strip()
    )
    bootstrap_admin_emails: tuple[str, ...] = tuple(
        email.strip().lower()
        for email in os.getenv("SMART_EVAC_BOOTSTRAP_ADMIN_EMAILS", "").split(",")
        if email.strip()
    )
    auth_secret: str = os.getenv("SMART_EVAC_AUTH_SECRET", "development-only-change-me")
    require_auth: bool = os.getenv("SMART_EVAC_REQUIRE_AUTH", "false").lower() == "true"


settings = Settings()
