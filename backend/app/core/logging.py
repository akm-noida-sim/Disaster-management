"""Structured, deployment-safe logging setup."""

from __future__ import annotations

import logging
import os


def configure_logging() -> None:
    """Configure once at API startup without clobbering host logging handlers."""
    level = os.getenv("SMART_EVAC_LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, level, logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
