import { cn } from "@/lib/utils/cn";
import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "danger" | "success" | "warning";
}

const variants = {
  default: "bg-zinc-900/80 border-zinc-800",
  danger: "bg-red-950/40 border-red-900/50",
  success: "bg-emerald-950/40 border-emerald-900/50",
  warning: "bg-amber-950/40 border-amber-900/50",
};

export function Card({ children, className, variant = "default" }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 backdrop-blur-sm",
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("text-sm font-semibold uppercase tracking-wide text-zinc-400", className)}>
      {children}
    </h3>
  );
}
