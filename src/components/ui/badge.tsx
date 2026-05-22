import { cn } from "@/lib/utils/cn";
import type { LeagueStatus } from "@/lib/types/database";

const statusConfig: Record<
  LeagueStatus,
  { label: string; className: string }
> = {
  open: { label: "Open", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  locked: { label: "Locked", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  in_progress: { label: "In Progress", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  finished: { label: "Finished", className: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

export function Badge({
  status,
  className,
}: {
  status: LeagueStatus;
  className?: string;
}) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  const colors =
    rank === 1
      ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      : rank === 2
        ? "bg-zinc-400/20 text-zinc-300 border-zinc-400/30"
        : rank === 3
          ? "bg-orange-600/20 text-orange-400 border-orange-600/30"
          : "bg-zinc-700/50 text-zinc-400 border-zinc-600/30";

  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold",
        colors
      )}
    >
      {rank}
    </span>
  );
}
