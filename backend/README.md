# SMART EVAC API

## 1. Create and activate a virtual environment

From the project root in PowerShell:

    python -m venv backend\.venv
    backend\.venv\Scripts\Activate.ps1

## 2. Install dependencies

    python -m pip install -r backend\requirements.txt

## 3. Run the API

    python -m uvicorn app.main:app --reload --app-dir backend

The API runs at http://127.0.0.1:8000. Open http://127.0.0.1:8000/docs for the interactive Swagger documentation. The frontend is allowed to call this API from VS Code Preview on port 3000 and Live Server on port 5500.

## MVP endpoints

- GET /api/health — API health check
- POST /api/auth/register — create a student account
- POST /api/auth/login — validate a student account
- POST /api/results — save a completed drill
- GET /api/results — view saved results
- DELETE /api/results — clear one student's saved results

SQLite is used for the first implementation and creates backend/smart_evac.db automatically. PostgreSQL can replace this in the deployment phase.
