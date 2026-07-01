import { useState, useEffect } from "react";
import { RefreshCw, Plus, Trash2, CheckCheck } from "lucide-react";
import { settingsApi, profilesApi, type SystemConfig, type SystemInfo, type DetectionProfile } from "@/api";
import { cn } from "@/lib/utils";

const YOLO_MODELS = [
  { value: "yolov8n.pt", label: "YOLOv8n — Nano", desc: "Máxima velocidad, menor precisión" },
  { value: "yolov8s.pt", label: "YOLOv8s — Small", desc: "Velocidad aceptable en CPU" },
  { value: "yolov8m.pt", label: "YOLOv8m — Medium", desc: "Balance precisión/velocidad (GPU)" },
  { value: "yolov8l.pt", label: "YOLOv8l — Large", desc: "Alta precisión, requiere más recursos" },
];

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [profiles, setProfiles] = useState<DetectionProfile[]>([]);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const load = async () => {
    const [cfgRes, infoRes, profRes] = await Promise.all([
      settingsApi.get(),
      settingsApi.systemInfo(),
      profilesApi.list(),
    ]);
    setConfig(cfgRes.data);
    setInfo(infoRes.data);
    setProfiles(profRes.data);
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await settingsApi.update(config);
      showToast("Configuración guardada");
    } catch { showToast("Error al guardar"); }
    setSaving(false);
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await settingsApi.reloadEngine();
      showToast("Motor recargado correctamente");
      load();
    } catch { showToast("Error al recargar motor"); }
    setReloading(false);
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    await profilesApi.create({ name: newProfileName.trim(), classes: [] });
    setNewProfileName("");
    load();
  };

  const handleApplyAll = async (id: number) => {
    await profilesApi.applyAll(id);
    showToast("Perfil aplicado a todas las cámaras activas");
  };

  const handleDeleteProfile = async (id: number) => {
    if (!confirm("¿Eliminar perfil?")) return;
    await profilesApi.delete(id);
    load();
  };

  if (!config) return <div className="text-gray-500 text-sm">Cargando...</div>;

  return (
    <div className="space-y-8 max-w-3xl">
      <h1 className="text-xl font-semibold">Configuración del Sistema</h1>

      {/* Modelo YOLO */}
      <section className="card-glass p-6 space-y-4">
        <h2 className="font-medium text-gray-200">Modelo YOLO</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {YOLO_MODELS.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => setConfig((c) => c && { ...c, yolo_model: value })}
              className={cn(
                "text-left p-3 rounded-lg border transition-all",
                config.yolo_model === value || (config.yolo_model === "auto" && value === info?.model_name)
                  ? "border-accent bg-accent/10 text-white"
                  : "border-white/10 hover:border-white/20 text-gray-400"
              )}
            >
              <p className="font-medium text-sm">{label}</p>
              <p className="text-xs mt-0.5 opacity-70">{desc}</p>
              {config.yolo_model === "auto" && value === info?.model_name && (
                <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded mt-1 inline-block">Auto</span>
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Umbral confianza global</label>
            <input
              type="range"
              min={0.1} max={1} step={0.05}
              value={config.confidence_threshold}
              onChange={(e) => setConfig((c) => c && { ...c, confidence_threshold: parseFloat(e.target.value) })}
              className="w-full accent-accent"
            />
            <span className="text-xs font-mono text-gray-400">{(config.confidence_threshold * 100).toFixed(0)}%</span>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">FPS de procesamiento global</label>
            <input
              type="range"
              min={1} max={30} step={1}
              value={config.process_every_n_frames}
              onChange={(e) => setConfig((c) => c && { ...c, process_every_n_frames: parseInt(e.target.value) })}
              className="w-full accent-accent"
            />
            <span className="text-xs font-mono text-gray-400">procesar cada {config.process_every_n_frames} frames</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            onClick={handleReload}
            disabled={reloading}
            className="btn-ghost flex items-center gap-2"
          >
            <RefreshCw size={15} className={cn(reloading && "animate-spin")} />
            Recargar motor
          </button>
        </div>
      </section>

      {/* Perfiles de detección */}
      <section className="card-glass p-6 space-y-4">
        <h2 className="font-medium text-gray-200">Perfiles de Detección</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Nombre del perfil..."
            className="input-field flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCreateProfile()}
          />
          <button onClick={handleCreateProfile} className="btn-primary flex items-center gap-1">
            <Plus size={15} /> Crear
          </button>
        </div>
        <div className="space-y-2">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-white/5 hover:border-white/10 transition-colors">
              <div>
                <p className="text-sm font-medium">{p.name}</p>
                <p className="text-xs text-gray-500 font-mono">
                  {p.classes.length === 0 ? "Todas las clases" : `${p.classes.length} clases`}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleApplyAll(p.id)}
                  className="text-gray-400 hover:text-success transition-colors"
                  title="Aplicar a todas las cámaras"
                >
                  <CheckCheck size={15} />
                </button>
                <button
                  onClick={() => handleDeleteProfile(p.id)}
                  className="text-gray-400 hover:text-danger transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Info del sistema */}
      {info && (
        <section className="card-glass p-6 space-y-3">
          <h2 className="font-medium text-gray-200">Información del Sistema</h2>
          <div className="grid grid-cols-2 gap-3 text-sm font-mono">
            {[
              { label: "Modelo activo", value: info.model_name },
              { label: "Ultralytics", value: info.ultralytics_version },
              { label: "GPU", value: info.gpu || "No disponible" },
              { label: "RAM total", value: info.ram_total_gb ? `${info.ram_total_gb} GB` : "—" },
              { label: "RAM disponible", value: info.ram_available_gb ? `${info.ram_available_gb} GB` : "—" },
              { label: "Uptime", value: formatUptime(info.uptime_seconds) },
              { label: "Cámaras activas", value: info.active_cameras.join(", ") || "Ninguna" },
            ].map(({ label, value }) => (
              <div key={label} className="space-y-0.5">
                <p className="text-gray-500 text-xs">{label}</p>
                <p className="text-white text-xs">{value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-surface border border-white/10 rounded-lg px-4 py-3 text-sm shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
