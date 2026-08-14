import type { BuildingEdge, BuildingGraph, BuildingNode, BuildingSummary, EvacuationPlan, Floor, Hazard, OperationalState } from "./types";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api";
const configuredAccessToken = import.meta.env.VITE_API_ACCESS_TOKEN;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (configuredAccessToken) headers.set("Authorization", `Bearer ${configuredAccessToken}`);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  listBuildings: () => request<BuildingSummary[]>("/buildings"),
  seedSample: () => request<BuildingGraph>("/buildings/sample", { method: "POST" }),
  getBuilding: (id: string) => request<BuildingGraph>(`/buildings/${id}`),
  getOperationalState: (id: string) => request<OperationalState>(`/buildings/${id}/state`),
  createNode: (buildingId: string, node: Omit<BuildingNode, "building_id">) =>
    request<BuildingNode>(`/buildings/${buildingId}/nodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(node),
    }),
  createEdge: (buildingId: string, edge: Omit<BuildingEdge, "building_id">) =>
    request<BuildingEdge>(`/buildings/${buildingId}/edges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edge),
    }),
  updateOccupancy: (buildingId: string, nodeId: string, peopleCount: number) =>
    request<void>(`/buildings/${buildingId}/occupancy`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: [{ node_id: nodeId, people_count: peopleCount, source: "manual" }] }),
    }),
  createBlockingHazard: (buildingId: string, nodeId: string) =>
    request<Hazard>(`/buildings/${buildingId}/hazards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ node_id: nodeId, hazard_type: "other", severity: 5, is_blocking: true }),
    }),
  broadcastFloorAlert: (buildingId: string, floorNumber: number) =>
    request<void>(`/buildings/${buildingId}/alerts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ floor_numbers: [floorNumber], message: `Emergency evacuation alert for floor ${floorNumber}. Follow the current safe route.`, severity: "emergency" }),
    }),
  calculatePlan: (buildingId: string, algorithm: "astar" | "dijkstra", originNodeIds: string[]) =>
    request<EvacuationPlan>(`/buildings/${buildingId}/evacuation-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ algorithm, origin_node_ids: originNodeIds }),
    }),
  uploadFloorPlan: async (buildingId: string, floorNumber: number, file: File): Promise<Floor> => {
    const data = new FormData();
    data.append("file", file);
    return request<Floor>(`/buildings/${buildingId}/floors/${floorNumber}/floor-plan`, {
      method: "POST",
      body: data,
    });
  },
  buildingEventsUrl: (buildingId: string) =>
    `${baseUrl.replace(/^http/, "ws")}/buildings/${buildingId}/events`,
};
