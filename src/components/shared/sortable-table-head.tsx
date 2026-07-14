import { TableHead } from "@/components/ui/table";

export type SortDirection = "asc" | "desc";
export type SortState<TKey extends string> = {
  key: TKey;
  direction: SortDirection;
} | null;

export function SortableTableHead<TKey extends string>({
  label,
  sortKey,
  sortState,
  onSort,
  className,
}: {
  label: string;
  sortKey: TKey;
  sortState: SortState<TKey>;
  onSort: React.Dispatch<React.SetStateAction<SortState<TKey>>>;
  className?: string;
}) {
  const active = sortState?.key === sortKey;
  const direction = active ? sortState.direction : undefined;

  return (
    <TableHead className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-sm text-left font-semibold text-slate-700 transition hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
        onClick={() => onSort((current) => ({
          key: sortKey,
          direction: current?.key === sortKey && current.direction === "asc" ? "desc" : "asc",
        }))}
        aria-label={`Ordenar por ${label}${active ? `, ${direction === "asc" ? "crescente" : "decrescente"}` : ""}`}
      >
        {label}
        <span className="text-xs text-slate-400" aria-hidden="true">{active ? direction === "asc" ? "↑" : "↓" : "↕"}</span>
      </button>
    </TableHead>
  );
}
