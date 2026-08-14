import { ChangeEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { BuildingEdge, BuildingGraph, BuildingNode, EvacuationPlan, NodeType } from "./types";

type Algorithm = "astar" | "dijkstra";

function nodeClass(node: BuildingNode, selectedId: string | null, routeNodeIds: Set<string>, blockedNodes: Set<string>) {
  return [
    "map-node",
    `map-node--${node.node_type}`,
    node.id === selectedId ? "is-selected" : "",
    routeNodeIds.has(node.id) ? "is-routed" : "",
    blockedNodes.has(node.id) ? "is-blocked" : "",
  ].filter(Boolean).join(" ");
}

function edgeVisible(edge: BuildingEdge, nodes: Map<string, BuildingNode>, floor: number) {
  const start = nodes.get(edge.source_node_id);
  const end = nodes.get(edge.target_node_id);
  return Boolean(start && end && start.floor_number === floor && end.floor_number === floor);
}

export default function App() {
  const [building, setBuilding] = useState<BuildingGraph | null>(null);
  const [floorNumber, setFloorNumber] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peopleCount, setPeopleCount] = useState(60);
  const [algorithm, setAlgorithm] = useState<Algorithm>("astar");
  const [plan, setPlan] = useState<EvacuationPlan | null>(null);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);
  const [markerType, setMarkerType] = useState<NodeType>("room");
  const [markerLabel, setMarkerLabel] = useState("");
  const [placementArmed, setPlacementArmed] = useState(false);
  const [edgeStartId, setEdgeStartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState("Connecting to the command service…");

  const nodeById = useMemo(
    () => new Map(building?.nodes.map((node) => [node.id, node]) ?? []),
    [building],
  );
  const selected = selectedId ? nodeById.get(selectedId) ?? null : null;
  const floor = building?.floors.find((item) => item.floor_number === floorNumber) ?? null;
  const floorNodes = building?.nodes.filter((node) => node.floor_number === floorNumber) ?? [];
  const floorEdges = building?.edges.filter((edge) => edgeVisible(edge, nodeById, floorNumber)) ?? [];
  const routeNodeIds = useMemo(
    () => new Set(plan?.routes.flatMap((route) => route.path) ?? []),
    [plan],
  );
  const blockedNodes = useMemo(() => new Set(plan?.blocked_nodes ?? []), [plan]);

  const refreshBuilding = async (id: string) => {
    const graph = await api.getBuilding(id);
    setBuilding(graph);
    return graph;
  };

  useEffect(() => {
    void (async () => {
      try {
        const graph = await api.seedSample();
        setBuilding(graph);
        setNotice("Live sample building ready. Select a room or a map element to begin.");
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to reach the API.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!building) return undefined;
    const socket = new WebSocket(api.buildingEventsUrl(building.id));
    socket.onmessage = () => { void refreshBuilding(building.id); };
    socket.onerror = () => { /* The console continues working with normal REST updates. */ };
    return () => socket.close();
  }, [building?.id]);

  const maximumSimulationStep = Math.max(0, ...(plan?.routes.map((route) => route.path.length - 1) ?? [0]));
  useEffect(() => {
    if (!simulationActive) return undefined;
    if (simulationStep >= maximumSimulationStep) {
      setSimulationActive(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSimulationStep((step) => step + 1), 700);
    return () => window.clearTimeout(timer);
  }, [simulationActive, simulationStep, maximumSimulationStep]);

  const runAction = async (work: () => Promise<void>) => {
    setActionBusy(true);
    try {
      await work();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The request could not be completed.");
    } finally {
      setActionBusy(false);
    }
  };

  const assignOccupancy = () => {
    if (!building || !selected || selected.node_type !== "room") {
      setNotice("Select a classroom before assigning occupancy.");
      return;
    }
    void runAction(async () => {
      await api.updateOccupancy(building.id, selected.id, peopleCount);
      setPlan(null);
      setNotice(`${peopleCount} people assigned to ${selected.label}.`);
      await refreshBuilding(building.id);
    });
  };

  const createBlockage = () => {
    if (!building || !selected) {
      setNotice("Select a room, corridor, staircase, or exit to report a blockage.");
      return;
    }
    void runAction(async () => {
      await api.createBlockingHazard(building.id, selected.id);
      setPlan(null);
      setNotice(`${selected.label} is now marked unsafe. Routes will avoid it.`);
    });
  };

  const broadcastAlert = () => {
    if (!building) return;
    void runAction(async () => {
      await api.broadcastFloorAlert(building.id, floorNumber);
      setNotice(`Digital emergency alert sent to ${floor?.label ?? `floor ${floorNumber}`}.`);
    });
  };

  const calculatePlan = () => {
    if (!building) return;
    void runAction(async () => {
      const origins = selected?.node_type === "room" ? [selected.id] : [];
      const nextPlan = await api.calculatePlan(building.id, algorithm, origins);
      setPlan(nextPlan);
      setSimulationActive(false);
      setSimulationStep(0);
      setNotice(nextPlan.routes.length
        ? `${nextPlan.total_people_routed} people have a planned safe route.`
        : "Assign occupants to one or more classrooms, then calculate the building plan.");
    });
  };

  const uploadFloorPlan = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!building || !file) return;
    void runAction(async () => {
      await api.uploadFloorPlan(building.id, floorNumber, file);
      await refreshBuilding(building.id);
      setNotice(`${file.name} is attached to ${floor?.label ?? "this floor"}.`);
      event.target.value = "";
    });
  };

  const placeMarker = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (!building || !placementArmed || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;
    const id = `editor-${markerType}-${Date.now().toString(36)}`;
    const capacity = markerType === "room" ? 70 : markerType === "exit" ? 220 : markerType === "stair" ? 100 : 120;
    const label = markerLabel.trim() || `${markerType[0].toUpperCase()}${markerType.slice(1)} ${floorNumber}`;
    void runAction(async () => {
      await api.createNode(building.id, {
        id,
        floor_number: floorNumber,
        node_type: markerType,
        label,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        capacity,
        metadata: { created_by: "floor_plan_editor" },
      });
      setSelectedId(id);
      setMarkerLabel("");
      setPlacementArmed(false);
      setNotice(`${label} was added. Connect it to a corridor, stair, or exit to make it routable.`);
      await refreshBuilding(building.id);
    });
  };

  const connectSelection = () => {
    if (!building || !edgeStartId || !selected || edgeStartId === selected.id) {
      setNotice("Set one node as the connection start, then select a different node.");
      return;
    }
    const start = nodeById.get(edgeStartId);
    if (!start) return;
    const distance = Math.max(1, Math.round(Math.hypot(start.x - selected.x, start.y - selected.y)));
    void runAction(async () => {
      await api.createEdge(building.id, {
        id: `edge-${edgeStartId}-${selected.id}-${Date.now().toString(36)}`,
        source_node_id: edgeStartId,
        target_node_id: selected.id,
        distance,
        capacity: Math.min(Math.max(start.capacity, 1), Math.max(selected.capacity, 1)),
        is_active: true,
        metadata: { created_by: "floor_plan_editor" },
      });
      setNotice(`${start.label} is now connected to ${selected.label}.`);
      setEdgeStartId(null);
      await refreshBuilding(building.id);
    });
  };

  const activeExitCount = building?.nodes.filter((node) => node.node_type === "exit" && !blockedNodes.has(node.id)).length ?? 0;
  const plannedRoute = plan?.routes.find((route) => route.origin_node_id === selected?.id) ?? plan?.routes[0];

  return (
    <main className="min-h-screen bg-[#061918] text-slate-100">
      <header className="border-b border-emerald-300/20 bg-[#082523] px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-300 font-black text-[#082523]">S</span><div><p className="font-mono text-xs tracking-[.18em] text-lime-300">SMART EVAC</p><h1 className="text-base font-bold">Building operations console</h1></div></div>
          <span className="rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1 font-mono text-xs text-lime-200">DECISION-SUPPORT MODE</span>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1500px] gap-5 p-5 md:grid-cols-[250px_minmax(0,1fr)_310px] md:p-8">
        <aside className="console-card order-2 space-y-5 md:order-1">
          <div><p className="console-label">BUILDING</p><h2 className="mt-1 text-lg font-bold leading-tight">{building?.name ?? "Loading building…"}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{building?.description}</p></div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Floors" value={building?.floors.length ?? 0} />
            <Metric label="Active exits" value={activeExitCount} />
            <Metric label="Map nodes" value={building?.nodes.length ?? 0} />
            <Metric label="Route groups" value={plan?.routes.length ?? 0} />
          </div>
          <div className="border-t border-white/10 pt-5"><p className="console-label">FLOOR LAYERS</p><div className="mt-3 grid gap-2">{building?.floors.slice().reverse().map((item) => <button key={item.floor_number} onClick={() => { setFloorNumber(item.floor_number); setSelectedId(null); }} className={`floor-button ${floorNumber === item.floor_number ? "is-active" : ""}`}>{item.label}<span>{item.image_reference ? "MAP" : "GRAPH"}</span></button>)}</div></div>
          <label className="upload-control">Attach floor-plan image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadFloorPlan} disabled={!building || actionBusy} /></label>
        </aside>

        <section className="order-1 min-w-0 md:order-2">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="console-label">{floor?.label ?? ""}</p><h2 className="mt-1 text-2xl font-bold tracking-tight">Interactive safety map</h2></div><span className="font-mono text-xs text-slate-400">{floorNodes.length} editable graph nodes</span></div>
          <div className="map-shell">
            {floor?.image_reference && <img className="floor-plan-image" src={`http://127.0.0.1:8000${floor.image_reference}`} alt={`${floor.label} floor-plan`} />}
            <svg className={`floor-map ${placementArmed ? "is-placing" : ""}`} viewBox="0 0 100 100" role="img" aria-label={`${floor?.label ?? "Selected"} evacuation map`} onClick={placeMarker}>
              {floorEdges.map((edge) => {
                const start = nodeById.get(edge.source_node_id)!;
                const end = nodeById.get(edge.target_node_id)!;
                const isRoute = routeNodeIds.has(start.id) && routeNodeIds.has(end.id);
                return <line key={edge.id} x1={start.x} y1={start.y} x2={end.x} y2={end.y} className={`map-edge ${isRoute ? "is-routed" : ""}`} />;
              })}
              {floorNodes.map((node) => <g key={node.id} className={nodeClass(node, selectedId, routeNodeIds, blockedNodes)} onClick={(event) => { event.stopPropagation(); setSelectedId(node.id); }} tabIndex={0} role="button" aria-label={`Select ${node.label}`} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(node.id); }}>
                {node.node_type === "room" ? <rect x={node.x - 5} y={node.y - 4} width="10" height="8" rx="1.5" /> : <circle cx={node.x} cy={node.y} r={node.node_type === "exit" ? 4.5 : 3.2} />}
                {(node.node_type === "room" || node.node_type === "exit") && <text x={node.x} y={node.y + 0.8}>{node.node_type === "exit" ? "EXIT" : node.label.replace("Room ", "")}</text>}
                <title>{node.label}</title>
              </g>)}
              {plan?.routes.map((route) => {
                const nodeId = route.path[Math.min(simulationStep, route.path.length - 1)];
                const node = nodeById.get(nodeId);
                if (!node || node.floor_number !== floorNumber || route.status !== "routed") return null;
                return <g key={`agent-${route.origin_node_id}`} className="simulation-agent"><circle cx={node.x} cy={node.y - 6} r="3.4" /><text x={node.x} y={node.y - 5.2}>{route.people_count}</text></g>;
              })}
            </svg>
            <div className="map-legend"><span><i className="legend-room" /> Classroom</span><span><i className="legend-stair" /> Staircase</span><span><i className="legend-exit" /> Ground exit</span><span><i className="legend-blocked" /> Blocked</span></div>
          </div>
          <p className="mt-3 text-sm text-slate-400">{notice}</p>
        </section>

        <aside className="console-card order-3 space-y-5">
          <div><p className="console-label">SELECTION</p><h2 className="mt-1 text-xl font-bold">{selected?.label ?? "Choose a map element"}</h2><p className="mt-2 text-sm text-slate-400">{selected ? `${selected.node_type.toUpperCase()} · Floor ${selected.floor_number}` : "Classrooms store people counts. Stairs, corridors and exits can be marked unsafe."}</p></div>
          <div className="border-t border-white/10 pt-5"><label className="console-label" htmlFor="people">CLASSROOM OCCUPANCY</label><div className="mt-2 flex gap-2"><input id="people" type="number" min="0" max="10000" value={peopleCount} onChange={(event) => setPeopleCount(Number(event.target.value))} /><button className="secondary-button" onClick={assignOccupancy} disabled={actionBusy}>Save</button></div></div>
          <div className="border-t border-white/10 pt-5"><p className="console-label">FLOOR-PLAN EDITOR</p><div className="mt-2 grid gap-2"><select value={markerType} onChange={(event) => setMarkerType(event.target.value as NodeType)} aria-label="New marker type"><option value="room">Classroom</option><option value="corridor">Corridor point</option><option value="stair">Staircase</option><option value="exit">Ground exit</option><option value="restricted">Restricted area</option><option value="assembly">Assembly area</option></select><input value={markerLabel} onChange={(event) => setMarkerLabel(event.target.value)} placeholder="Marker label (optional)" /><button className={placementArmed ? "primary-button" : "secondary-button"} onClick={() => setPlacementArmed((armed) => !armed)} disabled={actionBusy}>{placementArmed ? "Click empty map space to place" : "Place a map marker"}</button><button className="secondary-button" onClick={() => { if (selected) { setEdgeStartId(selected.id); setNotice(`${selected.label} is the connection start. Select a second marker, then connect.`); } else setNotice("Select the first marker to create a connection."); }} disabled={!selected}>Set connection start</button><button className="secondary-button" onClick={connectSelection} disabled={!edgeStartId || !selected || edgeStartId === selected.id || actionBusy}>Connect start to selection</button></div></div>
          <div className="grid gap-2"><button className="danger-button" onClick={createBlockage} disabled={actionBusy || !selected}>Mark selected unsafe</button><button className="secondary-button" onClick={broadcastAlert} disabled={actionBusy || !building}>Broadcast floor alert</button><div className="flex gap-2"><select value={algorithm} onChange={(event) => setAlgorithm(event.target.value as Algorithm)} aria-label="Path finding algorithm"><option value="astar">A* shortest safe route</option><option value="dijkstra">Dijkstra weighted route</option></select><button className="primary-button grow" onClick={calculatePlan} disabled={actionBusy || !building}>Calculate plan</button></div><button className="secondary-button" onClick={() => { setSimulationStep(0); setSimulationActive((active) => !active); }} disabled={!plan || maximumSimulationStep === 0}>{simulationActive ? "Pause group simulation" : "Start group simulation"}</button></div>
          <div className="border-t border-white/10 pt-5"><p className="console-label">RECOMMENDED ROUTE</p>{plannedRoute ? <div className="mt-3 rounded-xl border border-lime-300/20 bg-lime-300/5 p-3"><strong className="block text-lime-200">{plannedRoute.status === "routed" ? `To ${nodeById.get(plannedRoute.exit_node_id ?? "")?.label ?? plannedRoute.exit_node_id}` : "No route available"}</strong><p className="mt-2 text-sm leading-5 text-slate-300">{plannedRoute.message}</p><p className="mt-2 font-mono text-xs text-slate-400">{plannedRoute.people_count} people · cost {plannedRoute.distance_cost}</p></div> : <p className="mt-3 text-sm leading-5 text-slate-400">Assign occupancy, then calculate a route. Leave no classroom selected to plan every occupied room.</p>}</div>
          <p className="rounded-lg bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">{simulationActive ? `Group simulator: step ${simulationStep + 1} of ${maximumSimulationStep + 1}.` : "Simulation and decision support only. Validate plans with qualified safety professionals and certified emergency systems."}</p>
        </aside>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-white/10 bg-black/10 p-3"><span className="block font-mono text-[10px] tracking-wider text-slate-500">{label.toUpperCase()}</span><strong className="mt-1 block text-xl text-lime-200">{value}</strong></div>;
}
