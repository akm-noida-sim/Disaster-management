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
    connection.execute("PRAGMA foreign_keys = ON")
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
                role TEXT NOT NULL DEFAULT 'student',
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

            CREATE TABLE IF NOT EXISTS buildings (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS building_floors (
                building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
                floor_number INTEGER NOT NULL,
                label TEXT NOT NULL,
                image_reference TEXT,
                PRIMARY KEY (building_id, floor_number)
            );

            CREATE TABLE IF NOT EXISTS building_nodes (
                id TEXT NOT NULL,
                building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
                floor_number INTEGER NOT NULL,
                node_type TEXT NOT NULL,
                label TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                capacity INTEGER NOT NULL DEFAULT 0,
                metadata_json TEXT NOT NULL DEFAULT '{}',
                PRIMARY KEY (building_id, id)
            );

            CREATE TABLE IF NOT EXISTS building_edges (
                id TEXT NOT NULL,
                building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
                source_node_id TEXT NOT NULL,
                target_node_id TEXT NOT NULL,
                distance REAL NOT NULL,
                capacity INTEGER NOT NULL DEFAULT 150,
                is_active INTEGER NOT NULL DEFAULT 1,
                metadata_json TEXT NOT NULL DEFAULT '{}',
                PRIMARY KEY (building_id, id)
            );

            CREATE TABLE IF NOT EXISTS node_occupancy (
                building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
                node_id TEXT NOT NULL,
                people_count INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (building_id, node_id)
            );

            CREATE TABLE IF NOT EXISTS hazards (
                id TEXT PRIMARY KEY,
                building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
                node_id TEXT NOT NULL,
                hazard_type TEXT NOT NULL,
                severity INTEGER NOT NULL,
                is_blocking INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS evacuation_events (
                id TEXT PRIMARY KEY,
                building_id TEXT NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_building_nodes_building
                ON building_nodes(building_id, floor_number);
            CREATE INDEX IF NOT EXISTS idx_building_edges_building
                ON building_edges(building_id);
            CREATE INDEX IF NOT EXISTS idx_hazards_active
                ON hazards(building_id, is_active);
            CREATE INDEX IF NOT EXISTS idx_events_building
                ON evacuation_events(building_id, created_at);
            """
        )
        # Safe forward migration for databases created by the first MVP.
        student_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(students)").fetchall()
        }
        if "role" not in student_columns:
            connection.execute(
                "ALTER TABLE students ADD COLUMN role TEXT NOT NULL DEFAULT 'student'"
            )
