import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { FixtureList } from "@/components/groups/fixture-card";
import {
  BRACKET_STATUS_COLORS,
  BRACKET_STATUS_LABELS,
  getBracketAvailability,
} from "@/lib/tournament/bracket-status";
import type { GroupMatch, League, Match } from "@/lib/types/database";
import { cn } from "@/lib/utils/cn";
import { Calendar, Grid3X3, Trophy } from "lucide-react";

export function BracketStatusCard({ league }: { league: League }) {
  const status = getBracketAvailability(league);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-emerald-500" />
          Bracket Status
        </CardTitle>
      </CardHeader>
      <span
        className={cn(
          "inline-flex rounded-full border px-3 py-1 text-sm font-medium",
          BRACKET_STATUS_COLORS[status]
        )}
      >
        {BRACKET_STATUS_LABELS[status]}
      </span>
      {status === "waiting_for_matchups" && (
        <p className="mt-2 text-xs text-zinc-500">
          Admin must confirm Round of 32 matchups before brackets open.
        </p>
      )}
    </Card>
  );
}

export function GroupStageTrackerCard({
  leagueId,
  groupCount,
  matchCount,
}: {
  leagueId: string;
  groupCount: number;
  matchCount: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid3X3 className="h-4 w-4 text-emerald-500" />
          Group Stage Tracker
        </CardTitle>
      </CardHeader>
      <p className="text-sm text-zinc-400">
        {groupCount} groups · {matchCount} matches tracked
      </p>
      <Link
        href={`/league/${leagueId}/groups`}
        className="mt-3 inline-block text-sm text-emerald-400 hover:underline"
      >
        View group stage →
      </Link>
    </Card>
  );
}

export function UpcomingFixturesCard({
  leagueId,
  fixtures,
}: {
  leagueId: string;
  fixtures: GroupMatch[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-500" />
          Upcoming Fixtures
        </CardTitle>
      </CardHeader>
      <FixtureList
        matches={fixtures.slice(0, 3)}
        emptyMessage="No upcoming fixtures."
      />
      {fixtures.length > 0 && (
        <Link
          href={`/league/${leagueId}/groups`}
          className="mt-3 inline-block text-sm text-emerald-400 hover:underline"
        >
          All fixtures →
        </Link>
      )}
    </Card>
  );
}

export function R32MatchupsCard({ matches }: { matches: Match[] }) {
  const confirmed = matches.filter((m) => m.team_a_id && m.team_b_id).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Round of 32 Matchups</CardTitle>
      </CardHeader>
      <p className="text-sm text-zinc-400">
        {confirmed} of {matches.length} slots confirmed
      </p>
      <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {matches.slice(0, 6).map((m) => (
          <p key={m.id} className="text-xs text-zinc-500">
            M{m.match_number}:{" "}
            {m.team_a?.name ?? m.team_a_placeholder ?? "TBD"} vs{" "}
            {m.team_b?.name ?? m.team_b_placeholder ?? "TBD"}
          </p>
        ))}
      </div>
    </Card>
  );
}
