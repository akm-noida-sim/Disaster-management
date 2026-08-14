"""Floor-plan image upload API for the interactive editor."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..core.config import settings
from ..core.security import require_admin
from ..domain.models import FloorCreate
from ..repositories.building_repository import BuildingNotFoundError, BuildingRepository

router = APIRouter(prefix="/api/buildings", tags=["floor-plan uploads"])
repository = BuildingRepository()
UPLOAD_DIRECTORY = Path(__file__).resolve().parents[2] / "storage" / "floor_plans"
ALLOWED_MEDIA_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


@router.post(
    "/{building_id}/floors/{floor_number}/floor-plan",
    response_model=FloorCreate,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin)],
)
async def upload_floor_plan(
    building_id: str,
    floor_number: int,
    file: UploadFile = File(...),
) -> FloorCreate:
    """Store an editable floor-plan image and attach its URL to a floor."""
    if file.content_type not in ALLOWED_MEDIA_TYPES:
        raise HTTPException(status_code=415, detail="Only PNG, JPEG, and WebP floor plans are supported.")
    content = await file.read()
    if not content or len(content) > settings.max_floor_plan_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Floor-plan images must be between 1 byte and {settings.max_floor_plan_bytes} bytes.",
        )

    UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)
    filename = f"{building_id}-{floor_number}-{uuid.uuid4().hex}{ALLOWED_MEDIA_TYPES[file.content_type]}"
    destination = UPLOAD_DIRECTORY / filename
    destination.write_bytes(content)
    image_reference = f"/uploads/floor_plans/{filename}"
    try:
        repository.replace_floor_image_reference(building_id, floor_number, image_reference)
        graph = repository.get_graph(building_id)
    except BuildingNotFoundError as error:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=404, detail=f"Building or floor not found: {error}") from error

    return next(floor for floor in graph.floors if floor.floor_number == floor_number)
