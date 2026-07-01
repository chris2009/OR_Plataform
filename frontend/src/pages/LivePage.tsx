import { useState, useEffect, useRef, useCallback } from "react";
import { Maximize2, WifiOff, Activity } from "lucide-react";
import { camerasApi, type Camera } from "@/api";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cn } from "@/lib/utils";

function CameraCell({ camera, onFullscreen }: { camera: Camera; onFullscreen: () => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastFpsTime = useRef(Date.now());

  const handleFrame = useCallback((data: string) => {
    if (imgRef.current) {
      imgRef.current.src = `data:image/jpeg;base64,${data}`;
      frameCount.current++;
      const now = Date.now();
      if (now - lastFpsTime.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastFpsTime.current = now;
      }
    }
  }, []);

  const { status } = useWebSocket(`/camera/${camera.id}/stream`, handleFrame);

  return (
    <div className="card-glass relative overflow-hidden aspect-video flex items-center justify-center">
      {/* Loading overlay */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            <span className="text-sm">Conectando stream...</span>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {(status === "closed" || status === "error") && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <WifiOff size={32} />
            <span className="text-sm">Stream desconectado</span>
          </div>
        </div>
      )}

      <img
        ref={imgRef}
        alt={camera.name}
        className="w-full h-full object-contain"
      />

      {/* Overlay info */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", status === "open" ? "bg-success animate-pulse-slow" : "bg-danger")} />
          <span className="text-sm font-medium">{camera.name}</span>
          {camera.roi && (
            <span className="text-xs bg-warning/20 text-warning px-1.5 py-0.5 rounded">ROI</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-gray-400">{fps} FPS</span>
          <button
            onClick={onFullscreen}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LivePage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [fullscreenId, setFullscreenId] = useState<number | null>(null);

  useEffect(() => {
    camerasApi.list().then((res) => {
      setCameras(res.data.filter((c) => c.is_active));
    });
  }, []);

  const activeCameras = cameras;

  if (activeCameras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
        <Activity size={48} />
        <div className="text-center">
          <p className="text-lg font-medium">No hay cámaras activas</p>
          <p className="text-sm mt-1">Activa una fuente en la página de Cámaras para ver el stream en vivo.</p>
        </div>
      </div>
    );
  }

  // Mosaico dinámico: número de columnas ~ raíz cuadrada del total de fuentes
  // (1 -> 1x1, 2 -> 1x2, 3-4 -> 2x2, 5-6 -> 2x3, 7-9 -> 3x3, ...)
  const cols = Math.ceil(Math.sqrt(activeCameras.length));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vista en Vivo</h1>
        <span className="text-sm text-gray-500 font-mono">{activeCameras.length} fuente{activeCameras.length === 1 ? "" : "s"} activa{activeCameras.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {activeCameras.map((cam) => (
          <CameraCell
            key={cam.id}
            camera={cam}
            onFullscreen={() => setFullscreenId(cam.id)}
          />
        ))}
      </div>

      {/* Fullscreen modal */}
      {fullscreenId !== null && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center"
          onClick={() => setFullscreenId(null)}
        >
          <div className="w-full max-w-5xl px-4" onClick={(e) => e.stopPropagation()}>
            <CameraCell
              camera={cameras.find((c) => c.id === fullscreenId)!}
              onFullscreen={() => setFullscreenId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
