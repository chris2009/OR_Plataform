# PROMPT PARA CLAUDE CODE — PLATAFORMA DE DETECCIÓN DE OBJETOS CON YOLO

> Pega este prompt completo en Claude Code y déjalo trabajar de forma autónoma.

---

## 🎯 OBJETIVO GENERAL

Construir una **plataforma web de videovigilancia inteligente** que detecta objetos en tiempo real usando **YOLOv8 de Ultralytics** (con selección automática del modelo óptimo según hardware disponible), soporta múltiples fuentes de entrada (cámaras IP vía RTSP, videos y imágenes subidas), permite definir zonas ROI, captura eventos con clasificación configurable por el usuario, gestiona usuarios con roles, y corre completamente **dockerizada en local**.

### 🤖 Selección Automática de Modelo YOLO
El sistema debe elegir el modelo YOLOv8 más adecuado al arrancar según el hardware disponible:
- **GPU NVIDIA detectada (CUDA)** → usar `yolov8m.pt` (balance precisión/velocidad)
- **Solo CPU, RAM ≥ 16 GB** → usar `yolov8s.pt` (velocidad aceptable en CPU)
- **Solo CPU, RAM < 16 GB** → usar `yolov8n.pt` (nano, máxima velocidad)

El modelo seleccionado se muestra en `/settings` y puede ser cambiado manualmente por el Admin. El cambio recarga el DetectionEngine sin reiniciar el servidor.

---

## 🏗️ ARQUITECTURA GENERAL

```
proyecto/
├── backend/                  # FastAPI + Python
│   ├── app/
│   │   ├── main.py
│   │   ├── api/              # Routers: auth, cameras, detection, events, users
│   │   ├── core/             # Config, security, JWT
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Lógica de negocio
│   │   │   ├── detection/    # Motor YOLO, procesamiento de frames
│   │   │   ├── camera/       # Gestión de streams RTSP
│   │   │   └── events/       # Guardado de eventos
│   │   └── db/               # Sesión PostgreSQL, migraciones Alembic
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                 # React + Vite + Tailwind CSS
│   ├── src/
│   │   ├── pages/            # Login, Cameras, Live, Events, Users, Settings
│   │   ├── components/       # UI components reutilizables
│   │   ├── hooks/            # Custom hooks (useWebSocket, useAuth, etc.)
│   │   ├── store/            # Zustand global state
│   │   └── api/              # Axios cliente
│   ├── Dockerfile
│   └── vite.config.ts
│
├── nginx/                    # Reverse proxy
│   └── nginx.conf
│
├── docker-compose.yml
└── .env.example
```

---

## ⚙️ STACK TECNOLÓGICO

### Backend
- **Python 3.11**
- **FastAPI** — API REST + WebSockets
- **YOLOv8** via `ultralytics` — detección de objetos (modelo `yolov8m.pt` por defecto, descargado automáticamente)
- **OpenCV** (`opencv-python-headless`) — captura RTSP, lectura de video/imagen, dibujo de bboxes
- **SQLAlchemy + Alembic** — ORM + migraciones
- **PostgreSQL 15** (Dockerizado) — base de datos principal
- **Passlib + python-jose** — autenticación JWT
- **Celery + Redis** (opcional para tareas pesadas, incluir si es viable)
- **Pillow** — procesamiento de imágenes subidas

### Frontend
- **React 18 + Vite**
- **TypeScript**
- **Tailwind CSS** + **shadcn/ui**
- **Zustand** — gestión de estado global
- **Axios** — cliente HTTP
- **React Router v6** — navegación SPA
- **Fabric.js** — dibujo de ROI (polígonos/rectángulos) sobre canvas de preview de cámara
- **WebSockets nativos** — stream de frames y eventos en tiempo real
- **Recharts** — gráficas de eventos
- **react-dropzone** — subida de archivos
- **Lucide React** — iconos

### Infraestructura
- **Docker + Docker Compose**
- **Nginx** — reverse proxy (frontend en `/`, API en `/api`, WebSockets en `/ws`)
- **Redis** — caché y pub/sub para broadcasting de frames
- **Volúmenes Docker** para modelos YOLO, uploads, snapshots de eventos

---

## 🐳 DOCKER COMPOSE

