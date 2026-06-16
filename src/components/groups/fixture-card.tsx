import { Card } from "@/components/ui/card";
import type { GroupMatch } from "@/lib/types/database";
import { formatTeamName } from "@/lib/tournament/standings";
import { MatchStatusBadge } from "./match-status-badge";
import { format } from "date-fns";

export function FixtureCard({ match }: { match: GroupMatch }) {
  const dateStr = match.match_date
    ? format(new Date(match.match_date), "MMM d · h:mm a")
    : "TBD";

  return (
    <Card className="flex items-center justify-between gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-zinc-500">
          Group {match.group?.name} · {dateStr}
        </p>
        <div className="mt-1 flex items-center gap-2 text-sm">
          <span className="truncate font-medium text-zinc-200">
            {formatTeamName(match.home_team)}
          </span>
          {match.status === "final" ? (
            <span className="shrink-0 font-bold tabular-nums text-emerald-400">
              {match.home_score} - {match.away_score}
            </span>
          ) : (
            <span className="shrink-0 text-zinc-600">vs</span>
          )}
          <span className="truncate font-medium text-zinc-200">
            {formatTeamName(match.away_team)}
          </span>
        </div>
      </div>
      <MatchStatusBadge status={match.status} />
    </Card>
  );
}

export function FixtureList({
  matches,
  emptyMessage,
}: {
  matches: GroupMatch[];
  emptyMessage?: string;
}) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        {emptyMessage ?? "No matches scheduled yet."}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {matches.map((m) => (
        <FixtureCard key={m.id} match={m} />
      ))}
    </div>
  );
}
