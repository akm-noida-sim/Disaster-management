"""FastAPI entry point for SMART EVAC."""

from __future__ import annotations

import hashlib
import sqlite3
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection, initialize_database
from .schemas import (
    DrillResultCreate,
    DrillResultResponse,
    LoginRequest,
    RegisterRequest,
    StudentResponse,
)


def hash_password(password: str) -> str:
    """Hash passwords for this classroom MVP.

    Use a password-specific algorithm such as bcrypt or Argon2 before deployment.
    """
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(
    title="SMART EVAC API",
    version="0.1.0",
    description="Backend API for the SMART EVAC disaster-training MVP.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "null",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    """Confirm that the API is online."""
    return {"status": "ok", "service": "smart-evac-api"}


@app.post("/api/auth/register", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def register_student(payload: RegisterRequest) -> StudentResponse:
    """Create a student account for the training platform."""
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                "INSERT INTO students (name, email, password_hash) VALUES (?, ?, ?)",
                (payload.name.strip(), payload.email.lower().strip(), hash_password(payload.password)),
            )
            student_id = cursor.lastrowid
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=409, detail="An account already uses this email.") from error

    return StudentResponse(id=student_id, name=payload.name.strip(), email=payload.email.lower().strip())


@app.post("/api/auth/login", response_model=StudentResponse)
def login_student(payload: LoginRequest) -> StudentResponse:
    """Validate credentials and return the matching student profile."""
    with get_connection() as connection:
        student = connection.execute(
            "SELECT id, name, email FROM students WHERE email = ? AND password_hash = ?",
            (payload.email.lower().strip(), hash_password(payload.password)),
        ).fetchone()
    if student is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return StudentResponse(**dict(student))


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
