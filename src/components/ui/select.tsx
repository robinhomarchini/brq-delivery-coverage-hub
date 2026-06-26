import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn("h-10 w-full rounded-xl border bg-white px-3 text-sm focus:ring-2 focus:ring-purple-100", className)}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
