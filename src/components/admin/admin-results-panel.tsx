"use client";

import { useTransition } from "react";
import { recordMatchResult, clearMatchResult } from "@/lib/actions/league-actions";
import { getDownstreamMatchNumbers } from "@/lib/bracket/bracket-utils";
import type { Match, Team } from "@/lib/types/database";
import { Check, RotateCcw } from "lucide-react";

interface AdminResultsPanelProps {
  leagueId: string;
  matches: Match[];
  teams: Team[];
}

const ROUNDS = [
  {
    label: "Round of 32",
    nums: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
  },
  { label: "Round of 16", nums: [17, 18, 19, 20, 21, 22, 23, 24] },
  { label: "Quarterfinals", nums: [25, 26, 27, 28] },
  { label: "Semifinals", nums: [29, 30] },
  { label: "Final", nums: [31] },
] as const;

export function AdminResultsPanel({
  leagueId,
  matches,
  teams,
}: AdminResultsPanelProps) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const byNumber = new Map(matches.map((m) => [m.match_number, m]));

  return (
    <div className="space-y-6">
      {ROUNDS.map(({ label, nums }) => (
        <RoundSection
          key={label}
          label={label}
          matchNums={[...nums]}
          byNumber={byNumber}
          teamMap={teamMap}
          leagueId={leagueId}
          allMatches={matches}
        />
      ))}
    </div>
  );
}

// ─── Round section ────────────────────────────────────────────────────────────

function RoundSection({
  label,
  matchNums,
  byNumber,
  teamMap,
  leagueId,
  allMatches,
}: {
  label: string;
  matchNums: number[];
  byNumber: Map<number, Match>;
  teamMap: Map<string, Team>;
  leagueId: string;
  allMatches: Match[];
}) {
  const roundMatches = matchNums
    .map((n) => byNumber.get(n))
    .filter((m): m is Match => !!m);

  const decided = roundMatches.filter((m) => m.winner_team_id).length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {label}
        </h3>
        {decided > 0 && (
          <span className="text-xs text-zinc-600">
            {decided}/{roundMatches.length} recorded
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {roundMatches.map((match) => (
          <MatchResultRow
            key={match.id}
            match={match}
            teamMap={teamMap}
            leagueId={leagueId}
            allMatches={allMatches}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Match result row ─────────────────────────────────────────────────────────

function MatchResultRow({
  match,
  teamMap,
  leagueId,
  allMatches,
}: {
  match: Match;
  teamMap: Map<string, Team>;
  leagueId: string;
  allMatches: Match[];
}) {
  const [isPending, startTransition] = useTransition();

  const teamA = match.team_a_id ? teamMap.get(match.team_a_id) : null;
  const teamB = match.team_b_id ? teamMap.get(match.team_b_id) : null;
  const winner = match.winner_team_id ? teamMap.get(match.winner_team_id) : null;

  const hasTeams = !!(teamA || teamB);

  // Determine if there are downstream matches that already have winners.
  // Used to decide whether to show a confirmation dialog on reset/change.
  const downstreamHasWinner = hasDownstreamWinners(match.match_number, allMatches);

  const labelA = teamA
    ? `${teamA.flag_emoji ?? ""} ${teamA.name}`.trim()
    : match.team_a_placeholder ?? "TBD";
  const labelB = teamB
    ? `${teamB.flag_emoji ?? ""} ${teamB.name}`.trim()
    : match.team_b_placeholder ?? "TBD";

  const handleSelect = (teamId: string, teamLabel: string) => {
    if (isPending) return;

    // Clicking the already-selected winner = same as reset
    if (teamId === match.winner_team_id) {
      handleReset();
      return;
    }

    // Changing an existing winner: warn if downstream results exist
    if (match.winner_team_id && downstreamHasWinner) {
      if (
        !confirm(
          `Change winner to ${teamLabel}?\n\nThis will clear downstream results that depend on the current winner. Continue?`
        )
      )
        return;
    }

    startTransition(() => void recordMatchResult(leagueId, match.id, teamId));
  };

  const handleReset = () => {
    if (isPending) return;

    if (downstreamHasWinner) {
      if (
        !confirm(
          `Reset this result?\n\nThis will also clear downstream results that depend on this winner. Continue?`
        )
      )
        return;
    }

    startTransition(() => void clearMatchResult(leagueId, match.id));
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        winner
          ? "border-amber-800/40 bg-amber-950/20"
          : "border-zinc-800 bg-zinc-900/40"
      } ${isPending ? "opacity-60" : ""}`}
    >
      {/* Match number + winner state */}
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-600">
          Match {match.match_number}
        </span>
        {winner && (
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-xs font-medium text-amber-400">
              <Check className="h-3 w-3" />
              {winner.flag_emoji} {winner.name}
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleReset}
              title="Reset result"
              className="ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Team buttons */}
      {!hasTeams ? (
        <p className="text-xs text-zinc-600 italic">
          Teams determined from earlier round results.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <TeamButton
            label={labelA}
            teamId={match.team_a_id}
            isWinner={match.winner_team_id === match.team_a_id}
            disabled={isPending || !teamA}
            onClick={() => teamA && handleSelect(teamA.id, labelA)}
          />
          <span className="text-xs text-zinc-600">vs</span>
          <TeamButton
            label={labelB}
            teamId={match.team_b_id}
            isWinner={match.winner_team_id === match.team_b_id}
            disabled={isPending || !teamB}
            onClick={() => teamB && handleSelect(teamB.id, labelB)}
          />
        </div>
      )}
    </div>
  );
}

// ─── Team button ──────────────────────────────────────────────────────────────

function TeamButton({
  label,
  teamId: _teamId,
  isWinner,
  disabled,
  onClick,
}: {
  label: string;
  teamId: string | null;
  isWinner: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors ${
        isWinner
          ? "border-amber-600 bg-amber-500/20 text-amber-300 ring-1 ring-amber-600"
          : disabled
            ? "cursor-default border-zinc-800 bg-zinc-800/30 text-zinc-600"
            : "border-zinc-700 bg-zinc-800/40 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-700 cursor-pointer"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if any match downstream of `matchNumber` already has a winner set.
 * Used to decide whether to show a confirmation before reset/change.
 */
function hasDownstreamWinners(matchNumber: number, allMatches: Match[]): boolean {
  const downstreamNums = getDownstreamMatchNumbers(matchNumber);
  const byNumber = new Map(allMatches.map((m) => [m.match_number, m]));
  for (const num of downstreamNums) {
    const m = byNumber.get(num);
    if (m?.winner_team_id) return true;
  }
  return false;
}
