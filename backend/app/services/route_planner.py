"""Congestion-aware Dijkstra and A* evacuation route planning."""

from __future__ import annotations

from dataclasses import dataclass
from math import hypot

import networkx as nx

from ..domain.models import EvacuationPlanRequest, EvacuationPlanResponse, PlannedRoute
from ..repositories.building_repository import BuildingRepository


@dataclass(frozen=True)
class _RouteCandidate:
    """A candidate route to one exit before occupant assignment."""

    exit_id: str
    path: list[str]
    cost: float


class EvacuationRoutePlanner:
    """Plan routes across a weighted indoor graph and balance exit demand."""

    def __init__(self, repository: BuildingRepository) -> None:
        self.repository = repository

    def plan(self, building_id: str, request: EvacuationPlanRequest) -> EvacuationPlanResponse:
        graph_data = self.repository.get_graph(building_id)
        occupancy = self.repository.get_occupancy(building_id)
        hazards = self.repository.active_hazards(building_id)
        blocked_nodes = {hazard.node_id for hazard in hazards if hazard.is_blocking}
        hazard_severity = {
            node_id: max(hazard.severity for hazard in hazards if hazard.node_id == node_id)
            for node_id in {hazard.node_id for hazard in hazards if not hazard.is_blocking}
        }
        graph = self._build_graph(graph_data, blocked_nodes, hazard_severity)
        exits = [node for node in graph_data.nodes if node.node_type.value == "exit" and node.id not in blocked_nodes]
        traffic = {node.id: 0 for node in graph_data.nodes}
        exit_assignments = {exit_node.id: 0 for exit_node in exits}
        routes: list[PlannedRoute] = []

        # Larger groups are allocated first so exit balancing accounts for room load.
        origin_node_ids = request.origin_node_ids or [
            node.id
            for node in graph_data.nodes
            if node.node_type.value == "room" and occupancy.get(node.id, 0) > 0
        ]
        origins = sorted(
            origin_node_ids,
            key=lambda node_id: occupancy.get(node_id, request.default_room_occupancy),
            reverse=True,
        )
        for origin_id in origins:
            people_count = occupancy.get(origin_id, request.default_room_occupancy)
            if origin_id in blocked_nodes or origin_id not in graph:
                routes.append(
                    PlannedRoute(
                        origin_node_id=origin_id,
                        exit_node_id=None,
                        path=[],
                        distance_cost=0,
                        people_count=people_count,
                        status="blocked",
                        message="Origin is blocked or does not exist in the active graph.",
                    )
                )
                continue

            candidate = self._best_candidate(
                graph,
                origin_id,
                exits,
                traffic,
                exit_assignments,
                request,
            )
            if candidate is None:
                routes.append(
                    PlannedRoute(
                        origin_node_id=origin_id,
                        exit_node_id=None,
                        path=[],
                        distance_cost=0,
                        people_count=people_count,
                        status="blocked",
                        message="No safe exit is reachable from this origin.",
                    )
                )
                continue

            for node_id in candidate.path:
                traffic[node_id] = traffic.get(node_id, 0) + people_count
            exit_assignments[candidate.exit_id] += people_count
            routes.append(
                PlannedRoute(
                    origin_node_id=origin_id,
                    exit_node_id=candidate.exit_id,
                    path=candidate.path,
                    distance_cost=round(candidate.cost, 2),
                    people_count=people_count,
                    status="routed",
                    message="Safest available route assigned with congestion balancing.",
                )
            )

        return EvacuationPlanResponse(
            building_id=building_id,
            algorithm=request.algorithm,
            blocked_nodes=sorted(blocked_nodes),
            routes=routes,
            exit_assignments=exit_assignments,
            total_people_routed=sum(route.people_count for route in routes if route.status == "routed"),
        )

    @staticmethod
    def _build_graph(
        graph_data, blocked_nodes: set[str], hazard_severity: dict[str, int]
    ) -> nx.Graph:
        graph = nx.Graph()
        for node in graph_data.nodes:
            if node.id not in blocked_nodes:
                graph.add_node(
                    node.id,
                    x=node.x,
                    y=node.y,
                    floor=node.floor_number,
                    capacity=max(node.capacity, 1),
                    node_type=node.node_type.value,
                    hazard_severity=hazard_severity.get(node.id, 0),
                )
        for edge in graph_data.edges:
            if (
                edge.is_active
                and edge.source_node_id in graph
                and edge.target_node_id in graph
            ):
                graph.add_edge(
                    edge.source_node_id,
                    edge.target_node_id,
                    distance=edge.distance,
                    capacity=max(edge.capacity, 1),
                )
        return graph

    def _best_candidate(
        self,
        graph: nx.Graph,
        origin_id: str,
        exits,
        traffic: dict[str, int],
        exit_assignments: dict[str, int],
        request: EvacuationPlanRequest,
    ) -> _RouteCandidate | None:
        candidates: list[_RouteCandidate] = []
        for exit_node in exits:
            if exit_node.id not in graph:
                continue
            weighted = self._weighted_graph(graph, traffic, exit_assignments, request)
            try:
                if request.algorithm == "dijkstra":
                    path = nx.dijkstra_path(weighted, origin_id, exit_node.id, weight="cost")
                    cost = nx.dijkstra_path_length(weighted, origin_id, exit_node.id, weight="cost")
                else:
                    path = nx.astar_path(
                        weighted,
                        origin_id,
                        exit_node.id,
                        heuristic=lambda source, target: self._heuristic(weighted, source, target),
                        weight="cost",
                    )
                    cost = nx.path_weight(weighted, path, weight="cost")
            except nx.NetworkXNoPath:
                continue
            candidates.append(_RouteCandidate(exit_id=exit_node.id, path=path, cost=cost))
        return min(candidates, key=lambda candidate: candidate.cost, default=None)

    @staticmethod
    def _weighted_graph(
        graph: nx.Graph,
        traffic: dict[str, int],
        exit_assignments: dict[str, int],
        request: EvacuationPlanRequest,
    ) -> nx.Graph:
        weighted = graph.copy()
        for source, target, data in weighted.edges(data=True):
            local_load = traffic.get(source, 0) + traffic.get(target, 0)
            local_capacity = min(
                weighted.nodes[source]["capacity"],
                weighted.nodes[target]["capacity"],
                data["capacity"],
            )
            congestion = (local_load / max(local_capacity, 1)) * request.congestion_weight
            hazard_penalty = (
                weighted.nodes[source]["hazard_severity"]
                + weighted.nodes[target]["hazard_severity"]
            ) * request.hazard_weight
            exit_penalty = 0
            if weighted.nodes[target]["node_type"] == "exit":
                exit_penalty = (
                    exit_assignments.get(target, 0) / weighted.nodes[target]["capacity"]
                ) * request.congestion_weight
            if weighted.nodes[source]["node_type"] == "exit":
                exit_penalty = (
                    exit_assignments.get(source, 0) / weighted.nodes[source]["capacity"]
                ) * request.congestion_weight
            data["cost"] = data["distance"] + congestion + hazard_penalty + exit_penalty
        return weighted

    @staticmethod
    def _heuristic(graph: nx.Graph, source: str, target: str) -> float:
        """Admissible lower-bound estimate across spatial and vertical movement."""
        start = graph.nodes[source]
        end = graph.nodes[target]
        horizontal = hypot(start["x"] - end["x"], start["y"] - end["y"]) * 0.05
        vertical = abs(start["floor"] - end["floor"]) * 1.0
        return horizontal + vertical
