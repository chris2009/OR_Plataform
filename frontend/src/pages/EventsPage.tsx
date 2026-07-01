import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { CheckCircle, Trash2 } from "lucide-react";
import { eventsApi, type Event, type EventStats } from "@/api";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-glass p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold font-mono">{value}</p>
    </div>
  );
}

export default function EventsPage() {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Event | null>(null);
  const [filters, setFilters] = useState({ acknowledged: "" as "" | "true" | "false" });

  const load = useCallback(async () => {
    const params: Record<string, unknown> = { page, page_size: 20 };
    if (filters.acknowledged !== "") params.acknowledged = filters.acknowledged === "true";
    const [evRes, stRes] = await Promise.all([
      eventsApi.list(params),
      eventsApi.stats(),
    ]);
    setEvents(evRes.data);
    setStats(stRes.data);
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const handleAck = async (id: number) => {
    await eventsApi.acknowledge(id);
    load();
    if (selected?.id === id) setSelected((s) => s && { ...s, acknowledged: true });
  };

  const handleDelete = async (id: number) => {
    await eventsApi.delete(id);
    load();
    if (selected?.id === id) setSelected(null);
  };

  const topClass = stats ? Object.entries(stats.by_class).sort((a, b) => b[1] - a[1])[0]?.[0] : "—";
  const topCamera = stats ? Object.entries(stats.by_camera).sort((a, b) => b[1] - a[1])[0]?.[0] : "—";

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Eventos de Detección</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total hoy" value={stats?.total_today ?? 0} />
        <StatCard label="Top clase" value={topClass ?? "—"} />
        <StatCard label="Top cámara" value={topCamera ?? "—"} />
        <StatCard label="Última hora" value={stats?.by_hour.at(-1)?.count ?? 0} />
      </div>

      {/* Gráfica por hora */}
      {stats && stats.by_hour.length > 0 && (
        <div className="card-glass p-4">
          <p className="text-sm text-gray-400 mb-3">Detecciones por hora (hoy)</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={stats.by_hour}>
              <XAxis dataKey="hour" tick={{ fill: "#6B7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6 }}
                labelStyle={{ color: "#9CA3AF" }}
                itemStyle={{ color: "#2563EB" }}
              />
              <Bar dataKey="count" fill="#2563EB" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2">
        <select
          value={filters.acknowledged}
          onChange={(e) => setFilters({ acknowledged: e.target.value as "" | "true" | "false" })}
          className="input-field w-auto text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="false">Pendientes</option>
          <option value="true">Reconocidos</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="card-glass overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-gray-500 text-left">
              <th className="px-4 py-3">Snapshot</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Cámara</th>
              <th className="px-4 py-3">Clase</th>
              <th className="px-4 py-3">Confianza</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {events.map((ev) => (
              <tr
                key={ev.id}
                onClick={() => setSelected(ev)}
                className="border-b border-white/5 hover:bg-white/3 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <img
                    src={eventsApi.snapshotUrl(ev.id)}
                    alt="snapshot"
                    className="w-16 h-10 object-cover rounded"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-400">
                  {format(new Date(ev.timestamp), "dd/MM HH:mm:ss")}
                </td>
                <td className="px-4 py-3">{ev.camera_name}</td>
                <td className="px-4 py-3 font-medium capitalize">{ev.detected_class}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-mono",
                    ev.confidence >= 0.8 ? "bg-success/20 text-success" :
                    ev.confidence >= 0.5 ? "bg-warning/20 text-warning" :
                    "bg-danger/20 text-danger"
                  )}>
                    {(ev.confidence * 100).toFixed(0)}%
                  </span>
                </td>
                <td className="px-4 py-3">
                  {ev.acknowledged ? (
                    <span className="text-xs text-gray-500">Reconocido</span>
                  ) : (
                    <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded">Pendiente</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    {!ev.acknowledged && (
                      <button
                        onClick={() => handleAck(ev.id)}
                        className="text-gray-400 hover:text-success transition-colors"
                        title="Reconocer"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    {user?.role === "admin" && (
                      <button
                        onClick={() => handleDelete(ev.id)}
                        className="text-gray-400 hover:text-danger transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No hay eventos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="flex justify-center gap-2">
        <button
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
          className="btn-ghost text-sm disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="px-3 py-2 text-sm text-gray-400">Página {page}</span>
        <button
          disabled={events.length < 20}
          onClick={() => setPage((p) => p + 1)}
          className="btn-ghost text-sm disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>

      {/* Modal detalle */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="card-glass w-full max-w-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold capitalize">{selected.detected_class}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white">✕</button>
            </div>
            <img
              src={eventsApi.snapshotUrl(selected.id)}
              alt="snapshot"
              className="w-full rounded-lg object-contain max-h-80"
            />
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Cámara:</span> {selected.camera_name}</div>
              <div><span className="text-gray-500">Confianza:</span> {(selected.confidence * 100).toFixed(1)}%</div>
              <div><span className="text-gray-500">ROI activo:</span> {selected.roi_active ? "Sí" : "No"}</div>
              <div><span className="text-gray-500">Timestamp:</span> <span className="font-mono text-xs">{format(new Date(selected.timestamp), "dd/MM/yyyy HH:mm:ss")}</span></div>
            </div>
            {!selected.acknowledged && (
              <button
                onClick={() => handleAck(selected.id)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} /> Reconocer evento
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
