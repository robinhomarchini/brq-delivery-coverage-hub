import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";

export function FilterBar({
  search,
  onSearchChange,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-6">
      <label className="relative md:col-span-2">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar..." className="pl-9" />
      </label>
      {children}
    </div>
  );
}

