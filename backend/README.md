# SMART EVAC API

FastAPI backend for editable indoor building graphs, occupancy, hazards, route planning, event delivery, student drills, and authentication.

## Run

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --app-dir backend
```

Run from the repository root for the last command. Swagger is available at `http://127.0.0.1:8000/docs`.

## Important endpoints

- `POST /api/auth/register` and `POST /api/auth/login` — signed bearer session response.
- `GET /api/buildings`, `POST /api/buildings/graph`, and `POST /api/buildings/sample` — building graph management.
- `POST /api/buildings/{id}/floors/{floor}/floor-plan` — attach a PNG/JPEG/WebP floor plan.
- `PUT /api/buildings/{id}/occupancy` — manual, simulation, sensor, or vision occupancy updates.
- `POST /api/buildings/{id}/hazards` — activates a hazard; a blocking hazard removes that graph node from route calculations.
- `POST /api/buildings/{id}/evacuation-plan` — weighted A* or Dijkstra multi-exit plan.
- `WS /api/buildings/{id}/events` — occupancy, hazard, and plan update notifications.

The `POST`, `PUT`, and `DELETE` endpoints that change building safety data require an administrator bearer token when `SMART_EVAC_REQUIRE_AUTH=true`. Development mode is permissive to make the existing local student simulator work without changes.

## Sample data and tests

```powershell
backend\.venv\Scripts\python.exe backend\scripts\seed_sample.py
backend\.venv\Scripts\python.exe -m pytest -q backend\tests
```

Install `requirements-vision.txt` only in a trained and calibrated camera worker environment. Never treat an uncalibrated camera inference as an authoritative occupancy count.
