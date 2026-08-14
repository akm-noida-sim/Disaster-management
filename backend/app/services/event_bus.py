"""Minimal WebSocket event manager, replaceable by Redis or a message broker later."""

from __future__ import annotations

from collections import defaultdict

from fastapi import WebSocket


class BuildingEventBus:
    """Fan out building updates to subscribed dashboards."""

    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, building_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[building_id].add(websocket)

    def disconnect(self, building_id: str, websocket: WebSocket) -> None:
        self._connections[building_id].discard(websocket)

    async def publish(self, building_id: str, event_type: str, payload: dict) -> None:
        stale: list[WebSocket] = []
        message = {"type": event_type, "building_id": building_id, "payload": payload}
        for websocket in self._connections[building_id]:
            try:
                await websocket.send_json(message)
            except RuntimeError:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(building_id, websocket)


event_bus = BuildingEventBus()
