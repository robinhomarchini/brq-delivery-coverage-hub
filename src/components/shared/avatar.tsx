import { cn } from "@/lib/utils";

export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-purple-100 to-fuchsia-50 text-sm font-bold text-brq-purple ring-2 ring-white", className)}>
      {initials}
    </div>
  );
}
