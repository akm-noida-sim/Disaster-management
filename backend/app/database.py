"""Small SQLite data layer for the SMART EVAC MVP.

The functions in this module deliberately use Python's built-in sqlite3 package.
That keeps the first backend stage easy to run. A PostgreSQL/SQLAlchemy repository
can replace these queries later without changing the API routes.
"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DATABASE_PATH = Path(__file__).resolve().parent.parent / "smart_evac.db"


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    """Yield one SQLite connection, then commit and close it safely."""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> None:
    """Create the MVP tables if they do not exist yet."""
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS students (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS drill_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id TEXT NOT NULL,
                scenario TEXT NOT NULL,
                evacuation_time TEXT NOT NULL,
                score INTEGER NOT NULL,
                mistakes INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
