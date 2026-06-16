"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  updateLeagueSettings,
  setPunishment,
  recordMatchResult,
  upsertTeam,
  updateMatchTeams,
  resetBracketData,
} from "@/lib/actions/league-actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { League, Match, Punishment, Team } from "@/lib/types/database";
import { ROUND_LABELS } from "@/lib/types/database";
import { getTeamDisplay } from "@/lib/bracket/bracket-utils";

interface AdminPanelProps {
  league: League;
  punishment: Punishment | null;
  matches: Match[];
  teams: Team[];
}

export function AdminPanel({
  league,
  punishment,
  matches,
  teams,
}: AdminPanelProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Group Stage & Knockout</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <Link href={`/league/${league.id}/groups`}>
            <Button size="sm" variant="secondary">
              Manage Group Stage
            </Button>
          </Link>
          <Link href={`/league/${league.id}/admin/knockout-setup`}>
            <Button size="sm" variant="secondary">
              Knockout Setup
            </Button>
          </Link>
        </div>
      </Card>
      <LeagueSettingsForm league={league} isPending={isPending} startTransition={startTransition} />
      <PunishmentForm
        leagueId={league.id}
        punishment={punishment}
        isPending={isPending}
        startTransition={startTransition}
      />
      <TeamManager
        leagueId={league.id}
        teams={teams}
        isPending={isPending}
        startTransition={startTransition}
      />
      <MatchSetup
        leagueId={league.id}
        matches={matches.filter((m) => m.round === "r32")}
        teams={teams}
        isPending={isPending}
        startTransition={startTransition}
      />
      <ResultsEntry
        leagueId={league.id}
        matches={matches}
        teams={teams}
        isPending={isPending}
        startTransition={startTransition}
      />
      <Card variant="danger">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <Button
          variant="danger"
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (confirm("Reset all bracket data? This cannot be undone.")) {
              startTransition(() => {
                void resetBracketData(league.id);
              });
            }
          }}
        >
          Reset All Bracket Data
        </Button>
      </Card>
    </div>
  );
}