Servicios:
1. `db` — PostgreSQL 15, volumen persistente, healthcheck
2. `redis` — Redis 7 Alpine
3. `backend` — FastAPI, depende de `db` y `redis`, expone puerto 8000
4. `frontend` — Nginx sirviendo build de React, expone puerto 80
5. `nginx` — Reverse proxy principal en puerto 80 (o 3000 en dev)

Variables de entorno via `.env`:
```
POSTGRES_USER=vigilancia
POSTGRES_PASSWORD=secure_pass
POSTGRES_DB=yolo_platform
SECRET_KEY=super_secret_jwt_key_change_me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
REDIS_URL=redis://redis:6379
BACKEND_CORS_ORIGINS=http://localhost,http://localhost:3000
```

---

## 🔐 MÓDULO: AUTENTICACIÓN Y USUARIOS

### Modelo de usuario (`users` table):
```python
id, username, email, hashed_password, full_name, role, is_active, theme_preference, created_at, updated_at
```

### Roles:
- **Admin** — acceso total, gestión de usuarios, configuración global
- **Operator** — puede ver cámaras en vivo, ver eventos, configurar cámaras propias
- **Viewer** — solo lectura: live view y eventos

### Endpoints:
- `POST /api/auth/login` — JWT token
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `PUT /api/auth/me` — actualizar perfil, cambiar tema

### Seed inicial:
- Crear usuario admin por defecto (`admin` / `admin123`) en primer arranque con Alembic seed

---

## 📷 MÓDULO: CONFIGURACIÓN DE CÁMARAS

### Modelo `cameras`:
```python
id, name, source_type (rtsp|video|image), stream_url, ip_address, username, password,
roi (JSON: lista de puntos [x,y]), is_active, detection_enabled, 
confidence_threshold (default 0.5), classes_filter (JSON: lista de class_ids COCO),
owner_id, created_at, updated_at
```

### Endpoints:
- `GET /api/cameras` — listar cámaras del usuario (admin ve todas)
- `POST /api/cameras` — crear cámara
- `PUT /api/cameras/{id}` — editar
- `DELETE /api/cameras/{id}` — eliminar
- `POST /api/cameras/{id}/test-connection` — probar stream RTSP
- `POST /api/cameras/upload-media` — subir video o imagen (multipart)
- `GET /api/cameras/{id}/snapshot` — foto actual del stream

### Reglas:
- Máximo 2 fuentes activas simultáneamente (validar en el backend)
- Una fuente puede ser: cámara RTSP, video subido, o imagen subida
- El campo `roi` almacena un polígono como lista de coordenadas relativas (0.0–1.0) para ser independiente de resolución
- El campo `classes_filter` acepta cualquier subconjunto de las 80 clases COCO. Si está vacío, detectar todas.

### Clases COCO disponibles para filtrar (las 80):
El frontend debe incluir un multiselect buscable con todas las clases COCO agrupadas por categoría:
- **Personas**: person
- **Vehículos**: bicycle, car, motorcycle, airplane, bus, train, truck, boat
- **Animales**: bird, cat, dog, horse, sheep, cow, elephant, bear, zebra, giraffe
- **Objetos cotidianos**: backpack, umbrella, handbag, tie, suitcase, frisbee, skis, snowboard, sports ball, kite, baseball bat, baseball glove, skateboard, surfboard, tennis racket
- **Electrónica**: tv, laptop, mouse, remote, keyboard, cell phone
- **Cocina**: microwave, oven, toaster, sink, refrigerator
- **Muebles**: chair, couch, potted plant, bed, dining table, toilet
- **Otros**: bottle, wine glass, cup, fork, knife, spoon, bowl, banana, apple, sandwich, orange, broccoli, carrot, hot dog, pizza, donut, cake, book, clock, vase, scissors, teddy bear, hair drier, toothbrush

El Admin puede además crear **perfiles de detección** predefinidos (p.ej. "Seguridad Perimetral" = [person], "Control Vehicular" = [car, truck, bus, motorcycle]) desde `/settings`, aplicables rápidamente al configurar una cámara.

---

## 🎬 MOTOR DE DETECCIÓN (backend/app/services/detection/)

