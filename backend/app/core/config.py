from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Base de datos
    DATABASE_URL: str = "postgresql+asyncpg://vigilancia:secure_pass@db:5432/yolo_platform"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://vigilancia:secure_pass@db:5432/yolo_platform"

    # JWT
    SECRET_KEY: str = "change_me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Redis
    REDIS_URL: str = "redis://redis:6379"

    # CORS
    BACKEND_CORS_ORIGINS: str = "http://localhost,http://localhost:3000"

    # Fernet (cifrado contraseñas de cámaras)
    FERNET_KEY: str = ""

    # YOLO
    YOLO_MODEL_DIR: str = "/app/models"
    DEFAULT_CONFIDENCE: float = 0.5
    DEFAULT_PROCESS_EVERY_N_FRAMES: int = 3

    # Rutas de datos
    SNAPSHOTS_DIR: str = "/app/data/snapshots"
    UPLOADS_DIR: str = "/app/data/uploads"

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.BACKEND_CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
