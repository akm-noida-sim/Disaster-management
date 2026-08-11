# SMART EVAC

A browser-based MVP for college fire-evacuation training. It includes student registration and login, an interactive 2D map, fire and blocked-route hazards, BFS-based safe-route guidance, keyboard/mobile movement, scoring, student-specific drill history, and a personal performance dashboard with score progression and safety insights.

## Run the simulator

Open index.html in a modern browser. No installation or server is required.

## Controls

Use the arrow keys or the on-screen buttons to move. Choose the safer stair decision, follow the highlighted path, and reach Exit B.

## Run the backend

The simulator works offline, but you can save results to the FastAPI backend:

    python -m venv backend\.venv
    backend\.venv\Scripts\Activate.ps1
    python -m pip install -r backend\requirements.txt
    python -m uvicorn app.main:app --reload --app-dir backend

Then open the frontend with VS Code Live Server (port 5500) or directly in a browser. Create an account, sign in, or choose demo mode. The API is available at http://127.0.0.1:8000/docs. More detail is in backend/README.md.
