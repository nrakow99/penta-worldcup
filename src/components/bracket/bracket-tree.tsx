"use client";

import { cn } from "@/lib/utils/cn";
import type { BracketPick, Match, Team } from "@/lib/types/database";
import { ROUND_LABELS, type BracketRound } from "@/lib/types/database";
import { resolveMatchTeams } from "@/lib/bracket/bracket-utils";
import { Check, X } from "lucide-react";

interface BracketTreeProps {
  matches: Match[];
  picks: BracketPick[];
  teams: Team[];
  isLocked: boolean;
  isReadOnly: boolean;
  onPick?: (matchId: string, teamId: string, round: BracketRound) => void;
  showResults?: boolean;
}

export function BracketTree({
  matches,
  picks,
  teams,
  isLocked,
  isReadOnly,
  onPick,
  showResults = false,
}: BracketTreeProps) {
  const teamMap = new Map(teams.map((t) => [t.id, t]));
  const picksByMatch = new Map(picks.map((p) => [p.match_id, p]));

  const rounds: BracketRound[] = ["r32", "r16", "qf", "sf", "final"];

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4">
        {rounds.map((round) => {
          const roundMatches = matches
            .filter((m) => m.round === round)
            .sort((a, b) => a.match_number - b.match_number);

          return (
            <div key={round} className="flex flex-col gap-2">
              <h4 className="sticky top-0 z-10 bg-zinc-950/90 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {ROUND_LABELS[round]}
              </h4>
              <div
                className="flex flex-1 flex-col justify-around gap-3"
                style={{
                  minHeight: round === "r32" ? 800 : round === "r16" ? 400 : undefined,
                }}
              >
                {roundMatches.map((match) => {
                  const { teamA, teamB, labelA, labelB } = resolveMatchTeams(
                    match,
                    picks,
                    matches,
                    teamMap
                  );
                  const pick = picksByMatch.get(match.id);
                  const hasResult = match.winner_team_id !== null;
                  const isCorrect =
                    showResults &&
                    !!pick?.picked_team_id &&
                    pick.picked_team_id === match.winner_team_id;
                  const isWrong =
                    showResults &&
                    !!pick?.picked_team_id &&
                    pick.picked_team_id !== match.winner_team_id;

                  return (
                    <div
                      key={match.id}
                      className="w-44 rounded-lg border border-zinc-800 bg-zinc-900/80 overflow-hidden"
                    >
                      <TeamSlot
                        label={labelA}
                        team={teamA}
                        isPicked={pick?.picked_team_id === teamA?.id}
                        isWinner={match.winner_team_id === teamA?.id}
                        isCorrect={isCorrect && pick?.picked_team_id === teamA?.id}
                        isWrong={isWrong && pick?.picked_team_id === teamA?.id}
                        disabled={isReadOnly || isLocked || !teamA}
                        onClick={() =>
                          teamA && onPick?.(match.id, teamA.id, match.round)
                        }
                      />
                      <div className="border-t border-zinc-800" />
                      <TeamSlot
                        label={labelB}
                        team={teamB}
                        isPicked={pick?.picked_team_id === teamB?.id}
                        isWinner={match.winner_team_id === teamB?.id}
                        isCorrect={isCorrect && pick?.picked_team_id === teamB?.id}
                        isWrong={isWrong && pick?.picked_team_id === teamB?.id}
                        disabled={isReadOnly || isLocked || !teamB}
                        onClick={() =>
                          teamB && onPick?.(match.id, teamB.id, match.round)
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Champion column */}
        <div className="flex flex-col">
          <h4 className="sticky top-0 z-10 bg-zinc-950/90 py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Champion
          </h4>
          <div className="flex flex-1 items-center">
            <ChampionSlot
              matches={matches}
              picks={picks}
              teams={teamMap}
              showResults={showResults}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSlot({
  label,
  team,
  isPicked,
  isWinner,
  isCorrect,
  isWrong,
  disabled,
  onClick,
}: {
  label: string;
  team: Team | null;
  isPicked: boolean;
  isWinner: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors",
        isPicked && "bg-emerald-600/30 font-medium text-emerald-300",
        isWinner && showWinnerStyles && "bg-yellow-500/20 text-yellow-300",
        isCorrect && "ring-1 ring-emerald-500",
        isWrong && "ring-1 ring-red-500 opacity-60",
        !disabled && !isPicked && "hover:bg-zinc-800 cursor-pointer",
        disabled && "cursor-default opacity-70"
      )}
    >
      <span className="flex-1 truncate">{label}</span>
      {isCorrect && <Check className="h-3 w-3 text-emerald-400" />}
      {isWrong && <X className="h-3 w-3 text-red-400" />}
    </button>
  );
}

const showWinnerStyles = true;

function ChampionSlot({
  matches,
  picks,
  teams,
  showResults,
}: {
  matches: Match[];
  picks: BracketPick[];
  teams: Map<string, Team>;
  showResults: boolean;
}) {
  const finalMatch = matches.find((m) => m.round === "final");
  const championPick = picks.find((p) => p.round === "champion");
  const finalPick = finalMatch
    ? picks.find((p) => p.match_id === finalMatch.id)
    : null;

  const championTeamId =
    championPick?.picked_team_id ?? finalPick?.picked_team_id;
  const championTeam = championTeamId ? teams.get(championTeamId) : null;

  const isCorrect =
    showResults &&
    finalMatch?.winner_team_id &&
    championTeamId === finalMatch.winner_team_id;

  return (
    <div
      className={cn(
        "w-44 rounded-lg border-2 border-dashed p-4 text-center",
        isCorrect
          ? "border-yellow-500 bg-yellow-500/10"
          : "border-zinc-700 bg-zinc-900/50"
      )}
    >
      {championTeam ? (
        <div>
          <span className="text-2xl">{championTeam.flag_emoji ?? "🏆"}</span>
          <p className="mt-1 text-sm font-bold text-zinc-100">
            {championTeam.name}
          </p>
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Pick your champion</p>
      )}
    </div>
  );
}
