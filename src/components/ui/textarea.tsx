import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn("min-h-24 w-full rounded-xl border bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-purple-100", className)}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