function LeagueSettingsForm({
  league,
  isPending,
  startTransition,
}: {
  league: League;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>League Settings</CardTitle>
      </CardHeader>
      <form
        className="space-y-3"
        action={(formData) => {
          startTransition(() => {
            void updateLeagueSettings(league.id, {
              name: formData.get("name") as string,
              lockDeadline: (formData.get("lockDeadline") as string) || null,
              isManuallyLocked: formData.get("isManuallyLocked") === "on",
            });
          });
        }}
      >
        <div>
          <label className="mb-1 block text-xs text-zinc-400">League Name</label>
          <Input name="name" defaultValue={league.name} required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">
            Bracket Lock Deadline
          </label>
          <Input
            name="lockDeadline"
            type="datetime-local"
            defaultValue={
              league.lock_deadline
                ? new Date(league.lock_deadline).toISOString().slice(0, 16)
                : ""
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="isManuallyLocked"
            defaultChecked={league.is_manually_locked}
            className="rounded border-zinc-600"
          />
          Manually lock brackets now
        </label>
        <div className="text-xs text-zinc-500">
          Invite code: <code className="text-emerald-400">{league.invite_code}</code>
        </div>
        <Button type="submit" size="sm" disabled={isPending}>
          Save Settings
        </Button>
      </form>
    </Card>
  );
}

function PunishmentForm({
  leagueId,
  punishment,
  isPending,
  startTransition,
}: {
  leagueId: string;
  punishment: Punishment | null;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Set Punishment</CardTitle>
      </CardHeader>
      <form
        className="space-y-3"
        action={(formData) => {
          startTransition(() => {
            void setPunishment(leagueId, formData.get("description") as string);
          });
        }}
      >
        <Textarea
          name="description"
          defaultValue={punishment?.description ?? ""}
          placeholder="e.g. Loser has to cook dinner for a week"
          rows={3}
          required
        />
        <Button type="submit" size="sm" disabled={isPending}>
          Save Punishment
        </Button>
      </form>
    </Card>
  );
}

function TeamManager({
  leagueId,
  teams,
  isPending,
  startTransition,
}: {
  leagueId: string;
  teams: Team[];
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [name, setName] = useState("");
  const [flagEmoji, setFlagEmoji] = useState("");
  const [isPlaceholder, setIsPlaceholder] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
      </CardHeader>
      <div className="mb-4 max-h-48 space-y-1 overflow-y-auto">
        {teams.map((team) => (
          <div
            key={team.id}
            className="flex items-center gap-2 rounded bg-zinc-800/50 px-2 py-1 text-sm"
          >
            <span>{team.flag_emoji}</span>
            <span>{team.name}</span>
            {team.is_placeholder && (
              <span className="text-xs text-zinc-500">(placeholder)</span>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Team name or placeholder"
        />
        <Input
          value={flagEmoji}
          onChange={(e) => setFlagEmoji(e.target.value)}
          placeholder="Flag emoji (optional)"
        />
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={isPlaceholder}
            onChange={(e) => setIsPlaceholder(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Placeholder team
        </label>
        <Button
          size="sm"
          disabled={isPending || !name}
          onClick={() => {
            startTransition(async () => {
              await upsertTeam(leagueId, {
                name,
                flagEmoji: flagEmoji || undefined,
                isPlaceholder,
                placeholderLabel: isPlaceholder ? name : undefined,
              });
              setName("");
              setFlagEmoji("");
            });
          }}
        >
          Add Team
        </Button>
      </div>
    </Card>
  );
}

function MatchSetup({
  leagueId,
  matches,
  teams,
  isPending,
  startTransition,
}: {
  leagueId: string;
  matches: Match[];
  teams: Team[];
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Round of 32 Matchups</CardTitle>
      </CardHeader>
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {matches.map((match) => (
          <div
            key={match.id}
            className="rounded-lg border border-zinc-800 p-3"
          >
            <p className="mb-2 text-xs text-zinc-500">
              Match {match.match_number}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <TeamSelect
                teams={teams}
                defaultValue={match.team_a_id ?? ""}
                placeholder={match.team_a_placeholder ?? "Team A"}
                onSave={(teamId, placeholder) => {
                  startTransition(() => {
                    void updateMatchTeams(match.id, leagueId, {
                      teamAId: teamId || null,
                      teamAPlaceholder: placeholder,
                    });
                  });
                }}
              />
              <TeamSelect
                teams={teams}
                defaultValue={match.team_b_id ?? ""}
                placeholder={match.team_b_placeholder ?? "Team B"}
                onSave={(teamId, placeholder) => {
                  startTransition(() => {
                    void updateMatchTeams(match.id, leagueId, {
                      teamBId: teamId || null,
                      teamBPlaceholder: placeholder,
                    });
                  });
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TeamSelect({
  teams,
  defaultValue,
  placeholder,
  onSave,
}: {
  teams: Team[];
  defaultValue: string;
  placeholder: string;
  onSave: (teamId: string, placeholderText: string) => void;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const [placeholderText, setPlaceholderText] = useState(placeholder);

  return (
    <div className="space-y-1">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
      >
        <option value="">Placeholder</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.flag_emoji} {t.name}
          </option>
        ))}
      </select>
      {!selected && (
        <Input
          value={placeholderText}
          onChange={(e) => setPlaceholderText(e.target.value)}
          className="text-xs"
          placeholder="e.g. Winner Group A"
        />
      )}
      <Button
        size="sm"
        variant="ghost"
        className="w-full text-xs"
        onClick={() => onSave(selected, placeholderText)}
      >
        Save
      </Button>
    </div>
  );
}

function ResultsEntry({
  leagueId,
  matches,
  teams,
  isPending,
  startTransition,
}: {
  leagueId: string;
  matches: Match[];
  teams: Team[];
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const decidedMatches = matches.filter((m) => m.round !== "champion");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Enter Match Results</CardTitle>
      </CardHeader>
      <div className="max-h-96 space-y-3 overflow-y-auto">
        {decidedMatches.map((match) => (
          <ResultForm
            key={match.id}
            leagueId={leagueId}
            match={match}
            teams={teams}
            teamMap={teamMap}
            isPending={isPending}
            startTransition={startTransition}
          />
        ))}
      </div>
    </Card>
  );
}

function ResultForm({
  leagueId,
  match,
  teams,
  teamMap,
  isPending,
  startTransition,
}: {
  leagueId: string;
  match: Match;
  teams: Team[];
  teamMap: Map<string, Team>;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [winnerId, setWinnerId] = useState(match.winner_team_id ?? "");
  const [scoreA, setScoreA] = useState(match.team_a_score ?? 0);
  const [scoreB, setScoreB] = useState(match.team_b_score ?? 0);

  const labelA = getTeamDisplay(
    match.team_a_id ? teamMap.get(match.team_a_id) : null,
    match.team_a_placeholder
  );
  const labelB = getTeamDisplay(
    match.team_b_id ? teamMap.get(match.team_b_id) : null,
    match.team_b_placeholder
  );

  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <p className="mb-2 text-xs font-medium text-zinc-400">
        {ROUND_LABELS[match.round]} — Match {match.match_number}
      </p>
      <p className="mb-2 text-sm text-zinc-300">
        {labelA} vs {labelB}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <select
          value={winnerId}
          onChange={(e) => setWinnerId(e.target.value)}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
        >
          <option value="">Select winner</option>
          {match.team_a_id && (
            <option value={match.team_a_id}>{labelA}</option>
          )}
          {match.team_b_id && (
            <option value={match.team_b_id}>{labelB}</option>
          )}
        </select>
        <Input
          type="number"
          min={0}
          value={scoreA}
          onChange={(e) => setScoreA(Number(e.target.value))}
          className="w-16 text-xs"
          placeholder="A"
        />
        <span className="text-zinc-500">-</span>
        <Input
          type="number"
          min={0}
          value={scoreB}
          onChange={(e) => setScoreB(Number(e.target.value))}
          className="w-16 text-xs"
          placeholder="B"
        />
        <Button
          size="sm"
          disabled={isPending || !winnerId}
          onClick={() => {
            startTransition(() => {
              void recordMatchResult(leagueId, match.id, winnerId, scoreA, scoreB);
            });
          }}
        >
          Save
        </Button>
      </div>
      {match.winner_team_id && (
        <p className="mt-1 text-xs text-emerald-400">✓ Result recorded</p>
      )}
    </div>
  );
}
