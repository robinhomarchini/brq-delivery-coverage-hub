import { PersonAvatar } from "@/components/shared/avatar";
import { Badge } from "@/components/ui/badge";
import { translateRole } from "@/lib/roles";
import type { Person } from "@/data/mockData";

export interface ICCardProps {
  person: Person;
  areaName?: string;
  clientCount: number;
}

export function ICCard({ person, areaName, clientCount }: ICCardProps) {
  return (
    <article className="w-[170px] rounded-lg border border-slate-200 bg-white p-3 text-slate-800 shadow-[0_6px_20px_-14px_rgba(21,23,27,0.55)]">
      <div className="flex items-center gap-3">
        <PersonAvatar name={person.name} className="h-8 w-8 text-xs" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{person.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{person.jobTitle}</p>
        </div>
      </div>
      <div className="mt-2">
        <Badge variant="secondary" className="bg-slate-100 text-slate-600">{translateRole(person.roleType)}</Badge>
      </div>
      <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
        <p className="truncate">{areaName ?? "Área não definida"}</p>
        <p className="mt-1 font-medium">{clientCount} cliente(s)</p>
      </div>
    </article>
  );
}
