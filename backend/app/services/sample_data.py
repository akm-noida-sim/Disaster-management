"""Repeatable sample data for the five-floor college evacuation model."""

from __future__ import annotations

from ..domain.models import (
    BuildingCreate,
    BuildingGraphCreate,
    FloorCreate,
    GraphEdgeCreate,
    GraphNodeCreate,
    NodeType,
)

_DIRECTIONS = {
    "north": (50.0, 12.0),
    "east": (88.0, 50.0),
    "south": (50.0, 88.0),
    "west": (12.0, 50.0),
}
_ROOMS = [
    (1, 29.0, 19.0, "north"),
    (2, 71.0, 19.0, "north"),
    (3, 83.0, 34.0, "east"),
    (4, 83.0, 66.0, "east"),
    (5, 71.0, 81.0, "south"),
    (6, 29.0, 81.0, "south"),
    (7, 17.0, 66.0, "west"),
    (8, 17.0, 34.0, "west"),
]


def sample_building_graph() -> BuildingGraphCreate:
    """Return a realistic, editable five-floor building graph."""
    floors = [
        FloorCreate(floor_number=0, label="Ground Floor"),
        FloorCreate(floor_number=1, label="First Floor"),
        FloorCreate(floor_number=2, label="Second Floor"),
        FloorCreate(floor_number=3, label="Third Floor"),
        FloorCreate(floor_number=4, label="Fourth Floor"),
    ]
    nodes: list[GraphNodeCreate] = []
    edges: list[GraphEdgeCreate] = []

    def connect(source: str, target: str, distance: float, capacity: int = 80) -> None:
        edges.append(
            GraphEdgeCreate(
                id=f"edge-{source}-{target}",
                source_node_id=source,
                target_node_id=target,
                distance=distance,
                capacity=capacity,
            )
        )

    for floor in floors:
        floor_number = floor.floor_number
        hub_id = f"corridor-{floor_number}-central"
        nodes.append(
            GraphNodeCreate(
                id=hub_id,
                floor_number=floor_number,
                node_type=NodeType.CORRIDOR,
                label=f"{floor.label} central corridor",
                x=50,
                y=50,
                capacity=250,
            )
        )
        for direction, (x, y) in _DIRECTIONS.items():
            stair_id = f"stair-{direction}-{floor_number}"
            nodes.append(
                GraphNodeCreate(
                    id=stair_id,
                    floor_number=floor_number,
                    node_type=NodeType.STAIR,
                    label=f"{direction.title()} staircase · {floor.label}",
                    x=x,
                    y=y,
                    capacity=100,
                    metadata={"direction": direction},
                )
            )
            connect(hub_id, stair_id, distance=14, capacity=100)
            if floor_number > 0:
                connect(stair_id, f"stair-{direction}-{floor_number - 1}", distance=24, capacity=80)

        for room_number, x, y, direction in _ROOMS:
            prefix = "G" if floor_number == 0 else str(floor_number)
            room_id = f"room-{floor_number}-{room_number}"
            nodes.append(
                GraphNodeCreate(
                    id=room_id,
                    floor_number=floor_number,
                    node_type=NodeType.ROOM,
                    label=f"Room {prefix}{room_number:02d}",
                    x=x,
                    y=y,
                    capacity=70,
                    metadata={"nearest_stair_direction": direction},
                )
            )
            connect(room_id, hub_id, distance=12, capacity=70)
            connect(room_id, f"stair-{direction}-{floor_number}", distance=8, capacity=70)

    exit_positions = {
        "north": (50.0, 7.0),
        "east": (93.0, 50.0),
        "south": (50.0, 93.0),
        "west": (7.0, 50.0),
    }
    for direction, (x, y) in exit_positions.items():
        exit_id = f"exit-{direction}"
        nodes.append(
            GraphNodeCreate(
                id=exit_id,
                floor_number=0,
                node_type=NodeType.EXIT,
                label=f"{direction.title()} building exit",
                x=x,
                y=y,
                capacity=220,
                metadata={"direction": direction},
            )
        )
        connect(f"stair-{direction}-0", exit_id, distance=6, capacity=220)

    return BuildingGraphCreate(
        building=BuildingCreate(
            name="Sample Five-Storey College Building",
            description=(
                "Editable sample graph with 5 levels, 40 rooms, four staircases per "
                "level and four ground-floor exits."
            ),
        ),
        floors=floors,
        nodes=nodes,
        edges=edges,
    )
