"""Unit tests for the congestion-aware indoor route planner."""

from __future__ import annotations

from app import database
from app.domain.models import (
    EvacuationPlanRequest,
    GraphEdgeCreate,
    GraphNodeCreate,
    HazardCreate,
    HazardType,
    NodeType,
    OccupancyUpdate,
)
from app.repositories.building_repository import BuildingRepository
from app.services.route_planner import EvacuationRoutePlanner
from app.services.sample_data import sample_building_graph


def create_test_repository(tmp_path) -> tuple[BuildingRepository, str]:
    """Create an isolated building graph in a temporary SQLite database."""
    database.DATABASE_PATH = tmp_path / "smart_evac_test.db"
    database.initialize_database()
    repository = BuildingRepository()
    building = repository.create_graph(sample_building_graph())
    return repository, building.id


def test_astar_routes_top_floor_room_to_ground_exit(tmp_path) -> None:
    repository, building_id = create_test_repository(tmp_path)
    planner = EvacuationRoutePlanner(repository)

    plan = planner.plan(
        building_id,
        EvacuationPlanRequest(origin_node_ids=["room-4-3"], algorithm="astar"),
    )

    route = plan.routes[0]
    assert route.status == "routed"
    assert route.exit_node_id is not None
    assert route.path[0] == "room-4-3"
    assert route.path[-1].startswith("exit-")
    assert any(node_id == "stair-east-0" for node_id in route.path)


def test_dijkstra_reroutes_when_nearest_staircase_is_blocked(tmp_path) -> None:
    repository, building_id = create_test_repository(tmp_path)
    planner = EvacuationRoutePlanner(repository)
    repository.create_hazard(
        building_id,
        HazardCreate(
            node_id="stair-east-3",
            hazard_type=HazardType.FIRE,
            severity=5,
            is_blocking=True,
        ),
    )

    plan = planner.plan(
        building_id,
        EvacuationPlanRequest(origin_node_ids=["room-3-3"], algorithm="dijkstra"),
    )

    route = plan.routes[0]
    assert route.status == "routed"
    assert "stair-east-3" not in route.path
    assert route.exit_node_id != "exit-east"


def test_occupancy_balances_people_across_multiple_exits(tmp_path) -> None:
    repository, building_id = create_test_repository(tmp_path)
    planner = EvacuationRoutePlanner(repository)
    repository.upsert_occupancy(
        building_id,
        [
            OccupancyUpdate(node_id="room-4-1", people_count=70),
            OccupancyUpdate(node_id="room-4-3", people_count=70),
            OccupancyUpdate(node_id="room-4-5", people_count=70),
            OccupancyUpdate(node_id="room-4-7", people_count=70),
        ],
    )

    plan = planner.plan(
        building_id,
        EvacuationPlanRequest(
            origin_node_ids=["room-4-1", "room-4-3", "room-4-5", "room-4-7"],
            algorithm="astar",
            congestion_weight=100,
        ),
    )

    assigned_exits = [exit_id for exit_id, people in plan.exit_assignments.items() if people]
    assert plan.total_people_routed == 280
    assert len(assigned_exits) >= 3


def test_editor_can_add_a_marker_and_connect_it_to_the_graph(tmp_path) -> None:
    repository, building_id = create_test_repository(tmp_path)
    repository.create_node(
        building_id,
        GraphNodeCreate(
            id="editor-room-g09",
            floor_number=0,
            node_type=NodeType.ROOM,
            label="Room G09",
            x=60,
            y=60,
            capacity=65,
        ),
    )
    repository.create_edge(
        building_id,
        GraphEdgeCreate(
            id="edge-editor-room-g09-corridor",
            source_node_id="editor-room-g09",
            target_node_id="corridor-0-central",
            distance=15,
            capacity=65,
        ),
    )

    graph = repository.get_graph(building_id)
    assert any(node.id == "editor-room-g09" for node in graph.nodes)
    assert any(edge.id == "edge-editor-room-g09-corridor" for edge in graph.edges)
