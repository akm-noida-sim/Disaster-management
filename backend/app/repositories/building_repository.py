"""Persistence operations for editable building evacuation graphs."""

from __future__ import annotations

import json
import uuid
from collections.abc import Iterable

from ..database import get_connection
from ..domain.models import (
    BuildingCreate,
    BuildingGraphCreate,
    BuildingGraphResponse,
    BuildingResponse,
    FloorCreate,
    GraphEdgeCreate,
    GraphEdgeResponse,
    GraphNodeCreate,
    GraphNodeResponse,
    HazardCreate,
    HazardResponse,
    OccupancyUpdate,
)


class BuildingNotFoundError(LookupError):
    """Raised when a requested building does not exist."""


def _node_response(row: dict) -> GraphNodeResponse:
    return GraphNodeResponse(
        id=row["id"],
        building_id=row["building_id"],
        floor_number=row["floor_number"],
        node_type=row["node_type"],
        label=row["label"],
        x=row["x"],
        y=row["y"],
        capacity=row["capacity"],
        metadata=json.loads(row["metadata_json"]),
    )


def _edge_response(row: dict) -> GraphEdgeResponse:
    return GraphEdgeResponse(
        id=row["id"],
        building_id=row["building_id"],
        source_node_id=row["source_node_id"],
        target_node_id=row["target_node_id"],
        distance=row["distance"],
        capacity=row["capacity"],
        is_active=bool(row["is_active"]),
        metadata=json.loads(row["metadata_json"]),
    )