### Arquitectura:
- **DetectionEngine** — singleton que mantiene YOLOv8 cargado en memoria
- **StreamWorker** — hilo/proceso por cámara activa que:
  1. Abre el stream (RTSP con OpenCV, video con `cv2.VideoCapture`, imagen como frame único)
  2. Aplica ROI (si está definido, crea máscara y solo procesa esa región)
  3. Pasa frames a YOLOv8 cada N frames (configurable, default: cada 3 frames)
  4. Filtra detecciones por `confidence_threshold` y `classes_filter`
  5. Dibuja bounding boxes y labels en el frame
  6. Publica el frame anotado a Redis pub/sub channel `camera:{id}:frames`
  7. Si hay detección nueva (diferente a la anterior), guarda evento en BD y publica a `camera:{id}:events`

### ROI Processing:
```python
def apply_roi(frame, roi_points):
    # roi_points en coordenadas relativas → convertir a píxeles
    # Crear máscara poligonal con OpenCV
    # Aplicar máscara al frame antes de pasar a YOLO
    # Las detecciones fuera del ROI son descartadas
```

### Frame Streaming vía WebSocket:
- `GET /ws/camera/{id}/stream` — WebSocket que consume el channel Redis y envía frames JPEG base64
- `GET /ws/camera/{id}/events` — WebSocket de eventos en tiempo real
- `GET /ws/events` — WebSocket global de todos los eventos

---

## 📊 MÓDULO: EVENTOS

### Modelo `events`:
```python
id, camera_id, camera_name, detected_class, confidence, 
bbox (JSON), snapshot_path, roi_active (bool),
timestamp, acknowledged (bool), acknowledged_by, acknowledged_at
```

### Endpoints:
- `GET /api/events` — listar con filtros (camera_id, class, date_range, acknowledged, pagination)
- `GET /api/events/{id}`
- `PUT /api/events/{id}/acknowledge`
- `DELETE /api/events/{id}` — solo admin
- `GET /api/events/stats` — conteos agrupados por clase, por cámara, por hora

### Snapshot:
- Al detectar un objeto, guardar el frame como JPEG en `/app/data/snapshots/{date}/{camera_id}/{timestamp}.jpg`
- Servir snapshots via `GET /api/events/{id}/snapshot`

---

## 🖥️ FRONTEND — VISTAS Y DISEÑO

### Tema Visual
Diseño **industrial / dark-tech**: dashboard de videovigilancia profesional.
- Fondo dark por defecto (`#0A0E17`), con opción light mode (`#F0F2F7`)
- Paleta: azul eléctrico (`#2563EB`) como acento principal, verde (`#10B981`) para activo, rojo (`#EF4444`) para alertas, ámbar (`#F59E0B`) para advertencias
- Tipografía: **JetBrains Mono** para datos técnicos (IPs, coords), **Inter** para UI general
- Transiciones suaves, glassmorphism sutil en cards, borders con 1px opacidad
- Implementar toggle Dark/Light en el header, persistido por usuario en BD y en localStorage

### Páginas:

#### 1. `/login` — Login
- Pantalla centrada, logo + nombre del sistema
- Formulario: username, password, botón login
- JWT almacenado en memoria (no localStorage), refresh token en httpOnly cookie
- Redirect automático si ya tiene sesión activa
- Mensaje de error claro si credenciales incorrectas

#### 2. `/cameras` — Configurar Cámaras
Panel principal con:
- Lista de cámaras configuradas (cards con: nombre, tipo de fuente, estado activo/inactivo, IP si aplica, botones editar/eliminar/activar)
- Botón **"+ Agregar Fuente"** que abre modal/drawer con:
  - Nombre de la cámara
  - **Tipo de fuente** (selector): Cámara IP (RTSP) | Video | Imagen
  - Si RTSP: campos IP Address, Stream URL, Username, Password + botón "Probar conexión"
  - Si Video/Imagen: componente drag-and-drop para subir archivo (react-dropzone)
  - Umbral de confianza (slider 0.1–1.0)
  - Clases a detectar (multiselect con las 80 clases COCO, buscable)
  - **Sección ROI**: preview del primer frame de la cámara/video/imagen, con canvas encima donde el usuario dibuja un polígono o rectángulo usando Fabric.js. Botón "Limpiar ROI". El ROI se guarda como coordenadas relativas.
  - Botón guardar
- Indicador visual: "X/2 fuentes activas"
- Al activar más de 2 fuentes simultáneas, mostrar error: "Límite de 2 fuentes activas alcanzado"

