# CHECKLIST DE IMPLEMENTACIÓN — YOLO Surveillance Platform

> Actualizar este archivo al completar cada fase.
> Estado: `[ ]` pendiente | `[x]` completado | `[~]` en progreso

---

## FASE 1 — Infraestructura Base ✅
- [x] **1.1** Estructura de carpetas del proyecto completa (`backend/`, `frontend/`, `nginx/`)
- [x] **1.2** `docker-compose.yml` con servicios: db, redis, backend, frontend, nginx
- [x] **1.3** `.env.example` con todas las variables documentadas
- [x] **1.4** `nginx/nginx.conf` con proxy_pass a backend, upgrade WebSockets, static files
- [x] **1.5** `backend/Dockerfile` con libGL para OpenCV
- [x] **1.6** `frontend/Dockerfile` multi-stage (build Vite + nginx)
- [x] **1.7** `backend/requirements.txt` completo

---

## FASE 2 — Backend: Base de Datos y Auth ✅
- [x] **2.1** `backend/app/core/config.py` — pydantic-settings, variables de entorno
- [x] **2.2** `backend/app/db/` — sesión SQLAlchemy, base declarativa
- [x] **2.3** Modelos SQLAlchemy: `users`, `cameras`, `events`, `system_config`, `detection_profiles`
- [x] **2.4** Alembic configurado + primera migración (crea todas las tablas)
- [x] **2.5** Script seed: usuario admin por defecto (`admin` / `admin123`)
- [x] **2.6** `backend/app/core/security.py` — hash de contraseñas (passlib), JWT (python-jose)
- [x] **2.7** Router `auth`: `POST /login`, `POST /refresh`, `GET /me`, `PUT /me`
- [x] **2.8** Middleware de autenticación + decoradores de roles

---

## FASE 3 — Backend: Cámaras y Media ✅
- [x] **3.1** Schemas Pydantic para cameras (create, update, response)
- [x] **3.2** Router `cameras`: CRUD completo (`GET`, `POST`, `PUT`, `DELETE`)
- [x] **3.3** Validación: máximo 2 fuentes activas simultáneas
- [x] **3.4** Endpoint `POST /cameras/{id}/test-connection` — probar stream RTSP
- [x] **3.5** Endpoint `POST /cameras/upload-media` — subir video/imagen (multipart)
- [x] **3.6** Endpoint `GET /cameras/{id}/snapshot` — foto actual del stream
- [x] **3.7** Cifrado Fernet para contraseñas de cámaras en BD

---

## FASE 4 — Backend: Motor de Detección ✅
- [x] **4.1** `DetectionEngine` singleton — carga YOLOv8, selección automática de modelo por hardware
- [x] **4.2** Lógica de selección: CUDA → yolov8m | CPU+16GB → yolov8s | CPU<16GB → yolov8n
- [x] **4.3** `apply_roi()` — máscara poligonal OpenCV con coordenadas relativas
- [x] **4.4** `StreamWorker` por cámara: abre stream, procesa cada N frames, aplica ROI, detecta
- [x] **4.5** Filtrado por `confidence_threshold` y `classes_filter` por cámara
- [x] **4.6** Dibujo de bboxes y labels en frame anotado
- [x] **4.7** Publicación de frames a Redis pub/sub `camera:{id}:frames`
- [x] **4.8** Reconexión automática RTSP cada 5 segundos si se corta
- [x] **4.9** Soporte imagen como fuente: procesar una vez, frame estático

---

## FASE 5 — Backend: WebSockets y Eventos ✅
- [x] **5.1** WebSocket `GET /ws/camera/{id}/stream` — consume Redis, envía frames JPEG base64
- [x] **5.2** WebSocket `GET /ws/camera/{id}/events` — eventos en tiempo real por cámara
- [x] **5.3** WebSocket `GET /ws/events` — todos los eventos en tiempo real
- [x] **5.4** Guardado de evento en BD cuando hay nueva detección
- [x] **5.5** Guardado de snapshot JPEG en `/app/data/snapshots/{date}/{camera_id}/{ts}.jpg`
- [x] **5.6** Publicación a `camera:{id}:events` en Redis

---

## FASE 6 — Backend: Eventos, Usuarios y Settings ✅
- [x] **6.1** Router `events`: `GET` con filtros+paginación, `GET /{id}`, `PUT /{id}/acknowledge`, `DELETE /{id}`
- [x] **6.2** Endpoint `GET /events/stats` — conteos por clase, cámara, hora
- [x] **6.3** Endpoint `GET /events/{id}/snapshot` — sirve el snapshot guardado
- [x] **6.4** Router `users` (solo Admin): CRUD completo, cambio de contraseña
- [x] **6.5** Router `detection-profiles`: CRUD + `POST /{id}/apply-all`
- [x] **6.6** Router `settings`: `GET`, `PUT`, `POST /reload-engine`, `GET /system-info`
- [x] **6.7** Hot-reload del DetectionEngine sin cortar WebSockets activos
- [x] **6.8** `GET /system-info`: modelo activo, versión Ultralytics, GPU/RAM, uptime

---

