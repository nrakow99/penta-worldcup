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
import { ROUND_LABELS, type BracketRound } from "@/lib/types/database";
import { getTeamDisplay } from "@/lib/bracket/bracket-utils";

interface AdminPanelProps {
  league: League;
  punishment: Punishment | null;
  matches: Match[];
  teams: Team[];
  submittedCount?: number;
  memberCount?: number;
}

const RESULT_ROUNDS: BracketRound[] = ["r32", "r16", "qf", "sf", "final"];

export function AdminPanel({
  league,
  punishment,
  matches,
  teams,
  submittedCount = 0,
  memberCount = 0,
}: AdminPanelProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <Link href={`/league/${league.id}/groups`}>
            <Button size="sm" variant="secondary">Group Stage</Button>
          </Link>
          <Link href={`/league/${league.id}/admin/knockout-setup`}>
            <Button size="sm" variant="secondary">Knockout Setup</Button>
          </Link>
          <Link href={`/league/${league.id}/admin/tournament-update`}>
            <Button size="sm" variant="secondary">Tournament Update</Button>
          </Link>
        </div>
        {memberCount > 0 && (
          <p className="mt-3 text-xs text-zinc-500">
            {submittedCount} of {memberCount} brackets submitted
          </p>
        )}
      </Card>

      <LeagueSettingsForm league={league} isPending={isPending} startTransition={startTransition} />
      <PunishmentForm leagueId={league.id} punishment={punishment} isPending={isPending} startTransition={startTransition} />
      <TeamManager leagueId={league.id} teams={teams} isPending={isPending} startTransition={startTransition} />
      <MatchSetup leagueId={league.id} matches={matches.filter((m) => m.round === "r32")} teams={teams} startTransition={startTransition} />
      <ResultsEntry leagueId={league.id} matches={matches} teams={teams} isPending={isPending} startTransition={startTransition} />

      <Card variant="danger">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <p className="mb-3 text-xs text-zinc-500">
          Deletes all bracket picks, results, and match scores. Cannot be undone.
        </p>
        <Button
          variant="danger"
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (confirm("Reset ALL bracket data? This permanently deletes every player's picks and all recorded results.")) {
              startTransition(() => { void resetBracketData(league.id); });
            }
          }}
        >
          Reset All Bracket Data
        </Button>
      </Card>
    </div>
  );
}

// ─── League Settings ──────────────────────────────────────────────────────────

function LeagueSettingsForm({
  league,
  isPending,
  startTransition,
}: {
  league: League;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>League Settings</CardTitle>
      </CardHeader>
      <form
        className="space-y-3"
        action={(formData) => {
          startTransition(async () => {
            await updateLeagueSettings(league.id, {
              name: formData.get("name") as string,
              lockDeadline: (formData.get("lockDeadline") as string) || null,
              isManuallyLocked: formData.get("isManuallyLocked") === "on",
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          });
        }}
      >
        <div>
          <label className="mb-1 block text-xs text-zinc-400">League Name</label>
          <Input name="name" defaultValue={league.name} required />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">
            Bracket Lock Deadline (your local time)
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
          <p className="mt-1 text-xs text-zinc-600">
            Tip: set this to tournament kick-off time so brackets lock automatically.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            name="isManuallyLocked"
            defaultChecked={league.is_manually_locked}
            className="rounded border-zinc-600"
          />
          Lock brackets now (override deadline)
        </label>
        <div className="text-xs text-zinc-500">
          Invite code: <code className="select-all text-emerald-400">{league.invite_code}</code>
          <span className="ml-2 text-zinc-600">(share this with players)</span>
        </div>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>Save Settings</Button>
          {saved && <span className="text-xs text-emerald-400">✓ Saved</span>}
        </div>
      </form>
    </Card>
  );
}

// ─── Punishment ───────────────────────────────────────────────────────────────

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
  const [saved, setSaved] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Punishment</CardTitle>
      </CardHeader>
      <form
        className="space-y-3"
        action={(formData) => {
          startTransition(async () => {
            await setPunishment(leagueId, formData.get("description") as string);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
          });
        }}
      >
        <Textarea
          name="description"
          defaultValue={punishment?.description ?? ""}
          placeholder="e.g. Loser buys dinner for the group"
          rows={2}
          required
        />
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>Save Punishment</Button>
          {saved && <span className="text-xs text-emerald-400">✓ Saved</span>}
        </div>
      </form>
    </Card>
  );
}

