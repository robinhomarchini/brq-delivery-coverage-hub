import { PersonAvatar } from "@/components/shared/avatar";
import { Badge } from "@/components/ui/badge";
import { translateRole } from "@/lib/roles";
import type { Person } from "@/data/mockData";

export interface ManagerCardProps {
  person: Person;
  areaName?: string;
  clientCount: number;
}

export function ManagerCard({ person, areaName, clientCount }: ManagerCardProps) {
  return (
    <article className="w-full max-w-[180px] rounded-lg border border-purple-200 bg-purple-50 p-3 text-slate-800 shadow-[0_6px_20px_-14px_rgba(21,23,27,0.55)]">
      <div className="flex items-center gap-3">
        <PersonAvatar name={person.name} className="h-9 w-9 text-xs" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{person.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{person.jobTitle}</p>
        </div>
      </div>
      <div className="mt-2">
        <Badge className="bg-purple-100 text-slate-700">{translateRole(person.roleType)}</Badge>
      </div>
      <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
        <p className="truncate font-medium">{areaName ?? "Área não definida"}</p>
        <p className="mt-1 font-semibold text-slate-700">{clientCount} cliente(s)</p>
      </div>
    </article>
  );
}
