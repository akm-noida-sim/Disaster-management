"""FastAPI entry point for SMART EVAC."""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .core.config import settings
from .core.logging import configure_logging
from .core.security import create_access_token
from .database import get_connection, initialize_database
from .routers import buildings, uploads
from .schemas import (
    DrillResultCreate,
    DrillResultResponse,
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    StudentResponse,
)

STORAGE_DIRECTORY = Path(__file__).resolve().parent.parent / "storage"
STORAGE_DIRECTORY.mkdir(exist_ok=True)


_PBKDF2_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    """Use a salted, slow password hash without adding a runtime dependency."""
    salt = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify current hashes and retain a one-time compatibility path for MVP users."""
    if stored_hash.startswith("pbkdf2_sha256$"):
        try:
            _, iterations, salt, expected_digest = stored_hash.split("$", 3)
            actual_digest = hashlib.pbkdf2_hmac(
                "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations)
            ).hex()
            return hmac.compare_digest(actual_digest, expected_digest)
        except (TypeError, ValueError):
            return False
    # Accounts made by the first development build upgrade on their next successful login.
    return hmac.compare_digest(hashlib.sha256(password.encode("utf-8")).hexdigest(), stored_hash)


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    initialize_database()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description=(
        "Decision-support and simulation API for editable building graphs, "
        "evacuation planning and training workflows."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=str(STORAGE_DIRECTORY)), name="uploads")
app.include_router(buildings.router)
app.include_router(uploads.router)

logger = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, error: Exception) -> JSONResponse:
    """Return safe errors while retaining the original exception in server logs."""
    logger.exception("Unhandled API exception", exc_info=error)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred. Check server logs for details."},
    )


@app.get("/api/health")
def health_check() -> dict[str, str]:
    """Confirm that the API is online."""
    return {
        "status": "ok",
        "service": "smart-evac-api",
        "environment": settings.environment,
    }


@app.post("/api/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_student(payload: RegisterRequest) -> AuthResponse:
    """Create a student account for the training platform."""
    try:
        email = payload.email.lower().strip()
        role = "admin" if email in settings.bootstrap_admin_emails else "student"
        with get_connection() as connection:
            cursor = connection.execute(
                "INSERT INTO students (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
                (payload.name.strip(), email, hash_password(payload.password), role),
            )
            student_id = cursor.lastrowid
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="An account already uses this email.") from error

    return AuthResponse(
        id=student_id,
        name=payload.name.strip(),
        email=email,
        role=role,
        access_token=create_access_token(student_id, role),
    )


@app.post("/api/auth/login", response_model=AuthResponse)
def login_student(payload: LoginRequest) -> AuthResponse:
    """Validate credentials and return the matching student profile."""
    with get_connection() as connection:
        student = connection.execute(
            "SELECT id, name, email, password_hash, role FROM students WHERE email = ?",
            (payload.email.lower().strip(),),
        ).fetchone()
        if student is not None and verify_password(payload.password, student["password_hash"]):
            if not student["password_hash"].startswith("pbkdf2_sha256$"):
                connection.execute(
                    "UPDATE students SET password_hash = ? WHERE id = ?",
                    (hash_password(payload.password), student["id"]),
                )
        else:
            student = None
    if student is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return AuthResponse(
        **{key: student[key] for key in ("id", "name", "email", "role")},
        access_token=create_access_token(student["id"], student["role"]),
    )


@app.post("/api/results", response_model=DrillResultResponse, status_code=status.HTTP_201_CREATED)
def save_drill_result(payload: DrillResultCreate) -> DrillResultResponse:
    """Store a completed evacuation drill."""
    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO drill_results (student_id, scenario, evacuation_time, score, mistakes)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                payload.student_id,
                payload.scenario,
                payload.evacuation_time,
                payload.score,
                payload.mistakes,
            ),
        )
        result = connection.execute(
            """
            SELECT id, student_id, scenario, evacuation_time, score, mistakes, created_at
            FROM drill_results WHERE id = ?
            """,
            (cursor.lastrowid,),
        ).fetchone()
    return DrillResultResponse(**dict(result))


@app.get("/api/results", response_model=list[DrillResultResponse])
def get_drill_results(student_id: str = "demo-student") -> list[DrillResultResponse]:
    """Return the most recent saved drill results for a student."""
    with get_connection() as connection:
        results = connection.execute(
            """
            SELECT id, student_id, scenario, evacuation_time, score, mistakes, created_at
            FROM drill_results
            WHERE student_id = ?
            ORDER BY created_at DESC
            LIMIT 10
            """,
            (student_id,),
        ).fetchall()
    return [DrillResultResponse(**dict(result)) for result in results]


@app.delete("/api/results", status_code=status.HTTP_204_NO_CONTENT)
def clear_drill_results(student_id: str = "demo-student") -> None:
    """Delete the drill history for one student."""
    with get_connection() as connection:
        connection.execute(
            "DELETE FROM drill_results WHERE student_id = ?",
            (student_id,),
        )
