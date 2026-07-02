import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="card-glass w-full max-w-sm p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              danger ? "bg-danger/20 text-danger" : "bg-accent/20 text-accent"
            )}
          >
            <AlertTriangle size={20} />
          </div>
          <h2 className="text-base font-semibold">{title}</h2>
        </div>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="btn-ghost flex-1">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              "flex-1 font-medium px-4 py-2 rounded-md transition-colors",
              danger ? "bg-danger hover:bg-danger/90 text-white" : "btn-primary"
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
