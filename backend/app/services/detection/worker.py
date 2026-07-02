import asyncio
import base64
import json
import logging
import os
import time
from datetime import datetime, timezone
from functools import lru_cache
from typing import TYPE_CHECKING

import cv2
import numpy as np

from app.core.config import settings
from app.services.detection.roi import apply_roi, filter_detections_by_roi

if TYPE_CHECKING:
    from app.services.detection.engine import DetectionEngine
    from app.models.camera import Camera

logger = logging.getLogger(__name__)


@lru_cache(maxsize=256)
def _color_for_class(cls_id: int) -> tuple:
    """Color BGR determinístico por clase, distribuido en la rueda HSV
    (multiplicador coprimo con 180 para maximizar la separación entre
    tonos antes de repetir, incluso con las 80 clases COCO)."""
    hue = (cls_id * 37) % 180
    hsv = np.uint8([[[hue, 220, 255]]])
    bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)[0][0]
    return int(bgr[0]), int(bgr[1]), int(bgr[2])

RECONNECT_DELAY = 5  # segundos entre intentos de reconexión RTSP


class StreamWorker:
    def __init__(self, camera, engine: "DetectionEngine"):
        self.camera = camera
        self.engine = engine
        self._stop_event = asyncio.Event()
        self._paused_event = asyncio.Event()
        self._frame_count = 0
        # Solo relevante para source_type == "video": tras la primera pasada
        # completa no se vuelven a guardar eventos en las vueltas del loop
        # (mismo contenido, evita duplicar eventos indefinidamente).
        self._video_completed_pass = False

    def stop(self):
        self._stop_event.set()

    def pause(self):
        """Detiene la lectura/inferencia sin cerrar el stream (solo video)."""
        self._paused_event.set()

    def resume(self):
        self._paused_event.clear()

    @property
    def is_paused(self) -> bool:
        return self._paused_event.is_set()

    async def run(self):
        camera = self.camera
        logger.info(f"[Worker:{camera.id}] Iniciando stream para '{camera.name}'")

        if camera.source_type == "image":
            await self._process_image()
            return

        while not self._stop_event.is_set():
            try:
                await self._process_stream()
            except Exception as e:
                logger.error(f"[Worker:{camera.id}] Error en stream: {e}")

            if not self._stop_event.is_set():
                logger.info(f"[Worker:{camera.id}] Reconectando en {RECONNECT_DELAY}s...")
                await asyncio.sleep(RECONNECT_DELAY)

    async def _process_image(self):
        camera = self.camera
        path = camera.stream_url
        if not os.path.exists(path):
            logger.error(f"[Worker:{camera.id}] Imagen no encontrada: {path}")
            return

        frame = cv2.imread(path)
        if frame is None:
            logger.error(f"[Worker:{camera.id}] No se pudo leer la imagen: {path}")
            return

        annotated, detections = await asyncio.get_event_loop().run_in_executor(
            None, self._detect, frame
        )
        self.engine.update_frame(camera.id, annotated)
        await self._publish_frame(annotated)
        if detections:
            await self._save_and_publish_events(detections, annotated, camera)

    async def _process_stream(self):
        camera = self.camera
        url = self._build_url()
        cap = cv2.VideoCapture(url)

        if not cap.isOpened():
            raise ConnectionError(f"No se pudo abrir el stream: {url}")

        logger.info(f"[Worker:{camera.id}] Stream abierto: {url}")
        process_every = settings.DEFAULT_PROCESS_EVERY_N_FRAMES
        frame_idx = 0
        last_detections = []

        loop = asyncio.get_event_loop()

        while not self._stop_event.is_set():
            if self._paused_event.is_set():
                # Nadie está viendo este video: no leer/inferir, pero mantener
                # el cap abierto para reanudar exactamente donde quedó.
                await asyncio.sleep(0.5)
                continue

            ret, frame = await loop.run_in_executor(None, cap.read)
            if not ret:
                if camera.source_type == "video":
                    self._video_completed_pass = True
                break

            frame_idx += 1
            if frame_idx % process_every != 0:
                # Publicar frame sin anotar (mantiene fluidez)
                self.engine.update_frame(camera.id, frame)
                await self._publish_frame(frame)
                await asyncio.sleep(0)
                continue

            annotated, detections = await loop.run_in_executor(None, self._detect, frame)
            self.engine.update_frame(camera.id, annotated)
            await self._publish_frame(annotated)

            new_detections = [d for d in detections if d not in last_detections]
            if new_detections:
                last_detections = detections
                # Tras la primera pasada de un video, las vueltas del loop
                # siguen mostrándose en vivo pero ya no generan eventos
                # duplicados del mismo contenido.
                skip_events = camera.source_type == "video" and self._video_completed_pass
                if not skip_events:
                    await self._save_and_publish_events(new_detections, annotated, camera)

            await asyncio.sleep(0)

        cap.release()
        logger.info(f"[Worker:{camera.id}] Stream cerrado")

    def _detect(self, frame: np.ndarray):
        camera = self.camera
        model = self.engine.model
        if model is None:
            return frame, []

        # Aplicar ROI si existe
        roi_frame = apply_roi(frame, camera.roi) if camera.roi else frame

        results = model(
            roi_frame,
            conf=camera.confidence_threshold,
            verbose=False,
        )

        detections = []
        annotated = frame.copy()

        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            for box in boxes:
                cls_id = int(box.cls[0])
                # Filtrar por clases configuradas
                if camera.classes_filter and cls_id not in camera.classes_filter:
                    continue

                conf = float(box.conf[0])
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                cls_name = model.names.get(cls_id, str(cls_id))

                detections.append({
                    "class_id": cls_id,
                    "class_name": cls_name,
                    "confidence": conf,
                    "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                })

                # Dibujar bbox con color determinístico por clase
                color = _color_for_class(cls_id)
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                label = f"{cls_name} {conf:.0%}"
                cv2.putText(annotated, label, (x1, y1 - 8),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

        # Filtrar por ROI
        if camera.roi:
            detections = filter_detections_by_roi(detections, camera.roi, frame.shape)

        return annotated, detections

    def _build_url(self) -> str:
        camera = self.camera
        if camera.source_type == "video":
            return camera.stream_url

        url = camera.stream_url
        if camera.username and camera.password_encrypted:
            from app.core.security import decrypt_camera_password
            pwd = decrypt_camera_password(camera.password_encrypted)
            if "://" in url:
                proto, rest = url.split("://", 1)
                url = f"{proto}://{camera.username}:{pwd}@{rest}"
        return url

    async def _publish_frame(self, frame: np.ndarray):
        try:
            import redis.asyncio as aioredis
            _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            b64 = base64.b64encode(buf).decode()
            r = aioredis.from_url(settings.REDIS_URL)
            await r.publish(f"camera:{self.camera.id}:frames", b64)
            await r.aclose()
        except Exception as e:
            logger.debug(f"[Worker:{self.camera.id}] Error publicando frame: {e}")

    async def _save_and_publish_events(self, detections: list, frame: np.ndarray, camera):
        from app.db.session import AsyncSessionLocal
        from app.models.event import Event

        ts = datetime.now(timezone.utc)
        date_str = ts.strftime("%Y-%m-%d")
        ts_str = ts.strftime("%Y%m%d_%H%M%S_%f")

        snap_dir = os.path.join(settings.SNAPSHOTS_DIR, date_str, str(camera.id))
        os.makedirs(snap_dir, exist_ok=True)
        snap_path = os.path.join(snap_dir, f"{ts_str}.jpg")
        cv2.imwrite(snap_path, frame)

        async with AsyncSessionLocal() as db:
            for det in detections:
                event = Event(
                    camera_id=camera.id,
                    camera_name=camera.name,
                    detected_class=det["class_name"],
                    confidence=det["confidence"],
                    bbox={"x1": det["x1"], "y1": det["y1"], "x2": det["x2"], "y2": det["y2"]},
                    snapshot_path=snap_path,
                    roi_active=bool(camera.roi),
                    timestamp=ts,
                )
                db.add(event)
            await db.commit()

        # Publicar evento a Redis
        try:
            import redis.asyncio as aioredis
            payload = json.dumps({
                "camera_id": camera.id,
                "camera_name": camera.name,
                "detections": detections,
                "timestamp": ts.isoformat(),
                "snapshot_path": snap_path,
            })
            r = aioredis.from_url(settings.REDIS_URL)
            await r.publish(f"camera:{camera.id}:events", payload)
            await r.publish("events:global", payload)
            await r.aclose()
        except Exception as e:
            logger.debug(f"[Worker:{camera.id}] Error publicando evento: {e}")
