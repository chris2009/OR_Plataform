import { useState, useEffect, useRef, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Plus, Edit2, Trash2, Power, Upload, Check, X as XIcon } from "lucide-react";
import { camerasApi, type Camera, type SourceType } from "@/api";
import { COCO_CLASSES, COCO_BY_CATEGORY } from "@/lib/cocoClasses";
import { cn } from "@/lib/utils";

const MAX_ACTIVE = 2;

interface CameraForm {
  name: string;
  source_type: SourceType;
  stream_url: string;
  ip_address: string;
  username: string;
  password: string;
  confidence_threshold: number;
  classes_filter: number[];
  is_active: boolean;
  detection_enabled: boolean;
  roi: number[][] | null;
}

const emptyForm = (): CameraForm => ({
  name: "",
  source_type: "rtsp",
  stream_url: "",
  ip_address: "",
  username: "",
  password: "",
  confidence_threshold: 0.5,
  classes_filter: [],
  is_active: false,
  detection_enabled: true,
  roi: null,
});

function ClassMultiSelect({
  selected,
  onChange,
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = COCO_CLASSES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        placeholder="Buscar clase..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-field text-sm"
      />
      <div className="max-h-48 overflow-y-auto space-y-2 rounded-lg border border-white/10 p-2">
        {selected.length > 0 && (
          <div className="flex items-center justify-between text-xs text-gray-400 pb-1 border-b border-white/5">
            <span>{selected.length} seleccionadas</span>
            <button onClick={() => onChange([])} className="text-danger hover:text-danger/80">Limpiar</button>
          </div>
        )}
        {Object.entries(grouped).map(([cat, classes]) => (
          <div key={cat}>
            <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">{cat}</p>
            <div className="flex flex-wrap gap-1">
              {classes.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "px-2 py-0.5 rounded text-xs border transition-colors",
                    selected.includes(c.id)
                      ? "bg-accent/20 border-accent text-accent"
                      : "border-white/10 text-gray-400 hover:border-white/20"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-xs text-gray-600 text-center py-2">Sin resultados</p>}
      </div>
      {selected.length === 0 && <p className="text-xs text-gray-500">Vacío = detectar todas las clases</p>}
    </div>
  );
}

function SourceTypeBadge({ type }: { type: SourceType }) {
  const colors: Record<SourceType, string> = {
    rtsp: "bg-accent/20 text-accent",
    video: "bg-warning/20 text-warning",
    image: "bg-success/20 text-success",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs uppercase font-mono", colors[type])}>
      {type}
    </span>
  );
}

export default function CamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [modal, setModal] = useState<{ open: boolean; editing: Camera | null }>({ open: false, editing: null });
  const [form, setForm] = useState<CameraForm>(emptyForm());
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const activeCount = cameras.filter((c) => c.is_active).length;

  const load = () => camerasApi.list().then((r) => setCameras(r.data));
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm());
    setError("");
    setTestResult(null);
    setModal({ open: true, editing: null });
  };

  const openEdit = (c: Camera) => {
    setForm({
      name: c.name,
      source_type: c.source_type,
      stream_url: c.stream_url,
      ip_address: c.ip_address,
      username: c.username,
      password: "",
      confidence_threshold: c.confidence_threshold,
      classes_filter: c.classes_filter,
      is_active: c.is_active,
      detection_enabled: c.detection_enabled,
      roi: c.roi,
    });
    setError("");
    setTestResult(null);
    setModal({ open: true, editing: c });
  };

  const handleSave = async () => {
    setError("");
    if (!form.name.trim()) { setError("El nombre es requerido"); return; }
    if (form.is_active && !modal.editing?.is_active && activeCount >= MAX_ACTIVE) {
      setError(`Límite de ${MAX_ACTIVE} fuentes activas alcanzado`);
      return;
    }
    try {
      if (modal.editing) {
        await camerasApi.update(modal.editing.id, form);
      } else {
        await camerasApi.create(form);
      }
      setModal({ open: false, editing: null });
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al guardar";
      setError(msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar cámara?")) return;
    await camerasApi.delete(id);
    load();
  };

  const handleToggleActive = async (cam: Camera) => {
    if (!cam.is_active && activeCount >= MAX_ACTIVE) {
      alert(`Límite de ${MAX_ACTIVE} fuentes activas alcanzado`);
      return;
    }
    await camerasApi.update(cam.id, { is_active: !cam.is_active });
    load();
  };

  const handleTest = async () => {
    if (!modal.editing) { setTestResult({ ok: false, msg: "Guarda la cámara primero" }); return; }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await camerasApi.testConnection(modal.editing.id);
      setTestResult({ ok: true, msg: (res.data as { message: string }).message });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error de conexión";
      setTestResult({ ok: false, msg });
    } finally {
      setTesting(false);
    }
  };

  const onDrop = useCallback(async (files: File[]) => {
    if (!files[0]) return;
    try {
      const res = await camerasApi.uploadMedia(files[0]);
      setForm((f) => ({
        ...f,
        stream_url: res.data.path,
        source_type: res.data.source_type as SourceType,
      }));
    } catch { setError("Error al subir archivo"); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "video/*": [".mp4", ".avi", ".mkv", ".mov"],
      "image/*": [".jpg", ".jpeg", ".png", ".bmp"],
    },
    maxFiles: 1,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Configuración de Cámaras</h1>
          <p className="text-sm text-gray-500 mt-0.5 font-mono">{activeCount}/{MAX_ACTIVE} fuentes activas</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Agregar Fuente
        </button>
      </div>

      {/* Cameras grid */}
      {cameras.length === 0 ? (
        <div className="card-glass p-12 text-center text-gray-500">
          <p>No hay fuentes configuradas.</p>
          <p className="text-sm mt-1">Haz click en "Agregar Fuente" para comenzar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cameras.map((cam) => (
            <div key={cam.id} className="card-glass p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{cam.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <SourceTypeBadge type={cam.source_type} />
                    {cam.roi && <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">ROI</span>}
                  </div>
                </div>
                <div className={cn("w-2.5 h-2.5 rounded-full mt-1", cam.is_active ? "bg-success" : "bg-gray-600")} />
              </div>

              {cam.ip_address && (
                <p className="text-xs font-mono text-gray-500">{cam.ip_address}</p>
              )}

              <div className="text-xs text-gray-500 space-y-0.5">
                <p>Umbral: <span className="font-mono">{(cam.confidence_threshold * 100).toFixed(0)}%</span></p>
                <p>Clases: <span>{cam.classes_filter.length === 0 ? "Todas" : cam.classes_filter.length}</span></p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => handleToggleActive(cam)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                    cam.is_active
                      ? "bg-success/20 text-success hover:bg-success/30"
                      : "bg-white/5 text-gray-400 hover:bg-white/10"
                  )}
                >
                  <Power size={12} /> {cam.is_active ? "Activa" : "Inactiva"}
                </button>
                <button onClick={() => openEdit(cam)} className="btn-ghost p-1.5 text-gray-400">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(cam.id)} className="btn-ghost p-1.5 text-gray-400 hover:text-danger">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto flex items-start justify-center p-4 pt-10" onClick={() => setModal({ open: false, editing: null })}>
          <div className="card-glass w-full max-w-2xl p-6 space-y-5 mb-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{modal.editing ? "Editar fuente" : "Nueva fuente"}</h2>
              <button onClick={() => setModal({ open: false, editing: null })} className="text-gray-500 hover:text-white"><XIcon size={18} /></button>
            </div>

            {/* Nombre */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-field" placeholder="Cámara Principal" />
            </div>

            {/* Tipo de fuente */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tipo de fuente</label>
              <div className="flex gap-2">
                {(["rtsp", "video", "image"] as SourceType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, source_type: t }))}
                    className={cn(
                      "px-3 py-1.5 rounded text-sm border transition-colors uppercase",
                      form.source_type === t ? "border-accent bg-accent/10 text-accent" : "border-white/10 text-gray-400"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Campos por tipo */}
            {form.source_type === "rtsp" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">IP Address</label>
                    <input type="text" value={form.ip_address} onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))} className="input-field" placeholder="192.168.1.100" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Stream URL</label>
                    <input type="text" value={form.stream_url} onChange={(e) => setForm((f) => ({ ...f, stream_url: e.target.value }))} className="input-field" placeholder="rtsp://..." />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Usuario</label>
                    <input type="text" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Contraseña</label>
                    <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className="input-field" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing}
                    className="btn-ghost text-sm flex items-center gap-1"
                  >
                    {testing ? "Probando..." : "Probar conexión"}
                  </button>
                  {testResult && (
                    <span className={cn("text-xs", testResult.ok ? "text-success" : "text-danger")}>
                      {testResult.ok ? <Check size={13} className="inline mr-1" /> : null}
                      {testResult.msg}
                    </span>
                  )}
                </div>
              </div>
            )}

            {(form.source_type === "video" || form.source_type === "image") && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Archivo</label>
                <div
                  {...getRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                    isDragActive ? "border-accent bg-accent/5" : "border-white/10 hover:border-white/20"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload size={24} className="mx-auto text-gray-500 mb-2" />
                  {form.stream_url ? (
                    <p className="text-xs font-mono text-success truncate">{form.stream_url.split("/").pop()}</p>
                  ) : (
                    <p className="text-sm text-gray-500">Arrastra un archivo o haz click para seleccionar</p>
                  )}
                </div>
              </div>
            )}

            {/* Umbral de confianza */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Umbral de confianza: <span className="font-mono">{(form.confidence_threshold * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min={0.1} max={1} step={0.05}
                value={form.confidence_threshold}
                onChange={(e) => setForm((f) => ({ ...f, confidence_threshold: parseFloat(e.target.value) }))}
                className="w-full accent-accent"
              />
            </div>

            {/* Clases COCO */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Clases a detectar</label>
              <ClassMultiSelect
                selected={form.classes_filter}
                onChange={(ids) => setForm((f) => ({ ...f, classes_filter: ids }))}
              />
            </div>

            {/* Opciones */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="accent-accent"
                />
                <span className="text-sm text-gray-400">Activar al guardar</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.detection_enabled}
                  onChange={(e) => setForm((f) => ({ ...f, detection_enabled: e.target.checked }))}
                  className="accent-accent"
                />
                <span className="text-sm text-gray-400">Detección habilitada</span>
              </label>
            </div>

            {error && <p className="text-sm text-danger bg-danger/10 rounded px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} className="btn-primary flex-1">Guardar</button>
              <button onClick={() => setModal({ open: false, editing: null })} className="btn-ghost flex-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
