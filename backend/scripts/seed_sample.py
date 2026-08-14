"""Seed the editable five-storey college building sample.

Run from the repository root:
    python backend/scripts/seed_sample.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import initialize_database
from app.repositories.building_repository import BuildingRepository
from app.services.sample_data import sample_building_graph


def main() -> None:
    initialize_database()
    repository = BuildingRepository()
    existing = next(
        (
            building
            for building in repository.list_buildings()
            if building.name == "Sample Five-Storey College Building"
        ),
        None,
    )
    if existing:
        print(f"Sample building already exists: {existing.id}")
        return
    building = repository.create_graph(sample_building_graph())
    print(f"Seeded sample building: {building.id}")


if __name__ == "__main__":
    main()
