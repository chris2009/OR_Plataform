import asyncio
import logging
from typing import Dict, Optional

import numpy as np

from app.services.detection.model_selector import select_yolo_model
from app.services.detection.worker import StreamWorker

logger = logging.getLogger(__name__)


class DetectionEngine:
    """Singleton que gestiona el modelo YOLO y los StreamWorkers activos."""

    def __init__(self):
        self.model = None
        self.model_name: str = "auto"
        self._workers: Dict[int, StreamWorker] = {}
        self._lock = asyncio.Lock()
        self._latest_frames: Dict[int, Optional[np.ndarray]] = {}

    async def initialize(self, model_name: str = "auto"):
        async with self._lock:
            self._load_model(model_name)

    def _load_model(self, model_name: str):
        from ultralytics import YOLO
        from app.core.config import settings

        if model_name == "auto":
            model_name = select_yolo_model()

        model_path = model_name  # Ultralytics descarga automáticamente si no existe
        logger.info(f"[YOLO] Cargando modelo: {model_path}")
        self.model = YOLO(model_path)
        self.model_name = model_name
        logger.info(f"[YOLO] Modelo {model_path} cargado correctamente")

    async def reload(self, model_name: str):
        """Hot-reload: detiene workers, recarga modelo, reinicia workers."""
        async with self._lock:
            camera_ids = list(self._workers.keys())

            # Guardar referencias a las cámaras para reiniciar
            camera_configs = {}
            for cid, worker in self._workers.items():
                camera_configs[cid] = worker.camera

            # Detener todos los workers
            for cid in camera_ids:
                await self._stop_worker(cid)

            self._load_model(model_name)

            # Reiniciar workers con nueva configuración
            for cid, cam in camera_configs.items():
                await self._start_worker(cam)

    async def start_camera(self, camera):
        async with self._lock:
            if camera.id in self._workers:
                await self._stop_worker(camera.id)
            await self._start_worker(camera)

    async def _start_worker(self, camera):
        worker = StreamWorker(camera=camera, engine=self)
        self._workers[camera.id] = worker
        asyncio.create_task(worker.run())
        logger.info(f"[Engine] Worker iniciado para cámara {camera.id} ({camera.name})")

    async def stop_camera(self, camera_id: int):
        async with self._lock:
            await self._stop_worker(camera_id)

    async def _stop_worker(self, camera_id: int):
        worker = self._workers.pop(camera_id, None)
        if worker:
            worker.stop()
            logger.info(f"[Engine] Worker detenido para cámara {camera_id}")

    async def shutdown(self):
        async with self._lock:
            for cid in list(self._workers.keys()):
                await self._stop_worker(cid)

    def update_frame(self, camera_id: int, frame: np.ndarray):
        self._latest_frames[camera_id] = frame

    async def get_latest_frame(self, camera_id: int) -> Optional[np.ndarray]:
        return self._latest_frames.get(camera_id)

    def get_worker(self, camera_id: int) -> Optional[StreamWorker]:
        return self._workers.get(camera_id)

    def pause_camera(self, camera_id: int):
        """Pausa la lectura/inferencia de un worker (pensado solo para
        fuentes tipo video: deja de gastar CPU/GPU en loops que nadie mira,
        sin cerrar el archivo)."""
        worker = self._workers.get(camera_id)
        if worker:
            worker.pause()

    def resume_camera(self, camera_id: int):
        worker = self._workers.get(camera_id)
        if worker:
            worker.resume()

    def get_model_info(self) -> dict:
        try:
            import torch
            gpu = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None
        except Exception:
            gpu = None
        try:
            import psutil
            mem = psutil.virtual_memory()
            ram_total = round(mem.total / (1024 ** 3), 1)
            ram_available = round(mem.available / (1024 ** 3), 1)
        except Exception:
            ram_total = ram_available = None
        try:
            import ultralytics
            ultralytics_version = ultralytics.__version__
        except Exception:
            ultralytics_version = "unknown"

        return {
            "model_name": self.model_name,
            "ultralytics_version": ultralytics_version,
            "gpu": gpu,
            "ram_total_gb": ram_total,
            "ram_available_gb": ram_available,
            "active_cameras": list(self._workers.keys()),
        }


# Singleton global
detection_engine = DetectionEngine()
