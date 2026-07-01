# YOLO Surveillance Platform

Plataforma web de videovigilancia inteligente con detección de objetos en tiempo real usando **YOLOv8 de Ultralytics**. Corre completamente dockerizada en local.

## Características

- Detección de objetos en tiempo real con YOLOv8 (selección automática del modelo según hardware)
- Soporte de múltiples fuentes: cámaras IP vía RTSP, videos subidos, imágenes subidas
- Hasta 2 fuentes activas simultáneas
- Zonas ROI (Region of Interest) configurables por cámara
- Captura y almacenamiento de eventos con snapshots
- Clasificación configurable: 80 clases COCO con perfiles predefinidos
- Gestión de usuarios con roles (Admin, Operator, Viewer)
- Dashboard en tiempo real vía WebSockets
- Tema Dark/Light persistido por usuario

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11, FastAPI, YOLOv8, OpenCV, SQLAlchemy |
| Base de Datos | PostgreSQL 15, Redis 7 |
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui |
| Infra | Docker Compose, Nginx |

## Selección Automática de Modelo YOLO

Al arrancar, el sistema detecta el hardware disponible:

| Hardware | Modelo |
|----------|--------|
| GPU NVIDIA (CUDA) | `yolov8m.pt` (balance precisión/velocidad) |
| CPU, RAM ≥ 16 GB | `yolov8s.pt` (velocidad aceptable) |
| CPU, RAM < 16 GB | `yolov8n.pt` (nano, máxima velocidad) |

El modelo puede cambiarse manualmente desde `/settings` (Admin).

## Requisitos Previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Docker Compose v2+
- 4 GB RAM mínimo disponible para contenedores

## Instalación y Arranque

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd Object_Recognition_Plataforma

# 2. Copiar variables de entorno
cp .env.example .env

# 3. (Opcional) Editar .env con tus credenciales
#    nano .env

# 4. Levantar todos los servicios
docker-compose up --build

# 5. Esperar a que todos los contenedores estén saludables (~2-3 min)
#    (El modelo YOLO se descarga automáticamente en el primer arranque)
```

## Acceso

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost |
| API REST | http://localhost/api |
| API Docs (Swagger) | http://localhost/api/docs |
| API Docs (ReDoc) | http://localhost/api/redoc |

**Credenciales por defecto:**
- Usuario: `admin`
- Contraseña: `admin123`

> Cambiar la contraseña del admin tras el primer login.

## Estructura del Proyecto

```
Object_Recognition_Plataforma/
├── backend/                  # FastAPI + Python
│   ├── app/
│   │   ├── api/              # Routers REST
│   │   ├── core/             # Config, JWT, seguridad
│   │   ├── models/           # SQLAlchemy ORM
│   │   ├── schemas/          # Pydantic schemas
│   │   └── services/         # DetectionEngine, StreamWorker, eventos
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/            # Vistas SPA
│   │   ├── components/       # UI reutilizables
│   │   ├── hooks/            # useWebSocket, useAuth
│   │   ├── store/            # Zustand
│   │   └── api/              # Cliente Axios
│   └── Dockerfile
├── nginx/
│   └── nginx.conf            # Reverse proxy
├── docker-compose.yml
├── .env.example
└── CHECKLIST.md              # Progreso de implementación
```

## Variables de Entorno

Ver `.env.example` para todas las variables disponibles. Las principales:

| Variable | Descripción | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Usuario de PostgreSQL | `vigilancia` |
| `POSTGRES_PASSWORD` | Contraseña PostgreSQL | `secure_pass` |
| `POSTGRES_DB` | Nombre de la base de datos | `yolo_platform` |
| `SECRET_KEY` | Clave para firmar JWT | Cambiar en producción |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Expiración del token | `480` |
| `REDIS_URL` | URL de Redis | `redis://redis:6379` |

## Uso Básico

### 1. Agregar una Fuente de Video
- Ir a `/cameras` → "+ Agregar Fuente"
- Elegir tipo: **Cámara IP (RTSP)**, **Video** o **Imagen**
- Configurar umbral de confianza y clases a detectar
- Dibujar ROI opcional sobre el preview del frame
- Guardar y activar

### 2. Ver en Tiempo Real
- Ir a `/live`
- El grid muestra hasta 2 fuentes activas con bboxes dibujados en vivo

### 3. Revisar Eventos
- Ir a `/events`
- Filtrar por cámara, clase, fecha, estado
- Click en evento para ver snapshot completo y reconocer

### 4. Gestionar Usuarios (Admin)
- Ir a `/users`
- Crear usuarios con rol Operator o Viewer

### 5. Configuración Avanzada (Admin)
- Ir a `/settings`
- Cambiar modelo YOLO, umbral global, FPS de procesamiento
- Crear perfiles de detección predefinidos
- Ver info del sistema (GPU, RAM, uptime)

## Comandos Útiles

```bash
# Ver logs en tiempo real
docker-compose logs -f backend

# Reiniciar solo el backend
docker-compose restart backend

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (BORRA datos y modelos descargados)
docker-compose down -v

# Ver estado de contenedores
docker-compose ps
```

## Notas Técnicas

- El primer arranque puede tardar varios minutos mientras se descarga el modelo YOLO
- Los snapshots de eventos se guardan en el volumen Docker `snapshots_data`
- Los modelos YOLO descargados se persisten en el volumen `yolo_models`
- Máximo 2 fuentes activas simultáneas (limitación de recursos)
- Los streams RTSP reconectan automáticamente cada 5 segundos si se cortan

## Progreso de Implementación

Ver [CHECKLIST.md](CHECKLIST.md) para el estado detallado de cada fase.
