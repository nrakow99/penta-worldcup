import { cn } from "@/lib/utils/cn";
import type { GroupMatchStatus } from "@/lib/types/database";

const config: Record<GroupMatchStatus, { label: string; className: string }> = {
  upcoming: {
    label: "Upcoming",
    className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  },
  live: {
    label: "Live",
    className: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse",
  },
  final: {
    label: "Final",
    className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
};

export function MatchStatusBadge({ status }: { status: GroupMatchStatus }) {
  const c = config[status];
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium",
        c.className
      )}
    >
      {c.label}
    </span>
  );
}
