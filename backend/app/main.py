from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.config import settings
from app.api import auth, cameras, events, users, settings as settings_router, detection_profiles
from app.api import ws_router
from app.services.detection.engine import detection_engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.SNAPSHOTS_DIR, exist_ok=True)
    os.makedirs(settings.UPLOADS_DIR, exist_ok=True)
    os.makedirs(settings.YOLO_MODEL_DIR, exist_ok=True)
    await detection_engine.initialize()
    yield
    # Shutdown
    await detection_engine.shutdown()


app = FastAPI(
    title="YOLO Surveillance API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST routers
app.include_router(auth.router, prefix="/api")
app.include_router(cameras.router, prefix="/api")
app.include_router(events.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(detection_profiles.router, prefix="/api")

# WebSocket routers
app.include_router(ws_router.router)

# Servir snapshots como archivos estáticos
if os.path.exists(settings.SNAPSHOTS_DIR):
    app.mount("/snapshots", StaticFiles(directory=settings.SNAPSHOTS_DIR), name="snapshots")