#### 3. `/live` — Vista en Vivo
- Grid de hasta 2 celdas (según cámaras activas): cada celda muestra el stream de video anotado con bboxes via WebSocket
- Si no hay cámaras activas: placeholder con instrucciones
- Cada celda muestra: nombre de cámara, FPS actual, cantidad de detecciones en frame actual, badge "ROI activo" si aplica
- Overlay con las detecciones del frame actual (clase + confianza) como lista flotante
- Botón para expandir una celda a pantalla completa

#### 4. `/events` — Eventos
- Tabla con: snapshot thumbnail, timestamp, cámara, clase detectada, confianza (badge %), ROI activo, estado (pendiente/reconocido), acciones
- Filtros en sidebar: por cámara, por clase, por rango de fechas, por estado
- Click en fila → modal detalle con snapshot grande, info completa, botón "Reconocer"
- Sección de estadísticas arriba: tarjetas con total eventos hoy, top clase detectada, top cámara, gráfica de barras por hora (Recharts)
- Paginación (20 por página)

#### 5. `/users` — Gestión de Usuarios (solo Admin)
- Tabla de usuarios: nombre, email, rol (badge coloreado), estado, fecha creación, acciones
- Modal crear/editar usuario: nombre completo, username, email, password, rol, estado activo
- No puede eliminarse a sí mismo
- Cambio de contraseña de otros usuarios (admin)

#### 6. `/settings` — Configuración (solo Admin)
- Toggle Dark/Light mode (también disponible en header para todos)
- **Modelo YOLO activo**: selector entre yolov8n / yolov8s / yolov8m / yolov8l con descripción de cada uno (velocidad vs precisión). Muestra el modelo auto-seleccionado al arrancar con badge "Auto".
- Umbral de confianza global (slider, overrideable por cámara)
- FPS de procesamiento global (1–30, overrideable por cámara)
- **Perfiles de detección**: crear/editar/eliminar perfiles de clases predefinidos (nombre + lista de clases COCO). Botón para aplicar un perfil a todas las cámaras activas.
- **Info del sistema**: modelo activo, versión Ultralytics, GPU disponible (nombre + VRAM si hay CUDA), RAM total/disponible, uptime del servidor
- Botón "Recargar motor de detección" (aplica cambios de modelo sin reiniciar Docker)

### Navegación:
- Sidebar colapsable izquierdo con iconos + labels: Dashboard, Cámaras, En Vivo, Eventos, Usuarios (solo admin), Configuración
- Header: logo, nombre usuario + rol, toggle tema, botón logout

---

## 🔌 COMUNICACIÓN EN TIEMPO REAL

- WebSocket para frames: el frontend abre `ws://localhost/ws/camera/{id}/stream` y renderiza frames JPEG base64 en un `<img>` o `<canvas>`, actualizando `src` en cada mensaje
- WebSocket para eventos: escucha `ws://localhost/ws/events` y actualiza la lista de eventos en tiempo real con una notificación toast

---

## 🗄️ BASE DE DATOS (PostgreSQL)

### Tablas:
- `users` — gestión de usuarios
- `cameras` — configuración de fuentes
- `events` — eventos detectados
- `system_config` — configuración global (clave-valor): modelo activo, FPS global, umbral global
- `detection_profiles` — perfiles de clases: id, name, classes (JSON array), created_by, created_at

### Migraciones:
- Alembic configurado, primera migración crea todas las tablas
- Script de seed para usuario admin inicial

---

## 📁 ARCHIVOS IMPORTANTES A CREAR

### `docker-compose.yml` completo con todos los servicios
### `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim
# Instalar libGL para OpenCV
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```
### `backend/requirements.txt`:
```
fastapi==0.111.0
uvicorn[standard]==0.30.0
ultralytics==8.2.0
opencv-python-headless==4.9.0.80
sqlalchemy==2.0.30
alembic==1.13.1
asyncpg==0.29.0
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
redis==5.0.4
Pillow==10.3.0
pydantic-settings==2.2.1
websockets==12.0
httpx==0.27.0
```
### `frontend/Dockerfile` con multi-stage build (build + nginx)
### `nginx/nginx.conf` con proxy_pass a backend y upgrade para WebSockets

---

## 🚀 INSTRUCCIONES DE ARRANQUE

El `README.md` debe incluir:
```bash
# 1. Clonar repo
git clone ...

