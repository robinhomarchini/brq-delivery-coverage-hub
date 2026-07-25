import { PersonAvatar } from "@/components/shared/avatar";
import { Badge } from "@/components/ui/badge";
import { translateRole } from "@/lib/roles";
import type { Person } from "@/data/mockData";

export interface ExecutiveCardProps {
  person: Person;
  areaName?: string;
  clientCount: number;
  teamCount: number;
}

export function ExecutiveCard({ person, areaName, clientCount, teamCount }: ExecutiveCardProps) {
  return (
    <article className="w-full max-w-[260px] rounded-2xl border-2 border-brq-purple bg-gradient-to-br from-brq-purple to-[#5f2098] p-5 text-white shadow-[0_6px_20px_-14px_rgba(21,23,27,0.55)]">
      <div className="flex items-center gap-4">
        <PersonAvatar name={person.name} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">{person.name}</h3>
          <p className="mt-0.5 text-sm text-white/70">{person.jobTitle}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge className="bg-white/15 text-white">{translateRole(person.roleType)}</Badge>
        {areaName && <Badge variant="secondary" className="bg-white/10 text-white">{areaName}</Badge>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-3 text-sm">
        <div>
          <p className="text-xs text-white/60">Equipe</p>
          <p className="text-lg font-bold">{teamCount}</p>
        </div>
        <div>
          <p className="text-xs text-white/60">Clientes</p>
          <p className="text-lg font-bold">{clientCount}</p>
        </div>
      </div>
    </article>
  );
}