class BuildingRepository:
    """SQLite repository that keeps graph reads separate from route planning."""

    def list_buildings(self) -> list[BuildingResponse]:
        with get_connection() as connection:
            rows = connection.execute(
                "SELECT id, name, description FROM buildings ORDER BY created_at DESC"
            ).fetchall()
        return [BuildingResponse(**dict(row)) for row in rows]

    def create_building(self, payload: BuildingCreate) -> BuildingResponse:
        building_id = str(uuid.uuid4())
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO buildings (id, name, description) VALUES (?, ?, ?)",
                (building_id, payload.name.strip(), payload.description.strip()),
            )
        return BuildingResponse(id=building_id, **payload.model_dump())

    def create_graph(self, payload: BuildingGraphCreate) -> BuildingGraphResponse:
        building_id = str(uuid.uuid4())
        with get_connection() as connection:
            connection.execute(
                "INSERT INTO buildings (id, name, description) VALUES (?, ?, ?)",
                (building_id, payload.building.name.strip(), payload.building.description.strip()),
            )
            self._insert_graph_parts(connection, building_id, payload.floors, payload.nodes, payload.edges)
        return self.get_graph(building_id)

    def _insert_graph_parts(
        self,
        connection,
        building_id: str,
        floors: Iterable[FloorCreate],
        nodes: Iterable[GraphNodeCreate],
        edges: Iterable[GraphEdgeCreate],
    ) -> None:
        connection.executemany(
            """
            INSERT INTO building_floors (building_id, floor_number, label, image_reference)
            VALUES (?, ?, ?, ?)
            """,
            [
                (building_id, floor.floor_number, floor.label, floor.image_reference)
                for floor in floors
            ],
        )
        connection.executemany(
            """
            INSERT INTO building_nodes
            (id, building_id, floor_number, node_type, label, x, y, capacity, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    node.id,
                    building_id,
                    node.floor_number,
                    node.node_type.value,
                    node.label,
                    node.x,
                    node.y,
                    node.capacity,
                    json.dumps(node.metadata),
                )
                for node in nodes
            ],
        )
        connection.executemany(
            """
            INSERT INTO building_edges
            (id, building_id, source_node_id, target_node_id, distance, capacity, is_active, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    edge.id,
                    building_id,
                    edge.source_node_id,
                    edge.target_node_id,
                    edge.distance,
                    edge.capacity,
                    int(edge.is_active),
                    json.dumps(edge.metadata),
                )
                for edge in edges
            ],
        )

    def get_graph(self, building_id: str) -> BuildingGraphResponse:
        with get_connection() as connection:
            building = connection.execute(
                "SELECT id, name, description FROM buildings WHERE id = ?", (building_id,)
            ).fetchone()
            if building is None:
                raise BuildingNotFoundError(building_id)
            floors = connection.execute(
                """
                SELECT floor_number, label, image_reference FROM building_floors
                WHERE building_id = ? ORDER BY floor_number
                """,
                (building_id,),
            ).fetchall()
            nodes = connection.execute(
                "SELECT * FROM building_nodes WHERE building_id = ? ORDER BY floor_number, label",
                (building_id,),
            ).fetchall()
            edges = connection.execute(
                "SELECT * FROM building_edges WHERE building_id = ? ORDER BY id",
                (building_id,),
            ).fetchall()
        return BuildingGraphResponse(
            **dict(building),
            floors=[FloorCreate(**dict(floor)) for floor in floors],
            nodes=[_node_response(dict(node)) for node in nodes],
            edges=[_edge_response(dict(edge)) for edge in edges],
        )

    def replace_floor_image_reference(
        self, building_id: str, floor_number: int, image_reference: str
    ) -> None:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                UPDATE building_floors SET image_reference = ?
                WHERE building_id = ? AND floor_number = ?
                """,
                (image_reference, building_id, floor_number),
            )
            if cursor.rowcount != 1:
                raise BuildingNotFoundError(building_id)

    def create_node(self, building_id: str, payload: GraphNodeCreate) -> GraphNodeResponse:
        """Add a manually positioned editor marker to an existing building graph."""
        with get_connection() as connection:
            self._ensure_building(connection, building_id)
            floor = connection.execute(
                "SELECT 1 FROM building_floors WHERE building_id = ? AND floor_number = ?",
                (building_id, payload.floor_number),
            ).fetchone()
            if floor is None:
                raise ValueError("The selected floor does not exist in this building.")
            connection.execute(
                """
                INSERT INTO building_nodes
                (id, building_id, floor_number, node_type, label, x, y, capacity, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.id,
                    building_id,
                    payload.floor_number,
                    payload.node_type.value,
                    payload.label,
                    payload.x,
                    payload.y,
                    payload.capacity,
                    json.dumps(payload.metadata),
                ),
            )
        return GraphNodeResponse(building_id=building_id, **payload.model_dump())

    def create_edge(self, building_id: str, payload: GraphEdgeCreate) -> GraphEdgeResponse:
        """Connect two existing graph nodes from the visual floor-plan editor."""
        with get_connection() as connection:
            self._ensure_building(connection, building_id)
            linked_nodes = connection.execute(
                """
                SELECT COUNT(*) AS total FROM building_nodes
                WHERE building_id = ? AND id IN (?, ?)
                """,
                (building_id, payload.source_node_id, payload.target_node_id),
            ).fetchone()["total"]
            if linked_nodes != 2:
                raise ValueError("An edge can only connect existing nodes in this building.")
            connection.execute(
                """
                INSERT INTO building_edges
                (id, building_id, source_node_id, target_node_id, distance, capacity, is_active, metadata_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.id,
                    building_id,
                    payload.source_node_id,
                    payload.target_node_id,
                    payload.distance,
                    payload.capacity,
                    int(payload.is_active),
                    json.dumps(payload.metadata),
                ),
            )
        return GraphEdgeResponse(building_id=building_id, **payload.model_dump())

    def upsert_occupancy(self, building_id: str, updates: Iterable[OccupancyUpdate]) -> None:
        with get_connection() as connection:
            self._ensure_building(connection, building_id)
            connection.executemany(
                """
                INSERT INTO node_occupancy (building_id, node_id, people_count, updated_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(building_id, node_id)
                DO UPDATE SET people_count = excluded.people_count, updated_at = CURRENT_TIMESTAMP
                """,
                [(building_id, update.node_id, update.people_count) for update in updates],
            )

    def get_occupancy(self, building_id: str) -> dict[str, int]:
        with get_connection() as connection:
            self._ensure_building(connection, building_id)
            rows = connection.execute(
                "SELECT node_id, people_count FROM node_occupancy WHERE building_id = ?",
                (building_id,),
            ).fetchall()
        return {row["node_id"]: row["people_count"] for row in rows}

    def create_hazard(self, building_id: str, payload: HazardCreate) -> HazardResponse:
        hazard_id = str(uuid.uuid4())
        with get_connection() as connection:
            self._ensure_building(connection, building_id)
            connection.execute(
                """
                INSERT INTO hazards
                (id, building_id, node_id, hazard_type, severity, is_blocking, is_active)
                VALUES (?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    hazard_id,
                    building_id,
                    payload.node_id,
                    payload.hazard_type.value,
                    payload.severity,
                    int(payload.is_blocking),
                ),
            )
        return HazardResponse(id=hazard_id, building_id=building_id, is_active=True, **payload.model_dump())

    def active_hazards(self, building_id: str) -> list[HazardResponse]:
        with get_connection() as connection:
            self._ensure_building(connection, building_id)
            rows = connection.execute(
                """
                SELECT id, building_id, node_id, hazard_type, severity, is_blocking, is_active
                FROM hazards WHERE building_id = ? AND is_active = 1
                ORDER BY severity DESC, created_at DESC
                """,
                (building_id,),
            ).fetchall()
        return [
            HazardResponse(
                id=row["id"],
                building_id=row["building_id"],
                node_id=row["node_id"],
                hazard_type=row["hazard_type"],
                severity=row["severity"],
                is_blocking=bool(row["is_blocking"]),
                is_active=bool(row["is_active"]),
            )
            for row in rows
        ]

    def deactivate_hazard(self, building_id: str, hazard_id: str) -> None:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                UPDATE hazards SET is_active = 0, updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND building_id = ?
                """,
                (hazard_id, building_id),
            )
            if cursor.rowcount != 1:
                raise BuildingNotFoundError(building_id)

    def record_event(self, building_id: str, event_type: str, payload: dict) -> str:
        event_id = str(uuid.uuid4())
        with get_connection() as connection:
            self._ensure_building(connection, building_id)
            connection.execute(
                "INSERT INTO evacuation_events (id, building_id, event_type, payload_json) VALUES (?, ?, ?, ?)",
                (event_id, building_id, event_type, json.dumps(payload)),
            )
        return event_id

    @staticmethod
    def _ensure_building(connection, building_id: str) -> None:
        if connection.execute("SELECT 1 FROM buildings WHERE id = ?", (building_id,)).fetchone() is None:
            raise BuildingNotFoundError(building_id)
