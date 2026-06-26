import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full min-w-[760px] caption-bottom text-sm", className)} {...props} />;
}
export function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="border-b bg-slate-50/80" {...props} />;
}
export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className="[&_tr:last-child]:border-0" {...props} />;
}
export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b transition-colors hover:bg-slate-50/70", className)} {...props} />;
}
export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-500", className)} {...props} />;
}
export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-middle", className)} {...props} />;
}

