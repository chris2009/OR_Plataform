import numpy as np
import cv2
from typing import List, Optional


def apply_roi(frame: np.ndarray, roi_points: Optional[List]) -> np.ndarray:
    """
    Aplica una máscara poligonal al frame.
    roi_points: lista de [x, y] en coordenadas relativas (0.0-1.0).
    Retorna el frame con píxeles fuera del ROI en negro.
    """
    if not roi_points or len(roi_points) < 3:
        return frame

    h, w = frame.shape[:2]
    pts = np.array(
        [[int(p[0] * w), int(p[1] * h)] for p in roi_points],
        dtype=np.int32,
    )

    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillPoly(mask, [pts], 255)

    masked = frame.copy()
    masked[mask == 0] = 0
    return masked


def filter_detections_by_roi(
    detections, roi_points: Optional[List], frame_shape: tuple
) -> list:
    """
    Filtra detecciones cuyo centro bbox cae fuera del ROI.
    detections: lista de dicts con claves x1, y1, x2, y2 (píxeles).
    """
    if not roi_points or len(roi_points) < 3:
        return detections

    h, w = frame_shape[:2]
    pts = np.array(
        [[int(p[0] * w), int(p[1] * h)] for p in roi_points],
        dtype=np.int32,
    )

    filtered = []
    for det in detections:
        cx = (det["x1"] + det["x2"]) / 2
        cy = (det["y1"] + det["y2"]) / 2
        if cv2.pointPolygonTest(pts, (cx, cy), False) >= 0:
            filtered.append(det)
    return filtered
