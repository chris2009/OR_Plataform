# CLAUDE.md — Plataforma YOLO Surveillance

## Descripción del Proyecto
Plataforma web de videovigilancia inteligente con detección de objetos en tiempo real usando YOLOv8.
Corre completamente dockerizada en local. No subir a producción cloud por ahora.

## Stack Principal
- **Backend**: Python 3.11, FastAPI, YOLOv8 (ultralytics), OpenCV headless, SQLAlchemy, Alembic, PostgreSQL 15, Redis 7, Passlib/JWT
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Axios, Fabric.js, Recharts, react-dropzone, Lucide React
- **Infra**: Docker Compose, Nginx reverse proxy, volúmenes Docker persistentes

## Arquitectura de Carpetas
```
Object_Recognition_Plataforma/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── api/          # Routers: auth, cameras, detection, events, users, settings
│   │   ├── core/         # Config (pydantic-settings), security, JWT
│   │   ├── models/       # SQLAlchemy ORM
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/
│   │   │   ├── detection/  # DetectionEngine + StreamWorker
│   │   │   ├── camera/     # Gestión RTSP
│   │   │   └── events/     # Guardado de eventos + snapshots
│   │   └── db/           # Sesión + migraciones Alembic
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/        # Login, Cameras, Live, Events, Users, Settings
│   │   ├── components/   # UI reutilizables
│   │   ├── hooks/        # useWebSocket, useAuth, etc.
│   │   ├── store/        # Zustand
│   │   └── api/          # Axios client
│   ├── Dockerfile
│   └── vite.config.ts
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .env.example
├── CHECKLIST.md
└── README.md
```

## Reglas Clave de Implementación

### Backend
- **Selección automática de modelo YOLO al arrancar**:
  - GPU NVIDIA (CUDA) → `yolov8m.pt`
  - Solo CPU, RAM ≥ 16 GB → `yolov8s.pt`
  - Solo CPU, RAM < 16 GB → `yolov8n.pt`
- El modelo arranca en CPU por defecto. Usar `torch.cuda.is_available()` + `psutil.virtual_memory()`.
- Docker no da acceso a la GPU del host por defecto. Para habilitar CUDA dentro del contenedor hay que levantar con el override `docker-compose.gpu.yml` (aditivo, no rompe el setup sin GPU): `docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build -d`. El `torch` instalado ya incluye soporte CUDA (`+cu121`); no requiere cambios de código, solo el passthrough del device.
- **Máximo 2 fuentes RTSP/video activas simultáneas** (validar en backend; loop de inferencia continuo). Las fuentes tipo **imagen** no cuentan para este límite: se procesan una sola vez (sin loop continuo) y pueden estar activas sin restricción.
- Contraseñas de cámaras cifradas con **Fernet** en BD. Nunca exponerlas en responses API.
- ROI siempre en **coordenadas relativas (0.0–1.0)**.
- StreamWorker reconecta cada 5 seg si RTSP se corta. No debe crashear.
- Imagen como fuente: procesar una vez, mostrar estática con detecciones.
- Hot-reload del modelo: `POST /api/settings/reload-engine` sin cortar WebSockets.
- Usar `pydantic-settings` para config. Nunca hardcodear variables de entorno.
- Volumen Docker para modelos en `/root/.config/Ultralytics/` y `/app/models/`.
- Snapshots en `/app/data/snapshots/{date}/{camera_id}/{timestamp}.jpg`.

### Frontend
- TypeScript estricto en todo el frontend.
- JWT en memoria (no localStorage). Refresh token en httpOnly cookie.
- Diseño dark-tech industrial: fondo `#0A0E17`, acento `#2563EB`, activo `#10B981`, alerta `#EF4444`.
- Fuentes: JetBrains Mono (datos técnicos), Inter (UI general).
- Dark/Light toggle persistido en BD + localStorage.
- WebSocket frames: renderizar JPEG base64 en `<img>` o `<canvas>`.
- Loader de conexión mientras WebSocket no esté listo.
- Variables de entorno via `VITE_API_URL`, `VITE_WS_URL`.

### Seguridad y CORS
- CORS configurado correctamente para desarrollo local.
- `SECRET_KEY` y credenciales DB siempre desde `.env`.

## Rutas API Principales
```
POST   /api/auth/login
POST   /api/auth/refresh
GET    /api/auth/me
PUT    /api/auth/me

GET    /api/cameras
POST   /api/cameras
PUT    /api/cameras/{id}
DELETE /api/cameras/{id}
POST   /api/cameras/{id}/test-connection
POST   /api/cameras/upload-media
GET    /api/cameras/{id}/snapshot

GET    /api/events
GET    /api/events/{id}
PUT    /api/events/{id}/acknowledge
DELETE /api/events/{id}
GET    /api/events/stats
GET    /api/events/{id}/snapshot

GET    /api/users
POST   /api/users
PUT    /api/users/{id}
DELETE /api/users/{id}

GET    /api/settings
PUT    /api/settings
POST   /api/settings/reload-engine
GET    /api/settings/system-info

GET    /api/detection-profiles
POST   /api/detection-profiles
PUT    /api/detection-profiles/{id}
DELETE /api/detection-profiles/{id}
POST   /api/detection-profiles/{id}/apply-all

WS     /ws/camera/{id}/stream
WS     /ws/camera/{id}/events
WS     /ws/events
```

## Roles de Usuario
- **Admin**: acceso total, gestión de usuarios y settings
- **Operator**: cámaras propias, live view, eventos
- **Viewer**: solo lectura (live + eventos)

## Usuario Admin por Defecto
- Username: `admin` | Password: `admin123`
- Creado via Alembic seed en primer arranque

## Levantar el Proyecto
```bash
cp .env.example .env
# Generar SECRET_KEY y FERNET_KEY reales antes de continuar (ver README)
docker compose up --build -d
# Con GPU NVIDIA: docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build -d
# Frontend: http://localhost
# API docs: http://localhost/api/docs
```

## Checklist de Fases
Ver `CHECKLIST.md` para estado actualizado de implementación.
