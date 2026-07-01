import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CheckCircle, Trash2, Layers, Tag, Camera as CameraIcon, Clock, type LucideIcon } from "lucide-react";
import { eventsApi, camerasApi, type Event, type EventStats, type Camera, type GroupedCount } from "@/api";
import { useAuthStore } from "@/store/authStore";
import { cn, colorForClass } from "@/lib/utils";

const OTHER_COLOR = "#6B7280";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
}) {
  return (
    <div className="card-glass p-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-0.5" style={{ backgroundColor: color }} />
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs text-gray-500">{label}</p>
        <Icon size={15} style={{ color }} />
      </div>
      <p className="text-2xl font-semibold font-mono capitalize truncate" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function parseDayLocal(dayStr: string): Date {
  const [y, m, d] = dayStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function buildChartData(rows: GroupedCount[], topClasses: string[], groupBy: "day" | "source") {
  return rows.map((r) => {
    const entry: Record<string, string | number> = {
      group: groupBy === "day" ? format(parseDayLocal(r.group), "dd/MM") : r.group,
    };
    let otras = 0;
    for (const [cls, cnt] of Object.entries(r.counts)) {
      if (topClasses.includes(cls)) entry[cls] = cnt;
      else otras += cnt;
    }
    if (otras > 0) entry.otras = otras;
    return entry;
  });
}

export default function EventsPage() {
  const { user } = useAuthStore();
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Event | null>(null);
  const [groupBy, setGroupBy] = useState<"day" | "source">("day");
  const [filters, setFilters] = useState({
    acknowledged: "" as "" | "true" | "false",
    camera_id: "",
    detected_class: "",
  });

  const load = useCallback(async () => {
    const params: Record<string, unknown> = { page, page_size: 20 };
    if (filters.acknowledged !== "") params.acknowledged = filters.acknowledged === "true";
    if (filters.camera_id !== "") params.camera_id = Number(filters.camera_id);
    if (filters.detected_class !== "") params.detected_class = filters.detected_class;
    const [evRes, stRes] = await Promise.all([
      eventsApi.list(params),
      eventsApi.stats(),
    ]);
    setEvents(evRes.data);
    setStats(stRes.data);
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { camerasApi.list().then((r) => setCameras(r.data)); }, []);

  const updateFilter = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

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

  const topClass = stats ? Object.entries(stats.by_class).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
  const topCamera = stats ? Object.entries(stats.by_camera).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;

  const chartRows = groupBy === "day" ? stats?.by_day ?? [] : stats?.by_source ?? [];

  const topClasses = useMemo(() => {
    const totals: Record<string, number> = {};
    chartRows.forEach((r) => {
      Object.entries(r.counts).forEach(([cls, cnt]) => {
        totals[cls] = (totals[cls] ?? 0) + cnt;
      });
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([c]) => c);
  }, [chartRows]);

  const chartData = useMemo(
    () => buildChartData(chartRows, topClasses, groupBy),
    [chartRows, topClasses, groupBy]
  );
  const hasOtras = chartData.some((d) => "otras" in d);
  const seriesKeys = hasOtras ? [...topClasses, "otras"] : topClasses;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Eventos de Detección</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total hoy" value={stats?.total_today ?? 0} icon={Layers} color="#2563EB" />
        <StatCard
          label="Top clase (hoy)"
          value={topClass ?? "—"}
          icon={Tag}
          color={topClass ? colorForClass(topClass) : "#6B7280"}
        />
        <StatCard label="Top cámara (hoy)" value={topCamera ?? "—"} icon={CameraIcon} color="#F59E0B" />
        <StatCard label="Última hora" value={stats?.by_hour.at(-1)?.count ?? 0} icon={Clock} color="#10B981" />
      </div>

      {/* Gráfica agrupada por día/fuente, coloreada por clase */}
      <div className="card-glass p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-400">
            Detecciones {groupBy === "day" ? "por día" : "por fuente"} (últimos 7 días)
          </p>
          <div className="flex gap-1 text-xs bg-white/5 rounded-md p-0.5">
            <button
              onClick={() => setGroupBy("day")}
              className={cn(
                "px-2.5 py-1 rounded transition-colors",
                groupBy === "day" ? "bg-accent text-white" : "text-gray-400 hover:text-white"
              )}
            >
              Por día
            </button>
            <button
              onClick={() => setGroupBy("source")}
              className={cn(
                "px-2.5 py-1 rounded transition-colors",
                groupBy === "source" ? "bg-accent text-white" : "text-gray-400 hover:text-white"
              )}
            >
              Por fuente
            </button>
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <XAxis dataKey="group" tick={{ fill: "#6B7280", fontSize: 11 }} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6 }}
                labelStyle={{ color: "#9CA3AF" }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {seriesKeys.map((key, i) => (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  stackId="a"
                  fill={key === "otras" ? OTHER_COLOR : colorForClass(key)}
                  radius={i === seriesKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-sm text-gray-500 py-16">Sin eventos en los últimos 7 días</p>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filters.acknowledged}
          onChange={(e) => updateFilter({ acknowledged: e.target.value as "" | "true" | "false" })}
          className="input-field w-auto text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="false">Pendientes</option>
          <option value="true">Reconocidos</option>
        </select>
        <select
          value={filters.camera_id}
          onChange={(e) => updateFilter({ camera_id: e.target.value })}
          className="input-field w-auto text-sm"
        >
          <option value="">Todas las fuentes</option>
          {cameras.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          value={filters.detected_class}
          onChange={(e) => updateFilter({ detected_class: e.target.value })}
          className="input-field w-auto text-sm capitalize"
        >
          <option value="">Todas las clases</option>
          {(stats?.all_classes ?? []).map((c) => (
            <option key={c} value={c} className="capitalize">{c}</option>
          ))}
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
                <td className="px-4 py-3 font-medium capitalize">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: colorForClass(ev.detected_class) }}
                    />
                    {ev.detected_class}
                  </span>
                </td>
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
              <h2 className="text-lg font-semibold capitalize flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: colorForClass(selected.detected_class) }}
                />
                {selected.detected_class}
              </h2>
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
