# SMART EVAC

A browser-based MVP for college disaster-evacuation training. It includes student registration and login, an interactive 2D map, BFS-based safe-route guidance, keyboard/mobile movement, scoring, student-specific drill history, a personal performance dashboard, and five selectable scenarios: fire, earthquake, flood, gas leak, and general emergency.

It also includes a separate five-floor building command center below the simulator. Students can manually select a classroom, restrict a floor zone to simulate a hazard, broadcast a per-floor digital training alert, and view an A* route through one of four staircase directions to a ground-floor building exit.

## Run the simulator

Open index.html in a modern browser. No installation or server is required.

## Controls

Use the arrow keys or the on-screen buttons to move. Select a drill from the header, choose the safer decision, follow the highlighted path, and reach the recommended safe exit.

Scroll below the simulator to use the five-floor command center. It models 8 rooms per level, four staircases on every level, and four ground-floor building exits. The per-floor alert is a UI simulation only; it does not control physical sirens.

## Run the backend

The simulator works offline, but you can save results to the FastAPI backend:

    python -m venv backend\.venv
    backend\.venv\Scripts\Activate.ps1
    python -m pip install -r backend\requirements.txt
    python -m uvicorn app.main:app --reload --app-dir backend

Then open the frontend with VS Code Live Server (port 5500) or directly in a browser. Create an account, sign in, or choose demo mode. The API is available at http://127.0.0.1:8000/docs. More detail is in backend/README.md.