## FASE 7 — Frontend: Setup y Autenticación ✅
- [x] **7.1** Scaffold Vite + React 18 + TypeScript + Tailwind CSS
- [x] **7.2** Instalación: shadcn/ui, Zustand, Axios, React Router v6, Fabric.js, Recharts, react-dropzone, Lucide React
- [x] **7.3** `vite.config.ts` con proxy a backend en dev
- [x] **7.4** Store Zustand: auth state, theme, active cameras
- [x] **7.5** Cliente Axios con interceptores JWT (access token en memoria, refresh automático)
- [x] **7.6** Sistema de rutas protegidas por rol (PrivateRoute + RoleRoute)
- [x] **7.7** Página `/login` — formulario, JWT en memoria, redirect si ya autenticado

---

## FASE 8 — Frontend: Layout y Tema ✅
- [x] **8.1** Layout principal: Sidebar colapsable + Header
- [x] **8.2** Sidebar: iconos + labels, links a todas las páginas, badge Usuarios solo para Admin
- [x] **8.3** Header: logo, nombre+rol del usuario, toggle Dark/Light, botón logout
- [x] **8.4** Sistema Dark/Light: persistido en localStorage + BD
- [x] **8.5** Tokens de diseño: colores, fuentes (JetBrains Mono + Inter), glassmorphism en cards

---

## FASE 9 — Frontend: Página Cameras ✅
- [x] **9.1** Lista de cámaras en cards: nombre, tipo, estado, IP, acciones
- [x] **9.2** Indicador "X/2 fuentes activas"
- [x] **9.3** Modal/Drawer "Agregar/Editar Fuente" completo
- [x] **9.4** Campos RTSP: IP, URL, usuario, contraseña + botón "Probar conexión"
- [x] **9.5** Drag-and-drop para video/imagen (react-dropzone)
- [x] **9.6** Slider de umbral de confianza (0.1–1.0)
- [x] **9.7** Multiselect buscable de clases COCO agrupadas por categoría
- [x] **9.8** ROI: coordenadas relativas guardadas en BD
- [x] **9.9** Error visual cuando se intenta activar más de 2 fuentes

---

## FASE 10 — Frontend: Página Live ✅
- [x] **10.1** Grid de hasta 2 celdas para cámaras activas
- [x] **10.2** Placeholder si no hay cámaras activas
- [x] **10.3** Loader de conexión mientras WebSocket no está listo
- [x] **10.4** Renderizado de frames JPEG base64 via WebSocket
- [x] **10.5** Overlay: nombre cámara, FPS, badge "ROI activo", estado conexión
- [x] **10.6** Indicador visual de estado WebSocket (conectando/activo/error)
- [x] **10.7** Botón para expandir celda a pantalla completa

---

## FASE 11 — Frontend: Página Events ✅
- [x] **11.1** Sección de estadísticas: tarjetas (total hoy, top clase, top cámara, última hora)
- [x] **11.2** Gráfica de barras por hora con Recharts
- [x] **11.3** Tabla de eventos: thumbnail, timestamp, cámara, clase, confianza, estado, acciones
- [x] **11.4** Filtro por estado acknowledged
- [x] **11.5** Modal detalle: snapshot grande, info completa, botón "Reconocer"
- [x] **11.6** Paginación (20 por página)
- [x] **11.7** Botón reconocer y eliminar por evento

---

## FASE 12 — Frontend: Páginas Users y Settings ✅
- [x] **12.1** Página `/users` (solo Admin): tabla de usuarios con badges de rol
- [x] **12.2** Modal crear/editar usuario: nombre, username, email, password, rol, estado activo
- [x] **12.3** Prevenir auto-eliminación del usuario actual
- [x] **12.4** Página `/settings`: toggle Dark/Light via header
- [x] **12.5** Selector de modelo YOLO (n/s/m/l) con descripciones + badge "Auto"
- [x] **12.6** Sliders: umbral de confianza global, FPS de procesamiento global
- [x] **12.7** CRUD de perfiles de detección + botón "Aplicar a todas las cámaras"
- [x] **12.8** Sección info del sistema: modelo activo, Ultralytics version, GPU/RAM, uptime
- [x] **12.9** Botón "Recargar motor de detección"

---

## RESUMEN DE FASES

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Infraestructura Base (Docker, Nginx) | ✅ Completado |
| 2 | Backend: BD + Auth | ✅ Completado |
| 3 | Backend: Cámaras y Media | ✅ Completado |
| 4 | Backend: Motor de Detección | ✅ Completado |
| 5 | Backend: WebSockets y Eventos | ✅ Completado |
| 6 | Backend: Eventos, Usuarios, Settings | ✅ Completado |
| 7 | Frontend: Setup y Auth | ✅ Completado |
| 8 | Frontend: Layout y Tema | ✅ Completado |
| 9 | Frontend: Página Cameras | ✅ Completado |
| 10 | Frontend: Página Live | ✅ Completado |
| 11 | Frontend: Página Events | ✅ Completado |
| 12 | Frontend: Páginas Users y Settings | ✅ Completado |

---

*Última actualización: 2026-05-14 — **IMPLEMENTACIÓN COMPLETA** ✅*
