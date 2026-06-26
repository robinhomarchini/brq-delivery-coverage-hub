import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div>
        {eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-brq-purple">{eyebrow}</p>}
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {actions && <div className="flex flex-wrap gap-2" data-no-print="true">{actions}</div>}
    </div>
  );
}
