# SMART EVAC

SMART EVAC is a decision-support and training prototype for a multi-floor college evacuation system. It keeps the original student drill simulator and adds a separate, scroll-below operations console for editing a real building graph, planning evacuation routes, and simulating group movement.

> This project is not a replacement for certified fire-safety systems, emergency planning, trained personnel, or local safety regulations. Validate every plan with qualified professionals before use in a real emergency.

## What works now

- Existing browser-based student drill: keyboard/mobile movement, safety score, scenarios, personal history, and dashboard.
- Editable five-floor sample building: 40 classrooms, four staircases on every level, and four building exits on the ground floor.
- Floor-plan image upload for PNG, JPEG, and WebP maps; uploaded plans are attached to their selected floor.
- Weighted indoor graph stored in SQLite: buildings, floors, nodes, edges, occupancy, hazards, events, and drill data.
- Dijkstra and A* planning, using distance, congestion/capacity, non-blocking hazard severity, and exit demand.
- Blocking hazards dynamically remove unsafe nodes; recalculating gives the new safest route.
- Multi-exit assignment to reduce bottlenecks and a group-level route animation in the operations console.
- REST API and WebSocket notifications for live dashboard refreshes.
- Salted PBKDF2 password hashes, signed bearer sessions, and an administrator role. Production mode protects building mutations.
- Optional OpenCV + YOLO adapter for calibrated camera zones. It is deliberately disabled until camera calibration and model weights are supplied.

## Project layout

```text
index.html / app.js / styles.css   Existing student drill simulator
backend/                           FastAPI, SQLite, graph engine, API tests
web/                               React + TypeScript + Tailwind operations console
docs/                              Architecture and deployment notes
```

## Run locally

### 1. Start the API

From the project root in PowerShell:

```powershell
python -m venv backend\.venv
backend\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
python -m uvicorn app.main:app --reload --app-dir backend
```

The API starts at `http://127.0.0.1:8000`; interactive endpoint documentation is at `http://127.0.0.1:8000/docs`.

### 2. Start the operations console

In a second PowerShell window:

```powershell
cd web
npm.cmd install
npm.cmd run dev
```

Open the URL Vite shows (normally `http://127.0.0.1:5173`). The console seeds the five-floor sample building automatically. Select a classroom, save its occupancy, calculate an A* or Dijkstra route, then start the group simulation.

### 3. Use the original drill

Open [index.html](D:\project\Disaster-management\index.html) with a local server such as VS Code Live Server. It still works without the API in demo mode.

## Verification

```powershell
backend\.venv\Scripts\python.exe -m pytest -q backend\tests
cd web; npm.cmd run build
```

The backend tests cover sample topology, A*, Dijkstra rerouting around a blocked staircase, exit balancing, sessions, and the legacy password-hash upgrade.

## Production configuration

Use `backend/.env.example` as the configuration reference. In a real environment set a long random `SMART_EVAC_AUTH_SECRET`, set `SMART_EVAC_REQUIRE_AUTH=true`, add permitted administrator email addresses to `SMART_EVAC_BOOTSTRAP_ADMIN_EMAILS`, and use a controlled `VITE_API_ACCESS_TOKEN` or a proper login integration for operator actions. The development defaults intentionally keep your current local workflow simple.

SQLite is the working MVP database. The repository/service separation makes PostgreSQL the next deployment migration without changing route-planning or UI contracts. See [docs/architecture.md](D:\project\Disaster-management\docs\architecture.md) for the scale-out plan and the resources needed to model the actual college building.
