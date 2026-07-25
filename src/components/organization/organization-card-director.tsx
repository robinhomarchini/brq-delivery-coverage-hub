import { PersonAvatar } from "@/components/shared/avatar";
import { Badge } from "@/components/ui/badge";
import { translateRole } from "@/lib/roles";
import type { Person } from "@/data/mockData";

export interface DirectorCardProps {
  person: Person;
  areaName?: string;
  teamCount: number;
}

export function DirectorCard({ person, areaName, teamCount }: DirectorCardProps) {
  return (
    <article className="w-full max-w-[220px] rounded-xl border border-brq-ink bg-brq-ink p-4 text-white shadow-[0_6px_20px_-14px_rgba(21,23,27,0.55)]">
      <div className="flex items-center gap-3">
        <PersonAvatar name={person.name} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold">{person.name}</h3>
          <p className="mt-0.5 text-xs text-white/70">{person.jobTitle}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge className="bg-white/15 text-white">{translateRole(person.roleType)}</Badge>
        {areaName && <Badge variant="secondary" className="bg-white/10 text-white">{areaName}</Badge>}
      </div>
      <div className="mt-3 border-t border-white/20 pt-2 text-xs text-white/70">
        <span className="font-semibold text-white">{teamCount}</span> pessoa(s) na equipe
      </div>
    </article>
  );
}
