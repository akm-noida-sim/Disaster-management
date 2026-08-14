"""Tests for password hashing, legacy upgrades, and signed operator sessions."""

from __future__ import annotations

import hashlib

from app import database
from app.core.security import read_access_token
from app.main import login_student, register_student
from app.schemas import LoginRequest, RegisterRequest


def _use_test_database(tmp_path) -> None:
    database.DATABASE_PATH = tmp_path / "smart_evac_auth_test.db"
    database.initialize_database()


def test_registration_creates_a_signed_session(tmp_path) -> None:
    _use_test_database(tmp_path)
    account = register_student(
        RegisterRequest(name="Safety Officer", email="safety@example.edu", password="secure-password")
    )

    token_user = read_access_token(account.access_token)
    assert account.role == "student"
    assert token_user.student_id == account.id
    assert token_user.role == "student"


def test_login_upgrades_legacy_sha256_hashes(tmp_path) -> None:
    _use_test_database(tmp_path)
    legacy_hash = hashlib.sha256(b"old-password").hexdigest()
    with database.get_connection() as connection:
        connection.execute(
            "INSERT INTO students (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            ("Existing User", "existing@example.edu", legacy_hash, "student"),
        )

    account = login_student(LoginRequest(email="existing@example.edu", password="old-password"))
    with database.get_connection() as connection:
        stored_hash = connection.execute(
            "SELECT password_hash FROM students WHERE id = ?", (account.id,)
        ).fetchone()["password_hash"]

    assert account.access_token
    assert stored_hash.startswith("pbkdf2_sha256$")
