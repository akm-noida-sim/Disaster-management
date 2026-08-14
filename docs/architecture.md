# SMART EVAC architecture

## Working MVP flow

```text
React operations console / existing student simulator
                    |
      REST + WebSocket notifications
                    |
FastAPI routers -> repository -> SQLite (PostgreSQL-ready boundary)
       |                 |
 route-planning      buildings, nodes, edges, occupancy,
 A* / Dijkstra       hazards, events, drill results
       |
 optional adapters: manual input, simulator, sensors, OpenCV + YOLO camera zones
```

## Graph model

A building contains floors. Each floor has positionable graph nodes for classrooms, corridors, staircases, exits, assembly areas, or restricted zones. Edges represent walkable connections with a distance and capacity. The planner:

1. Removes every node with an active blocking hazard.
2. Adds a risk cost for a non-blocking hazard, congestion cost for traffic/capacity, and exit-demand cost for bottlenecks.
3. Calculates an A* or Dijkstra route to every viable ground-floor exit.
4. Allocates larger groups first to the least-cost exit, then updates traffic before the next group is assigned.

This is an explainable operational heuristic, not a certified evacuation model. A production rollout should add independent domain validation, evacuation-engineering review, and load testing with verified capacity data.

## Actual-building inputs needed

When available, provide the following for the college building:

- One scaled PNG/JPEG/PDF floor plan per floor (ground + four higher levels), with north direction.
- Classroom numbers, usable occupancy, corridors, four stair locations, ground-floor exits, assembly areas, lifts, washrooms, laboratories/electrical rooms, and accessibility/refuge areas.
- Approximate coordinates in image pixels or metres for every marker. A floor-plan upload can be used first; markers can then be placed manually in the editor.
- Stair widths, corridor widths, door widths, normally locked doors, and any one-way restrictions.
- Camera coverage and privacy approval. For each camera, we need a calibration mapping from image pixels to a room/corridor node before enabling YOLO counts.
- Alert hardware protocol details (siren, PA, SMS/app service, IoT gateway). The present alerting is dashboard/event infrastructure only; it does not drive physical alarm equipment.

## Deployment path

1. Use the supplied SQLite implementation for review and controlled simulation.
2. Move the repository implementation to PostgreSQL plus migrations, add Redis/message broker for multi-instance WebSockets, object storage for plans, and monitored backups.
3. Put the API behind TLS, set a unique auth secret, require signed administrator sessions, and integrate an institutional identity provider.
4. Run OpenCV/YOLO in a separately controlled worker only after legal approval, calibration, and accuracy evaluation.
5. Complete security testing, accessibility review, real building walk-throughs, load tests, and emergency-safety authority approval before any operational use.
