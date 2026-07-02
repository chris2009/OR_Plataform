import asyncio
import base64
import logging

import cv2
import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.services.detection.engine import detection_engine

router = APIRouter(prefix="/ws", tags=["websockets"])
logger = logging.getLogger(__name__)

# Cuenta de clientes viendo el stream en vivo de cada cámara, para pausar
# la inferencia de fuentes tipo "video" cuando nadie está mirando.
_stream_subscribers: dict[int, int] = {}


def _on_stream_subscribe(camera_id: int):
    _stream_subscribers[camera_id] = _stream_subscribers.get(camera_id, 0) + 1
    worker = detection_engine.get_worker(camera_id)
    if worker and worker.camera.source_type == "video":
        worker.resume()


def _on_stream_unsubscribe(camera_id: int):
    remaining = max(0, _stream_subscribers.get(camera_id, 1) - 1)
    _stream_subscribers[camera_id] = remaining
    if remaining == 0:
        worker = detection_engine.get_worker(camera_id)
        if worker and worker.camera.source_type == "video":
            worker.pause()


async def _redis_to_ws(ws: WebSocket, channel: str):
    """Consume un canal Redis pub/sub y reenvía mensajes al WebSocket."""
    r = aioredis.from_url(settings.REDIS_URL)
    pubsub = r.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                if isinstance(data, bytes):
                    data = data.decode()
                await ws.send_text(data)
    finally:
        await pubsub.unsubscribe(channel)
        await r.aclose()


@router.websocket("/camera/{camera_id}/stream")
async def ws_camera_stream(websocket: WebSocket, camera_id: int):
    await websocket.accept()
    _on_stream_subscribe(camera_id)
    try:
        latest_frame = await detection_engine.get_latest_frame(camera_id)
        if latest_frame is not None:
            _, buf = cv2.imencode(".jpg", latest_frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            await websocket.send_text(base64.b64encode(buf).decode())
        await _redis_to_ws(websocket, f"camera:{camera_id}:frames")
    except WebSocketDisconnect:
        logger.debug(f"[WS] Cliente desconectado del stream {camera_id}")
    except Exception as e:
        logger.error(f"[WS] Error en stream {camera_id}: {e}")
    finally:
        _on_stream_unsubscribe(camera_id)


@router.websocket("/camera/{camera_id}/events")
async def ws_camera_events(websocket: WebSocket, camera_id: int):
    await websocket.accept()
    try:
        await _redis_to_ws(websocket, f"camera:{camera_id}:events")
    except WebSocketDisconnect:
        logger.debug(f"[WS] Cliente desconectado de eventos {camera_id}")
    except Exception as e:
        logger.error(f"[WS] Error en eventos WS {camera_id}: {e}")


@router.websocket("/events")
async def ws_global_events(websocket: WebSocket):
    await websocket.accept()
    try:
        await _redis_to_ws(websocket, "events:global")
    except WebSocketDisconnect:
        logger.debug("[WS] Cliente desconectado de eventos globales")
    except Exception as e:
        logger.error(f"[WS] Error en eventos globales WS: {e}")
