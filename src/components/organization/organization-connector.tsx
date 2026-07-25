import { cn } from "@/lib/utils";

interface ConnectorProps {
  type: "horizontal" | "vertical" | "corner";
  className?: string;
}

export function Connector({ type, className }: ConnectorProps) {
  if (type === "horizontal") {
    return <div className={cn("h-0 border-t border-purple-300", className)} />;
  }

  if (type === "vertical") {
    return <div className={cn("w-0 border-l border-purple-300", className)} />;
  }

  return (
    <div className={cn("relative", className)}>
      <div className="absolute left-0 top-0 h-9 border-l border-purple-300" />
      <div className="absolute left-0 top-1/2 w-9 border-t-2 border-purple-300" />
    </div>
  );
}
