"""Optional computer-vision adapter boundary.

The core routing service intentionally has no dependency on a camera feed. Deployments
can provide a camera adapter that converts person detections into OccupancyUpdate data.
"""

from __future__ import annotations

from dataclasses import dataclass
from collections import Counter
from collections.abc import Callable
from typing import Protocol


@dataclass(frozen=True)
class PersonCount:
    """One normalized observation from a camera zone."""

    zone_node_id: str
    people_count: int
    confidence: float


class PeopleDetectionProvider(Protocol):
    """Contract for OpenCV/YOLO or another approved detection provider."""

    def detect(self, image_bytes: bytes) -> list[PersonCount]:
        """Return people counts mapped to preconfigured building zones."""


class VisionIntegrationUnavailable(RuntimeError):
    """Raised until a camera feed, calibration and approved YOLO model are configured."""


class DisabledVisionProvider:
    """Safe default that never pretends to perform real person detection."""

    def detect(self, image_bytes: bytes) -> list[PersonCount]:
        raise VisionIntegrationUnavailable(
            "Vision is not configured. Add an approved camera feed, zone calibration, "
            "and YOLO model weights before enabling people detection."
        )


class YoloVisionProvider:
    """Optional OpenCV + YOLO adapter for a pre-calibrated camera zone.

    ``zone_for_point`` must be supplied by the deployment after camera-to-floor-plan
    calibration. It maps a person's image-coordinate centre to a graph node id; this
    keeps model detection separate from building-specific geometry.
    """

    def __init__(
        self,
        model_path: str,
        zone_for_point: Callable[[float, float], str | None],
        confidence_threshold: float = 0.45,
    ) -> None:
        try:
            import cv2  # type: ignore[import-not-found]
            import numpy as np  # type: ignore[import-not-found]
            from ultralytics import YOLO  # type: ignore[import-not-found]
        except ImportError as error:
            raise VisionIntegrationUnavailable(
                "Install backend/requirements-vision.txt before enabling YOLO detection."
            ) from error
        self._cv2 = cv2
        self._np = np
        self._model = YOLO(model_path)
        self._zone_for_point = zone_for_point
        self._confidence_threshold = confidence_threshold

    def detect(self, image_bytes: bytes) -> list[PersonCount]:
        image = self._cv2.imdecode(self._np.frombuffer(image_bytes, self._np.uint8), self._cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("The camera frame is not a valid image.")
        results = self._model(image, classes=[0], conf=self._confidence_threshold, verbose=False)
        counts: Counter[str] = Counter()
        confidences: dict[str, list[float]] = {}
        for box in results[0].boxes:
            left, top, right, bottom = [float(value) for value in box.xyxy[0].tolist()]
            node_id = self._zone_for_point((left + right) / 2, (top + bottom) / 2)
            if node_id:
                counts[node_id] += 1
                confidences.setdefault(node_id, []).append(float(box.conf[0]))
        return [
            PersonCount(
                zone_node_id=node_id,
                people_count=count,
                confidence=round(sum(confidences[node_id]) / len(confidences[node_id]), 3),
            )
            for node_id, count in counts.items()
        ]
