import logging
import os

logger = logging.getLogger(__name__)


def select_yolo_model() -> str:
    """Elige el modelo YOLOv8 óptimo según el hardware disponible."""
    try:
        import torch
        cuda_available = torch.cuda.is_available()
    except ImportError:
        cuda_available = False

    if cuda_available:
        try:
            import torch
            gpu_name = torch.cuda.get_device_name(0)
            logger.info(f"[YOLO] GPU detectada: {gpu_name} → usando yolov8m.pt")
        except Exception:
            logger.info("[YOLO] GPU CUDA detectada → usando yolov8m.pt")
        return "yolov8m.pt"

    try:
        import psutil
        ram_gb = psutil.virtual_memory().total / (1024 ** 3)
    except ImportError:
        ram_gb = 8.0

    if ram_gb >= 16:
        logger.info(f"[YOLO] Solo CPU, RAM={ram_gb:.1f}GB ≥ 16GB → usando yolov8s.pt")
        return "yolov8s.pt"

    logger.info(f"[YOLO] Solo CPU, RAM={ram_gb:.1f}GB < 16GB → usando yolov8n.pt")
    return "yolov8n.pt"
