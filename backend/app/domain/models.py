"""Pydantic contracts for editable building graphs and evacuation planning."""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class NodeType(StrEnum):
    ROOM = "room"
    CORRIDOR = "corridor"
    STAIR = "stair"
    EXIT = "exit"
    RESTRICTED = "restricted"
    ASSEMBLY = "assembly"


class BuildingCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=1000)


class BuildingResponse(BuildingCreate):
    id: str


class FloorCreate(BaseModel):
    floor_number: int = Field(ge=0, le=100)
    label: str = Field(min_length=1, max_length=80)
    image_reference: str | None = None


class GraphNodeCreate(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,80}$")
    floor_number: int = Field(ge=0, le=100)
    node_type: NodeType
    label: str = Field(min_length=1, max_length=120)
    x: float = Field(ge=0, le=10000)
    y: float = Field(ge=0, le=10000)
    capacity: int = Field(default=0, ge=0, le=10000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class GraphNodeResponse(GraphNodeCreate):
    building_id: str


class GraphEdgeCreate(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,80}$")
    source_node_id: str
    target_node_id: str
    distance: float = Field(gt=0, le=100000)
    capacity: int = Field(default=150, ge=1, le=100000)
    is_active: bool = True
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def edge_has_two_distinct_nodes(self) -> "GraphEdgeCreate":
        if self.source_node_id == self.target_node_id:
            raise ValueError("An edge must connect two different nodes")
        return self


class GraphEdgeResponse(GraphEdgeCreate):
    building_id: str


class BuildingGraphCreate(BaseModel):
    building: BuildingCreate
    floors: list[FloorCreate] = Field(min_length=1)
    nodes: list[GraphNodeCreate] = Field(min_length=1)
    edges: list[GraphEdgeCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def graph_references_are_valid(self) -> "BuildingGraphCreate":
        floor_numbers = [floor.floor_number for floor in self.floors]
        if len(floor_numbers) != len(set(floor_numbers)):
            raise ValueError("Each floor number must be unique")
        node_ids = [node.id for node in self.nodes]
        node_id_set = set(node_ids)
        if len(node_ids) != len(node_id_set):
            raise ValueError("Each node id must be unique within a building")
        if any(node.floor_number not in floor_numbers for node in self.nodes):
            raise ValueError("Every node must belong to a declared floor")
        edge_ids = [edge.id for edge in self.edges]
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("Each edge id must be unique within a building")
        if any(
            edge.source_node_id not in node_id_set or edge.target_node_id not in node_id_set
            for edge in self.edges
        ):
            raise ValueError("Every edge must reference nodes in the same building graph")
        return self


class BuildingGraphResponse(BuildingResponse):
    floors: list[FloorCreate]
    nodes: list[GraphNodeResponse]
    edges: list[GraphEdgeResponse]


class OccupancyUpdate(BaseModel):
    node_id: str
    people_count: int = Field(ge=0, le=100000)
    source: str = Field(default="manual", pattern=r"^(manual|simulation|sensor|vision)$")


class OccupancyBatchUpdate(BaseModel):
    updates: list[OccupancyUpdate] = Field(min_length=1, max_length=1000)


class FloorAlertCreate(BaseModel):
    floor_numbers: list[int] = Field(min_length=1, max_length=100)
    message: str = Field(min_length=3, max_length=500)
    severity: str = Field(default="emergency", pattern=r"^(information|warning|emergency)$")


class FloorAlertResponse(FloorAlertCreate):
    id: str
    building_id: str


class HazardType(StrEnum):
    FIRE = "fire"
    SMOKE = "smoke"
    FLOOD = "flood"
    GAS = "gas"
    STRUCTURAL = "structural"
    MEDICAL = "medical"
    OTHER = "other"


class HazardCreate(BaseModel):
    node_id: str
    hazard_type: HazardType
    severity: int = Field(ge=1, le=5)
    is_blocking: bool = False


class HazardResponse(HazardCreate):
    id: str
    building_id: str
    is_active: bool


class BuildingOperationalState(BaseModel):
    building_id: str
    occupancy: dict[str, int]
    active_hazards: list[HazardResponse]


class EvacuationPlanRequest(BaseModel):
    algorithm: str = Field(default="astar", pattern=r"^(astar|dijkstra)$")
    origin_node_ids: list[str] = Field(default_factory=list, max_length=1000)
    default_room_occupancy: int = Field(default=0, ge=0, le=100000)
    congestion_weight: float = Field(default=12, ge=0, le=100000)
    hazard_weight: float = Field(default=35, ge=0, le=100000)


class PlannedRoute(BaseModel):
    origin_node_id: str
    exit_node_id: str | None
    path: list[str]
    distance_cost: float
    people_count: int
    status: str
    message: str


class EvacuationPlanResponse(BaseModel):
    building_id: str
    algorithm: str
    blocked_nodes: list[str]
    routes: list[PlannedRoute]
    exit_assignments: dict[str, int]
    total_people_routed: int
