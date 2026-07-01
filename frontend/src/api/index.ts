import { api } from "./client";
import type { AuthUser } from "@/store/authStore";

// ── Auth ──────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string }>("/auth/login", { username, password }),
  me: () => api.get<AuthUser>("/auth/me"),
  updateMe: (data: Partial<AuthUser> & { password?: string }) => api.put<AuthUser>("/auth/me", data),
  logout: () => api.post("/auth/logout"),
};

// ── Cameras ───────────────────────────────────────────────
export type SourceType = "rtsp" | "video" | "image";

export interface Camera {
  id: number;
  name: string;
  source_type: SourceType;
  stream_url: string;
  ip_address: string;
  username: string;
  roi: number[][] | null;
  is_active: boolean;
  detection_enabled: boolean;
  confidence_threshold: number;
  classes_filter: number[];
  owner_id: number;
  created_at: string;
  updated_at: string;
}

export const camerasApi = {
  list: () => api.get<Camera[]>("/cameras"),
  create: (data: Partial<Camera> & { password?: string }) => api.post<Camera>("/cameras", data),
  update: (id: number, data: Partial<Camera> & { password?: string }) =>
    api.put<Camera>(`/cameras/${id}`, data),
  delete: (id: number) => api.delete(`/cameras/${id}`),
  testConnection: (id: number) => api.post(`/cameras/${id}/test-connection`),
  uploadMedia: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<{ filename: string; path: string; source_type: string }>("/cameras/upload-media", fd);
  },
  snapshot: (id: number) => api.get(`/cameras/${id}/snapshot`, { responseType: "blob" }),
};

// ── Events ────────────────────────────────────────────────
export interface Event {
  id: number;
  camera_id: number;
  camera_name: string;
  detected_class: string;
  confidence: number;
  bbox: { x1: number; y1: number; x2: number; y2: number } | null;
  snapshot_path: string;
  roi_active: boolean;
  timestamp: string;
  acknowledged: boolean;
  acknowledged_by: number | null;
  acknowledged_at: string | null;
}

export interface GroupedCount {
  group: string;
  counts: Record<string, number>;
}

export interface EventStats {
  total_today: number;
  by_class: Record<string, number>;
  by_camera: Record<string, number>;
  by_hour: { hour: number; count: number }[];
  by_day: GroupedCount[];
  by_source: GroupedCount[];
  all_classes: string[];
  all_cameras: string[];
}

export const eventsApi = {
  list: (params?: Record<string, unknown>) => api.get<Event[]>("/events", { params }),
  get: (id: number) => api.get<Event>(`/events/${id}`),
  acknowledge: (id: number) => api.put<Event>(`/events/${id}/acknowledge`),
  delete: (id: number) => api.delete(`/events/${id}`),
  stats: () => api.get<EventStats>("/events/stats"),
  snapshotUrl: (id: number) => `${import.meta.env.VITE_API_URL || "/api"}/events/${id}/snapshot`,
};

// ── Users ─────────────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: "admin" | "operator" | "viewer";
  is_active: boolean;
  theme_preference: string;
  created_at: string;
  updated_at: string;
}

export const usersApi = {
  list: () => api.get<User[]>("/users"),
  create: (data: Partial<User> & { password: string }) => api.post<User>("/users", data),
  update: (id: number, data: Partial<User> & { password?: string }) =>
    api.put<User>(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
};

// ── Settings ──────────────────────────────────────────────
export interface SystemConfig {
  yolo_model: string;
  confidence_threshold: number;
  process_every_n_frames: number;
}

export interface SystemInfo {
  model_name: string;
  ultralytics_version: string;
  gpu: string | null;
  ram_total_gb: number | null;
  ram_available_gb: number | null;
  active_cameras: number[];
  uptime_seconds: number;
}

export const settingsApi = {
  get: () => api.get<SystemConfig>("/settings"),
  update: (data: Partial<SystemConfig>) => api.put<SystemConfig>("/settings", data),
  reloadEngine: () => api.post("/settings/reload-engine"),
  systemInfo: () => api.get<SystemInfo>("/settings/system-info"),
};

// ── Detection Profiles ────────────────────────────────────
export interface DetectionProfile {
  id: number;
  name: string;
  classes: number[];
  created_by: number | null;
  created_at: string;
}

export const profilesApi = {
  list: () => api.get<DetectionProfile[]>("/detection-profiles"),
  create: (data: { name: string; classes: number[] }) =>
    api.post<DetectionProfile>("/detection-profiles", data),
  update: (id: number, data: Partial<{ name: string; classes: number[] }>) =>
    api.put<DetectionProfile>(`/detection-profiles/${id}`, data),
  delete: (id: number) => api.delete(`/detection-profiles/${id}`),
  applyAll: (id: number) => api.post(`/detection-profiles/${id}/apply-all`),
};
