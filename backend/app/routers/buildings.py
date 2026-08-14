"""Editable building graph and real-time evacuation API."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status

from ..core.security import require_admin
from ..domain.models import (
    BuildingCreate,
    BuildingGraphCreate,
    BuildingGraphResponse,
    BuildingOperationalState,
    BuildingResponse,
    EvacuationPlanRequest,
    EvacuationPlanResponse,
    FloorAlertCreate,
    FloorAlertResponse,
    GraphEdgeCreate,
    GraphEdgeResponse,
    GraphNodeCreate,
    GraphNodeResponse,
    HazardCreate,
    HazardResponse,
    OccupancyBatchUpdate,
)
from ..repositories.building_repository import BuildingNotFoundError, BuildingRepository
from ..services.event_bus import event_bus
from ..services.route_planner import EvacuationRoutePlanner
from ..services.sample_data import sample_building_graph

router = APIRouter(prefix="/api/buildings", tags=["buildings"])
repository = BuildingRepository()
planner = EvacuationRoutePlanner(repository)


def _not_found(error: BuildingNotFoundError) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Building not found: {error}")


@router.get("", response_model=list[BuildingResponse])
def list_buildings() -> list[BuildingResponse]:
    return repository.list_buildings()


@router.post("", response_model=BuildingResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_building(payload: BuildingCreate) -> BuildingResponse:
    return repository.create_building(payload)


@router.post("/graph", response_model=BuildingGraphResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_building_graph(payload: BuildingGraphCreate) -> BuildingGraphResponse:
    return repository.create_graph(payload)


@router.post("/sample", response_model=BuildingGraphResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def create_sample_building() -> BuildingGraphResponse:
    existing = next(
        (
            building
            for building in repository.list_buildings()
            if building.name == "Sample Five-Storey College Building"
        ),
        None,
    )
    return repository.get_graph(existing.id) if existing else repository.create_graph(sample_building_graph())


@router.get("/{building_id}", response_model=BuildingGraphResponse)
def get_building_graph(building_id: str) -> BuildingGraphResponse:
    try:
        return repository.get_graph(building_id)
    except BuildingNotFoundError as error:
        raise _not_found(error) from error


@router.get("/{building_id}/state", response_model=BuildingOperationalState)
def get_building_operational_state(building_id: str) -> BuildingOperationalState:
    """Return the current people counts and active hazards for a live dashboard."""
    try:
        return BuildingOperationalState(
            building_id=building_id,
            occupancy=repository.get_occupancy(building_id),
            active_hazards=repository.active_hazards(building_id),
        )
    except BuildingNotFoundError as error:
        raise _not_found(error) from error


@router.post(
    "/{building_id}/nodes",
    response_model=GraphNodeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_graph_node(building_id: str, payload: GraphNodeCreate) -> GraphNodeResponse:
    try:
        node = repository.create_node(building_id, payload)
        repository.record_event(building_id, "graph.node_created", node.model_dump(mode="json"))
    except BuildingNotFoundError as error:
        raise _not_found(error) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    await event_bus.publish(building_id, "graph.node_created", node.model_dump(mode="json"))
    return node


@router.post(
    "/{building_id}/edges",
    response_model=GraphEdgeResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def create_graph_edge(building_id: str, payload: GraphEdgeCreate) -> GraphEdgeResponse:
    try:
        edge = repository.create_edge(building_id, payload)
        repository.record_event(building_id, "graph.edge_created", edge.model_dump(mode="json"))
    except BuildingNotFoundError as error:
        raise _not_found(error) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    await event_bus.publish(building_id, "graph.edge_created", edge.model_dump(mode="json"))
    return edge


@router.put("/{building_id}/occupancy", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def update_occupancy(building_id: str, payload: OccupancyBatchUpdate) -> None:
    try:
        repository.upsert_occupancy(building_id, payload.updates)
        repository.record_event(
            building_id,
            "occupancy.updated",
            {"updates": [update.model_dump() for update in payload.updates]},
        )
    except BuildingNotFoundError as error:
        raise _not_found(error) from error
    await event_bus.publish(
        building_id,
        "occupancy.updated",
        {"updates": [update.model_dump() for update in payload.updates]},
    )


@router.post(
    "/{building_id}/alerts",
    response_model=FloorAlertResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_admin)],
)
async def broadcast_floor_alert(building_id: str, payload: FloorAlertCreate) -> FloorAlertResponse:
    """Publish a floor-targeted digital alert to connected operations clients.

    A PA/siren/SMS integration should subscribe to this event through a dedicated,
    approved adapter; this API intentionally does not drive life-safety hardware.
    """
    try:
        graph = repository.get_graph(building_id)
        known_floors = {floor.floor_number for floor in graph.floors}
        if any(floor_number not in known_floors for floor_number in payload.floor_numbers):
            raise ValueError("One or more alert floors are not part of this building.")
        alert = FloorAlertResponse(
            id=repository.record_event(building_id, "floor.alert", payload.model_dump()),
            building_id=building_id,
            **payload.model_dump(),
        )
    except BuildingNotFoundError as error:
        raise _not_found(error) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    await event_bus.publish(building_id, "floor.alert", alert.model_dump(mode="json"))
    return alert


@router.post("/{building_id}/hazards", response_model=HazardResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
async def create_hazard(building_id: str, payload: HazardCreate) -> HazardResponse:
    try:
        hazard = repository.create_hazard(building_id, payload)
        repository.record_event(building_id, "hazard.created", hazard.model_dump(mode="json"))
    except BuildingNotFoundError as error:
        raise _not_found(error) from error
    await event_bus.publish(building_id, "hazard.created", hazard.model_dump(mode="json"))
    return hazard


@router.delete("/{building_id}/hazards/{hazard_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
async def deactivate_hazard(building_id: str, hazard_id: str) -> None:
    try:
        repository.deactivate_hazard(building_id, hazard_id)
        repository.record_event(building_id, "hazard.deactivated", {"hazard_id": hazard_id})
    except BuildingNotFoundError as error:
        raise _not_found(error) from error
    await event_bus.publish(building_id, "hazard.deactivated", {"hazard_id": hazard_id})


@router.post("/{building_id}/evacuation-plan", response_model=EvacuationPlanResponse)
async def calculate_evacuation_plan(
    building_id: str, payload: EvacuationPlanRequest
) -> EvacuationPlanResponse:
    try:
        plan = planner.plan(building_id, payload)
        repository.record_event(building_id, "evacuation.plan_calculated", plan.model_dump(mode="json"))
    except BuildingNotFoundError as error:
        raise _not_found(error) from error
    await event_bus.publish(building_id, "evacuation.plan_calculated", plan.model_dump(mode="json"))
    return plan


@router.websocket("/{building_id}/events")
async def building_events(building_id: str, websocket: WebSocket) -> None:
    await event_bus.connect(building_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        event_bus.disconnect(building_id, websocket)
