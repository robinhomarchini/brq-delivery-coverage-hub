import type { ElementType } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatCompactCurrency, formatCurrency } from "@/lib/utils";

type KpiTone = "neutral" | "purple" | "blue" | "sky" | "dark" | "ok" | "warning" | "danger";

const toneClasses: Record<KpiTone, { card: string; icon: string }> = {
  neutral: { card: "border-slate-200 bg-white", icon: "bg-slate-100 text-slate-700" },
  purple: { card: "border-purple-100 bg-white", icon: "bg-purple-50 text-brq-purple" },
  blue: { card: "border-sky-100 bg-white", icon: "bg-sky-50 text-sky-700" },
  sky: { card: "border-cyan-100 bg-white", icon: "bg-cyan-50 text-cyan-700" },
  dark: { card: "border-slate-200 bg-white", icon: "bg-slate-950 text-white" },
  ok: { card: "border-emerald-200 bg-emerald-50/70", icon: "bg-emerald-600 text-white" },
  warning: { card: "border-amber-200 bg-amber-50/70", icon: "bg-amber-600 text-white" },
  danger: { card: "border-red-200 bg-red-50/70", icon: "bg-red-600 text-white" },
};

type KpiSummaryCardProps = {
  label: string;
  value?: string | number;
  currencyValue?: number;
  fullValue?: string;
  icon?: ElementType;
  tone?: KpiTone;
  className?: string;
};

export function KpiSummaryCard({
  label,
  value,
  currencyValue,
  fullValue,
  icon: Icon,
  tone = "neutral",
  className,
}: KpiSummaryCardProps) {
  const displayValue = currencyValue === undefined ? String(value ?? "") : formatCompactCurrency(currencyValue);
  const accessibleValue = fullValue ?? (currencyValue === undefined ? displayValue : formatCurrency(currencyValue));
  const classes = toneClasses[tone];
  const valueClassName = currencyValue === undefined
    ? "text-2xl sm:text-[1.65rem]"
    : "text-[1.35rem] sm:text-[1.45rem]";

  return (
    <Card className={cn("min-w-0 overflow-hidden shadow-sm", classes.card, className)}>
      <CardContent className="grid min-w-0 gap-3 p-4">
        {Icon && (
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", classes.icon)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <p
            className="min-h-7 overflow-hidden text-[11px] font-semibold uppercase leading-[1.25] tracking-normal text-slate-400"
            title={label}
          >
            {label}
          </p>
          <p
            className={cn("mt-1.5 min-w-0 max-w-full whitespace-nowrap font-black leading-none tracking-normal text-slate-950 tabular-nums", valueClassName)}
            title={accessibleValue}
            aria-label={`${label}: ${accessibleValue}`}
          >
            {displayValue}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