// ─── Team Manager ─────────────────────────────────────────────────────────────

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
  const [saved, setSaved] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams ({teams.length})</CardTitle>
      </CardHeader>
      {teams.length > 0 && (
        <div className="mb-4 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 p-2">
          {teams.filter((t) => !t.is_placeholder).map((team) => (
            <div key={team.id} className="flex items-center gap-2 px-1 py-0.5 text-sm">
              <span>{team.flag_emoji ?? "🏴"}</span>
              <span className="text-zinc-200">{team.name}</span>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={flagEmoji}
            onChange={(e) => setFlagEmoji(e.target.value)}
            placeholder="🏴 Flag"
            className="w-20"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) e.currentTarget.form?.requestSubmit();
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            disabled={isPending || !name.trim()}
            onClick={() => {
              startTransition(async () => {
                await upsertTeam(leagueId, { name: name.trim(), flagEmoji: flagEmoji || undefined });
                setName("");
                setFlagEmoji("");
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
              });
            }}
          >
            Add Team
          </Button>
          {saved && <span className="text-xs text-emerald-400">✓ Added</span>}
        </div>
      </div>
    </Card>
  );
}

// ─── R32 Match Setup ──────────────────────────────────────────────────────────

function MatchSetup({
  leagueId,
  matches,
  teams,
  startTransition,
}: {
  leagueId: string;
  matches: Match[];
  teams: Team[];
  startTransition: (fn: () => void) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Round of 32 Matchups</CardTitle>
      </CardHeader>
      <p className="mb-3 text-xs text-zinc-500">
        Select teams for each slot. Changes save when you click Save.
      </p>
      <div className="max-h-[480px] space-y-3 overflow-y-auto">
        {matches.map((match) => (
          <div key={match.id} className="rounded-lg border border-zinc-800 p-3">
            <p className="mb-2 text-xs text-zinc-500">Match {match.match_number}</p>
            <div className="grid grid-cols-2 gap-2">
              <TeamSelect
                teams={teams}
                defaultValue={match.team_a_id ?? ""}
                placeholder={match.team_a_placeholder ?? "Team A"}
                label="Team A"
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
                label="Team B"
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
  label,
  onSave,
}: {
  teams: Team[];
  defaultValue: string;
  placeholder: string;
  label: string;
  onSave: (teamId: string, placeholderText: string) => void;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const [placeholderText, setPlaceholderText] = useState(placeholder);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(selected, placeholderText);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-1">
      <p className="text-xs text-zinc-600">{label}</p>
      <select
        value={selected}
        onChange={(e) => { setSelected(e.target.value); setSaved(false); }}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
      >
        <option value="">Use placeholder</option>
        {teams.filter((t) => !t.is_placeholder).map((t) => (
          <option key={t.id} value={t.id}>
            {t.flag_emoji} {t.name}
          </option>
        ))}
      </select>
      {!selected && (
        <Input
          value={placeholderText}
          onChange={(e) => { setPlaceholderText(e.target.value); setSaved(false); }}
          className="text-xs"
          placeholder="e.g. Winner Group A"
        />
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" className="flex-1 text-xs" onClick={handleSave}>
          {saved ? "✓ Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ─── Results Entry ────────────────────────────────────────────────────────────

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
  const [activeRound, setActiveRound] = useState<BracketRound>("r32");
  const teamMap = new Map(teams.map((t) => [t.id, t]));

  const roundMatches = matches
    .filter((m) => m.round === activeRound)
    .sort((a, b) => a.match_number - b.match_number);

  const recordedCount = matches.filter((m) => m.winner_team_id && m.round !== "champion").length;
  const totalDecidable = matches.filter((m) => m.round !== "champion").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-baseline justify-between">
          <CardTitle>Enter Match Results</CardTitle>
          <span className="text-xs text-zinc-500">{recordedCount}/{totalDecidable} recorded</span>
        </div>
      </CardHeader>

      {/* Round tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {RESULT_ROUNDS.map((round) => {
          const roundDone = matches
            .filter((m) => m.round === round)
            .every((m) => m.winner_team_id);
          return (
            <button
              key={round}
              onClick={() => setActiveRound(round)}
              className={`whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeRound === round
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {ROUND_LABELS[round]}
              {roundDone && <span className="ml-1 text-emerald-500">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {roundMatches.length === 0 ? (
          <p className="text-sm text-zinc-500">No matches in this round yet.</p>
        ) : (
          roundMatches.map((match) => (
            <ResultForm
              key={match.id}
              leagueId={leagueId}
              match={match}
              teamMap={teamMap}
              isPending={isPending}
              startTransition={startTransition}
            />
          ))
        )}
      </div>
    </Card>
  );
}

function ResultForm({
  leagueId,
  match,
  teamMap,
  isPending,
  startTransition,
}: {
  leagueId: string;
  match: Match;
  teamMap: Map<string, Team>;
  isPending: boolean;
  startTransition: (fn: () => void) => void;
}) {
  const [winnerId, setWinnerId] = useState(match.winner_team_id ?? "");
  const [scoreA, setScoreA] = useState(match.team_a_score ?? 0);
  const [scoreB, setScoreB] = useState(match.team_b_score ?? 0);
  const [saved, setSaved] = useState(!!match.winner_team_id);

  const labelA = getTeamDisplay(
    match.team_a_id ? teamMap.get(match.team_a_id) : null,
    match.team_a_placeholder
  );
  const labelB = getTeamDisplay(
    match.team_b_id ? teamMap.get(match.team_b_id) : null,
    match.team_b_placeholder
  );

  const canSave = !!winnerId && (match.team_a_id || match.team_b_id);

  return (
    <div className={`rounded-lg border p-3 ${saved ? "border-emerald-800/50 bg-emerald-950/20" : "border-zinc-800"}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-400">
          Match {match.match_number} — {labelA} vs {labelB}
        </p>
        {saved && <span className="text-xs text-emerald-500">✓ Recorded</span>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <select
          value={winnerId}
          onChange={(e) => { setWinnerId(e.target.value); setSaved(false); }}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
        >
          <option value="">Select winner</option>
          {match.team_a_id && <option value={match.team_a_id}>{labelA}</option>}
          {match.team_b_id && <option value={match.team_b_id}>{labelB}</option>}
        </select>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            value={scoreA}
            onChange={(e) => { setScoreA(Number(e.target.value)); setSaved(false); }}
            className="w-14 text-center text-xs"
          />
          <span className="text-zinc-600">–</span>
          <Input
            type="number"
            min={0}
            value={scoreB}
            onChange={(e) => { setScoreB(Number(e.target.value)); setSaved(false); }}
            className="w-14 text-center text-xs"
          />
        </div>
        <Button
          size="sm"
          disabled={isPending || !canSave}
          onClick={() => {
            startTransition(async () => {
              await recordMatchResult(leagueId, match.id, winnerId, scoreA, scoreB);
              setSaved(true);
            });
          }}
        >
          {saved ? "Update" : "Save Result"}
        </Button>
      </div>
    </div>
  );
}
