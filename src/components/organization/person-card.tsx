import type { Person, RoleType } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { PersonAvatar } from "@/components/shared/avatar";
import { cn } from "@/lib/utils";
import { translateRole } from "@/lib/roles";

const roleStyles: Record<RoleType, string> = {
  Executive: "border-brq-purple bg-gradient-to-br from-brq-purple to-[#5f2098] text-white",
  Director: "border-brq-ink bg-brq-ink text-white",
  "Farmer + Delivery": "border-brq-navy bg-brq-navy text-white",
  Delivery: "border-purple-200 bg-purple-50 text-slate-800",
  Hunter: "border-orange-200 bg-orange-50 text-slate-800",
  Farmer: "border-blue-200 bg-blue-50 text-slate-800",
  "Hunter + Farmer": "border-orange-300 bg-gradient-to-br from-orange-50 to-blue-50 text-slate-800",
  Staff: "border-orange-300 bg-orange-50 text-slate-800",
};

export function PersonCard({
  person,
  areaName,
  clientNames,
  variant = "manager",
}: {
  person: Person;
  areaName?: string;
  clientNames: string[];
  variant?: "executive" | "director" | "manager" | "staff";
}) {
  const dark = ["Executive", "Director", "Farmer + Delivery"].includes(person.roleType);
  const isManager = variant === "manager";
  return (
    <article className={cn(
      "rounded-xl border p-4 shadow-[0_6px_20px_-14px_rgba(21,23,27,0.55)] transition-transform hover:-translate-y-0.5",
      roleStyles[person.roleType],
      variant === "executive" && "w-[260px] border-2 p-5",
      variant === "director" && "w-[230px]",
      variant === "staff" && "w-[230px]",
      isManager && "w-[190px] p-3",
    )}>
      <div className="flex items-start gap-3">
        <PersonAvatar name={person.name} className={cn("h-11 w-11", isManager && "h-9 w-9 text-xs")} />
        <div className="min-w-0 flex-1">
          <h3 className={cn("truncate font-bold", isManager && "text-sm")}>{person.name}</h3>
          <p className={cn("mt-0.5 text-xs", dark ? "text-white/65" : "text-slate-500")}>{person.jobTitle}</p>
        </div>
      </div>
      <Badge className={cn("mt-3", isManager && "mt-2 px-2 py-0.5 text-[10px]", dark && "bg-white/15 text-white")}>{translateRole(person.roleType)}</Badge>
      {isManager ? (
        <div className={cn("mt-2 border-t pt-2 text-[11px]", dark ? "border-white/15 text-white/70" : "border-slate-200 text-slate-500")}>
          <p className="truncate font-medium">{areaName ?? "Área não definida"}</p>
          <p className="mt-1 font-semibold">{clientNames.length} cliente(s)</p>
        </div>
      ) : (
        <dl className={cn("mt-4 space-y-2 border-t pt-3 text-xs", dark ? "border-white/15" : "border-slate-200")}>
          <Info label="Área" value={areaName ?? "Não definida"} muted={dark} />
          <Info label="Clientes" value={clientNames.join(", ") || "Sem clientes"} muted={dark} />
        </dl>
      )}
    </article>
  );
}

function Info({ label, value, muted }: { label: string; value: string; muted: boolean }) {
  return (
    <div>
      <dt className={cn("font-semibold", muted ? "text-white/55" : "text-slate-400")}>{label}</dt>
      <dd className="mt-0.5 line-clamp-2">{value}</dd>
    </div>
  );
}