# 2. Copiar variables de entorno
cp .env.example .env

# 3. Levantar todo
docker-compose up --build

# 4. Acceder
# Frontend: http://localhost
# API docs: http://localhost/api/docs
# Usuario por defecto: admin / admin123
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN (en orden)

Claude Code debe implementar en este orden:

1. [ ] Estructura de carpetas del proyecto completa
2. [ ] `docker-compose.yml` + `.env.example` + `nginx.conf`
3. [ ] Backend: modelos SQLAlchemy + Alembic init + seed admin
4. [ ] Backend: auth JWT (login, me, refresh)
5. [ ] Backend: CRUD cameras con validación de límite 2 activas
6. [ ] Backend: endpoint upload media (video/imagen)
7. [ ] Backend: DetectionEngine con selección automática de modelo YOLOv8 + ROI masking
8. [ ] Backend: StreamWorker por cámara → Redis pub/sub
9. [ ] Backend: WebSocket frame streaming + events streaming
10. [ ] Backend: CRUD events con snapshots
11. [ ] Backend: CRUD users (solo admin)
12. [ ] Backend: CRUD detection_profiles + endpoint apply-all
13. [ ] Backend: endpoints settings (system info, model reload, config global)
14. [ ] Frontend: setup Vite + React + TypeScript + Tailwind + shadcn/ui + Zustand
15. [ ] Frontend: sistema de rutas protegidas por rol
16. [ ] Frontend: página Login
17. [ ] Frontend: layout principal (sidebar + header + dark/light toggle)
18. [ ] Frontend: página Cameras con modal + ROI canvas (Fabric.js) + multiselect clases COCO
19. [ ] Frontend: página Live con WebSocket frame viewer (hasta 2 celdas)
20. [ ] Frontend: página Events con tabla, filtros, stats, Recharts
21. [ ] Frontend: página Users (admin)
22. [ ] Frontend: página Settings con selector de modelo, perfiles de detección, info hardware
23. [ ] Dockerfiles backend y frontend (multi-stage)
24. [ ] README.md con instrucciones completas

---

## 📌 NOTAS IMPORTANTES PARA CLAUDE CODE

- **No usar GPU por defecto**: YOLOv8 debe arrancar en CPU. Al iniciar, detectar hardware con `torch.cuda.is_available()` y `psutil.virtual_memory()` para elegir el modelo automáticamente. Loguear la decisión en consola.
- **Hot-reload del modelo**: el endpoint `POST /api/settings/reload-engine` descarga el nuevo modelo si no existe y reinicia el DetectionEngine sin cortar los WebSockets activos (drena los workers, recarga, los reinicia).
- **Perfiles de detección**: endpoints `GET/POST/PUT/DELETE /api/detection-profiles` y `POST /api/detection-profiles/{id}/apply-all` que actualiza el `classes_filter` de todas las cámaras activas.
- **Manejo de errores de stream**: Si el stream RTSP se corta, el StreamWorker debe intentar reconectar cada 5 segundos sin crashear.
- **Imagen como fuente**: Si la fuente es una imagen, procesarla una vez y mostrarla estática en el live view con las detecciones dibujadas.
- **ROI en coordenadas relativas**: Guardar siempre como porcentajes (0.0–1.0) para ser agnóstico a la resolución.
- **Seguridad**: Las contraseñas de cámaras se guardan cifradas en BD con Fernet. Nunca exponerlas en la API response.
- **CORS**: Configurar correctamente para desarrollo local.
- **Tipos TypeScript estrictos** en todo el frontend.
- **El modelo YOLOv8** se descarga automáticamente en el primer uso de Ultralytics. Crear volumen Docker para persistirlo en `/root/.config/Ultralytics/` y en `/app/models/`.
- **Los snapshots** se guardan en `/app/data/snapshots/` con volumen Docker persistente.
- El frontend debe mostrar un **loader de conexión** mientras el WebSocket del stream no esté listo.
- **Variables de entorno** nunca hardcodeadas; usar `pydantic-settings` en backend y `.env` en frontend con Vite (`VITE_API_URL`, `VITE_WS_URL`).

---

*Prompt generado para Claude Code — Plataforma YOLO Surveillance v1.1 (React + Vite | Auto-model | Clases configurables)*
