import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      default: "bg-purple-50 text-brq-purple",
      secondary: "bg-slate-100 text-slate-700",
      success: "bg-emerald-50 text-emerald-700",
      warning: "bg-amber-50 text-amber-700",
      destructive: "bg-red-50 text-red-700",
      navy: "bg-brq-navy text-white",
      commercial: "bg-orange-50 text-orange-700",
      farmer: "bg-blue-50 text-blue-700",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
