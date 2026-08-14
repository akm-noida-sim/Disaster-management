export type NodeType = "room" | "corridor" | "stair" | "exit" | "restricted" | "assembly";

export interface Floor {
  floor_number: number;
  label: string;
  image_reference?: string | null;
}

export interface BuildingNode {
  id: string;
  building_id: string;
  floor_number: number;
  node_type: NodeType;
  label: string;
  x: number;
  y: number;
  capacity: number;
  metadata: Record<string, unknown>;
}

export interface BuildingEdge {
  id: string;
  building_id: string;
  source_node_id: string;
  target_node_id: string;
  distance: number;
  capacity: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export interface BuildingSummary {
  id: string;
  name: string;
  description: string;
}

export interface BuildingGraph extends BuildingSummary {
  floors: Floor[];
  nodes: BuildingNode[];
  edges: BuildingEdge[];
}

export interface PlannedRoute {
  origin_node_id: string;
  exit_node_id: string | null;
  path: string[];
  distance_cost: number;
  people_count: number;
  status: "routed" | "blocked";
  message: string;
}

export interface EvacuationPlan {
  building_id: string;
  algorithm: "astar" | "dijkstra";
  blocked_nodes: string[];
  routes: PlannedRoute[];
  exit_assignments: Record<string, number>;
  total_people_routed: number;
}

export interface Hazard {
  id: string;
  building_id: string;
  node_id: string;
  hazard_type: string;
  severity: number;
  is_blocking: boolean;
  is_active: boolean;
}

export interface OperationalState {
  building_id: string;
  occupancy: Record<string, number>;
  active_hazards: Hazard[];
}
