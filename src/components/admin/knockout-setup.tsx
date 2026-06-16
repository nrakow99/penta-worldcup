"use client";

import { useTransition } from "react";
import { assignR32Team, setR32Ready } from "@/lib/actions/group-actions";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { Match, Team } from "@/lib/types/database";
import { getTeamDisplay } from "@/lib/bracket/bracket-utils";

interface KnockoutSetupProps {
  leagueId: string;
  matches: Match[];
  teams: Team[];
  r32Ready: boolean;
}

export function KnockoutSetup({
  leagueId,
  matches,
  teams,
  r32Ready,
}: KnockoutSetupProps) {
  const [isPending, startTransition] = useTransition();
  const r32 = matches.filter((m) => m.round === "r32").sort((a, b) => a.match_number - b.match_number);

  return (
    <div className="space-y-6">
      <Card variant={r32Ready ? "success" : "warning"}>
        <CardHeader>
          <CardTitle>
            Round of 32 Status: {r32Ready ? "Ready for brackets" : "Not ready"}
          </CardTitle>
        </CardHeader>
        <p className="mb-3 text-sm text-zinc-400">
          Assign teams to each slot. When all matchups are set, mark the Round
          of 32 as ready so players can fill brackets.
        </p>
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => {
            startTransition(() => void setR32Ready(leagueId, !r32Ready));
          }}
        >
          {r32Ready ? "Mark Not Ready" : "Mark Round of 32 Ready"}
        </Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {r32.map((match) => (
          <R32SlotEditor
            key={match.id}
            leagueId={leagueId}
            match={match}
            teams={teams}
            isPending={isPending}
            startTransition={startTransition}
          />
        ))}
      </div>
    </div>
  );
}

function R32SlotEditor({
  leagueId,
  match,
  teams,
  isPending,
  startTransition,
}: {
  leagueId: string;
  match: Match;
  teams: Team[];
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  return (
    <Card className="p-3">
      <p className="mb-2 text-xs text-zinc-500">Match {match.match_number}</p>
      <div className="space-y-2">
        {(["a", "b"] as const).map((slot) => {
          const teamId = slot === "a" ? match.team_a_id : match.team_b_id;
          const placeholder =
            slot === "a" ? match.team_a_placeholder : match.team_b_placeholder;
          const label = getTeamDisplay(
            teamId ? teamMap.get(teamId) : null,
            placeholder
          );

          return (
            <div key={slot} className="flex items-center gap-2">
              <span className="w-24 truncate text-xs text-zinc-400">{label}</span>
              <select
                defaultValue={teamId ?? ""}
                onChange={(e) => {
                  const val = e.target.value || null;
                  startTransition(() =>
                    void assignR32Team(leagueId, match.id, slot, val)
                  );
                }}
                disabled={isPending}
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs"
              >
                <option value="">Placeholder</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.flag_emoji} {t.name}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
