import { Inbox } from "lucide-react";

export function EmptyState({ message = "Nenhum resultado encontrado." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-slate-400">
      <Inbox className="h-9 w-9" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

