import { AlertTriangle, CheckCircle2 } from "lucide-react";

export function SuccessNotice({ message, floating = false }: { message: string; floating?: boolean }) {
  return (
    <div className={`${floating ? "fixed right-6 top-6 z-[100] max-w-md shadow-xl" : "mb-4"} flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700`}>
      <CheckCircle2 className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

export function ErrorNotice({
  message,
  floating = false,
  onClose,
}: {
  message: string;
  floating?: boolean;
  onClose?: () => void;
}) {
  return (
    <div className={`${floating ? "fixed right-6 top-6 z-[120] max-w-xl shadow-xl" : "mb-4"} flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="rounded-md px-1 text-red-500 hover:bg-red-100 hover:text-red-700" aria-label="Fechar aviso">
          ×
        </button>
      )}
    </div>
  );
}
