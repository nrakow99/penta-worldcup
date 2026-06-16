"use client";

import { useState, useTransition } from "react";
import {
  initializeGroups,
  upsertGroupMatch,
  markGroupMatchFinal,
  seedSampleGroupStage,
} from "@/lib/actions/group-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { GroupMatch, GroupTeam, WcGroup } from "@/lib/types/database";

interface GroupStageAdminProps {
  leagueId: string;
  groups: WcGroup[];
  groupTeams: GroupTeam[];
  matches: GroupMatch[];
  teams: { id: string; name: string; flag_emoji: string | null }[];
}

export function GroupStageAdmin({
  leagueId,
  groups,
  matches,
  teams,
}: GroupStageAdminProps) {
  const [isPending, startTransition] = useTransition();
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [matchDate, setMatchDate] = useState("");

  return (
    <Card className="border-emerald-900/30">
      <CardHeader>
        <CardTitle className="text-emerald-400">Admin: Group Stage</CardTitle>
      </CardHeader>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              startTransition(() => void initializeGroups(leagueId))
            }
          >
            Initialize Groups A–H
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              startTransition(() => void seedSampleGroupStage(leagueId))
            }
          >
            Seed Sample Data
          </Button>
        </div>

        <div className="space-y-2 rounded-lg border border-zinc-800 p-3">
          <p className="text-xs font-medium text-zinc-400">Add fixture</p>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
          >
            <option value="">Select group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                Group {g.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            >
              <option value="">Home team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.flag_emoji} {t.name}
                </option>
              ))}
            </select>
            <select
              value={awayId}
              onChange={(e) => setAwayId(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
            >
              <option value="">Away team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.flag_emoji} {t.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            type="datetime-local"
            value={matchDate}
            onChange={(e) => setMatchDate(e.target.value)}
          />
          <Button
            size="sm"
            disabled={isPending || !groupId || !homeId || !awayId}
            onClick={() => {
              startTransition(() =>
                void upsertGroupMatch(leagueId, {
                  groupId,
                  homeTeamId: homeId,
                  awayTeamId: awayId,
                  matchDate: matchDate ? new Date(matchDate).toISOString() : null,
                  status: "upcoming",
                })
              );
            }}
          >
            Add Fixture
          </Button>
        </div>

        {matches.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-400">Enter scores</p>
            {matches.slice(0, 10).map((m) => (
              <MatchScoreForm
                key={m.id}
                match={m}
                leagueId={leagueId}
                isPending={isPending}
                startTransition={startTransition}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function MatchScoreForm({
  match,
  leagueId,
  isPending,
  startTransition,
}: {
  match: GroupMatch;
  leagueId: string;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [hs, setHs] = useState(match.home_score ?? 0);
  const [as, setAs] = useState(match.away_score ?? 0);

  if (match.status === "final") return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded bg-zinc-800/50 px-2 py-1.5 text-xs">
      <span className="text-zinc-400">
        Grp {match.group?.name}: {match.home_team?.name} vs {match.away_team?.name}
      </span>
      <Input
        type="number"
        min={0}
        value={hs}
        onChange={(e) => setHs(Number(e.target.value))}
        className="w-12 text-xs"
      />
      <span>-</span>
      <Input
        type="number"
        min={0}
        value={as}
        onChange={(e) => setAs(Number(e.target.value))}
        className="w-12 text-xs"
      />
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => {
          startTransition(() =>
            void markGroupMatchFinal(leagueId, match.id, hs, as)
          );
        }}
      >
        Final
      </Button>
    </div>
  );
}
