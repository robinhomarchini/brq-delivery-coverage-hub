import { TableCell } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";

export type StackedComparisonTone = "default" | "purple" | "delta";

export interface StackedComparisonLine {
  value?: string | number;
  tone?: StackedComparisonTone;
  bold?: boolean;
  currency?: boolean;
}

interface StackedComparisonCellProps {
  lines: StackedComparisonLine[];
  align?: "left" | "right";
  className?: string;
}

const stackedLineHeightClassName = "h-10";

export function StackedComparisonCell({
  lines,
  align = "left",
  className,
}: StackedComparisonCellProps) {
  return (
    <TableCell className={cn("align-middle", align === "right" && "text-right tabular-nums", className)}>
      <div className="grid gap-2">
        {lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              stackedLineHeightClassName,
              "flex items-center whitespace-nowrap rounded-md px-2",
              align === "right" ? "justify-end" : "justify-start",
              index === 0 && "bg-transparent px-0",
              line.tone === "purple" && "bg-purple-50 text-brq-purple",
              line.tone === "default" && "bg-slate-50 text-slate-900",
              line.bold ? "font-black" : "font-bold",
              line.tone === "delta" && getDeltaTextClassName(Number(line.value ?? 0)),
              line.tone === "delta" && "bg-slate-50",
              !line.tone && "text-slate-900",
            )}
          >
            {formatStackedValue(line)}
          </div>
        ))}
      </div>
    </TableCell>
  );
}

function formatStackedValue(line: StackedComparisonLine) {
  if (line.value === undefined) {
    return <span className={line.tone === "purple" ? "text-purple-200" : "text-slate-300"}>-</span>;
  }
  if (line.currency && typeof line.value === "number") return formatCurrency(line.value);
  return line.value;
}

function getDeltaTextClassName(value: number) {
  if (value > 0.01) return "text-emerald-700";
  if (value < -0.01) return "text-red-700";
  return "text-sky-700";
}
