"use client";

import { cn } from "@/lib/utils/cn";
import type { BracketPick, Match, Team } from "@/lib/types/database";
import { resolveMatchTeams } from "@/lib/bracket/bracket-utils";
import { Check, X, Trophy } from "lucide-react";

// ─── Layout constants ─────────────────────────────────────────────────────────
// These drive the bracket geometry.  Changing MATCH_H / MATCH_GAP requires
// updating BRACKET_H too so all columns stay aligned.
const MATCH_H = 72; // px — height of one match card (header + 2 team rows)
const MATCH_GAP = 8; // px — gap between consecutive R32 cards
const R32_PER_SIDE = 8;
// Total height of one bracket half = all 8 R32 cards + 7 gaps
const BRACKET_H = R32_PER_SIDE * MATCH_H + (R32_PER_SIDE - 1) * MATCH_GAP;

// Match numbers on each side / round
const LEFT_R32 = [1, 2, 3, 4, 5, 6, 7, 8];
const LEFT_R16 = [17, 18, 19, 20];
const LEFT_QF = [25, 26];
const LEFT_SF = [29];
const RIGHT_SF = [30];
const RIGHT_QF = [27, 28];
const RIGHT_R16 = [21, 22, 23, 24];
const RIGHT_R32 = [9, 10, 11, 12, 13, 14, 15, 16];

// ─── Types ───────────────────────────────────────────────────────────────────

export type BracketRound = "r32" | "r16" | "qf" | "sf" | "final" | "champion";

interface BracketTreeProps {
  matches: Match[];
  picks: BracketPick[];
  teams: Team[];
  isLocked: boolean;
  isReadOnly: boolean;
  onPick?: (matchId: string, teamId: string, round: BracketRound) => void;
  showResults?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const byNumber = new Map(matches.map((m) => [m.match_number, m]));

  const get = (nums: number[]) =>
    nums.map((n) => byNumber.get(n)).filter((m): m is Match => !!m);

  const finalMatch = byNumber.get(31);

  // ── Shared props passed to every MatchCard ──────────────────────────────
  const cardProps = {
    picks,
    teamMap,
    allMatches: matches,
    isReadOnly,
    isLocked,
    onPick,
    showResults,
  };

  return (
    <div className="overflow-x-auto pb-6">
      {/* Desktop: classic two-sided bracket */}
      <div className="hidden sm:inline-flex items-center gap-0" style={{ height: BRACKET_H }}>
        {/* ── LEFT HALF (columns go: R32 → R16 → QF → SF → center) ────────── */}
        <HalfBracket
          columns={[
            { nums: LEFT_R32, label: "R32", isR32: true },
            { nums: LEFT_R16, label: "R16" },
            { nums: LEFT_QF, label: "QF" },
            { nums: LEFT_SF, label: "SF" },
          ]}
          side="left"
          get={get}
          cardProps={cardProps}
        />

        {/* ── CENTER: Final + Champion ──────────────────────────────────────── */}
        <CenterColumn
          finalMatch={finalMatch ?? null}
          picks={picks}
          teamMap={teamMap}
          allMatches={matches}
          showResults={showResults}
          isReadOnly={isReadOnly}
          isLocked={isLocked}
          onPick={onPick}
        />

        {/* ── RIGHT HALF (columns go: SF → QF → R16 → R32, mirrored) ──────── */}
        <HalfBracket
          columns={[
            { nums: RIGHT_SF, label: "SF" },
            { nums: RIGHT_QF, label: "QF" },
            { nums: RIGHT_R16, label: "R16" },
            { nums: RIGHT_R32, label: "R32", isR32: true },
          ]}
          side="right"
          get={get}
          cardProps={cardProps}
        />
      </div>

      {/* Mobile: stacked rounds, simpler layout */}
      <div className="sm:hidden space-y-6">
        {[
          { label: "Round of 32", nums: [...LEFT_R32, ...RIGHT_R32] },
          { label: "Round of 16", nums: [...LEFT_R16, ...RIGHT_R16] },
          { label: "Quarterfinals", nums: [...LEFT_QF, ...RIGHT_QF] },
          { label: "Semifinals", nums: [...LEFT_SF, ...RIGHT_SF] },
          { label: "Final", nums: [31] },
        ].map(({ label, nums }) => (
          <div key={label}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
              {label}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {get(nums).map((match) => (
                <MatchCard key={match.id} match={match} {...cardProps} />
              ))}
            </div>
          </div>
        ))}
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Champion
          </h4>
          <ChampionCard
            picks={picks}
            teamMap={teamMap}
            finalMatch={finalMatch ?? null}
            showResults={showResults}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Half bracket ─────────────────────────────────────────────────────────────

interface ColumnDef {
  nums: number[];
  label: string;
  isR32?: boolean;
}

interface SharedCardProps {
  picks: BracketPick[];
  teamMap: Map<string, Team>;
  allMatches: Match[];
  isReadOnly: boolean;
  isLocked: boolean;
  onPick?: (matchId: string, teamId: string, round: BracketRound) => void;
  showResults: boolean;
}

function HalfBracket({
  columns,
  side,
  get,
  cardProps,
}: {
  columns: ColumnDef[];
  side: "left" | "right";
  get: (nums: number[]) => Match[];
  cardProps: SharedCardProps;
}) {
  return (
    <div className={cn("flex items-stretch gap-0", side === "right" && "")}>
      {columns.map(({ nums, label, isR32 }) => (
        <div key={nums.join(",")} className="flex flex-col items-stretch">
          {/* Round label */}
          <div
            className={cn(
              "px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-600",
              "border-b border-zinc-800/40"
            )}
          >
            {label}
          </div>

          {/* Match column */}
          <div
            className={cn(
              "flex flex-1 flex-col",
              isR32 ? "gap-2" : "justify-around"
            )}
            style={{ height: BRACKET_H }}
          >
            {get(nums).map((match) => (
              <div key={match.id} className="flex items-center">
                {/* Connector line: right side of match (left half) or left side (right half) */}
                {!isR32 && side === "left" && (
                  <div className="w-3 shrink-0 border-t border-zinc-700/50" />
                )}
                {!isR32 && side === "right" && (
                  <div className="w-3 shrink-0 border-t border-zinc-700/50" />
                )}
                <MatchCard match={match} {...cardProps} />
                {isR32 && side === "left" && (
                  <div className="w-3 shrink-0 border-t border-zinc-700/50" />
                )}
                {isR32 && side === "right" && (
                  <div className="w-3 shrink-0 border-t border-zinc-700/50" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Center: Final + Champion ────────────────────────────────────────────────

function CenterColumn({
  finalMatch,
  picks,
  teamMap,
  allMatches,
  showResults,
  isReadOnly,
  isLocked,
  onPick,
}: {
  finalMatch: Match | null;
  picks: BracketPick[];
  teamMap: Map<string, Team>;
  allMatches: Match[];
  showResults: boolean;
  isReadOnly: boolean;
  isLocked: boolean;
  onPick?: (matchId: string, teamId: string, round: BracketRound) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4" style={{ height: BRACKET_H }}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
        Final
      </div>
      {finalMatch && (
        <MatchCard
          match={finalMatch}
          picks={picks}
          teamMap={teamMap}
          allMatches={allMatches}
          isReadOnly={isReadOnly}
          isLocked={isLocked}
          onPick={onPick}
          showResults={showResults}
        />
      )}
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
        Champion
      </div>
      <ChampionCard
        picks={picks}
        teamMap={teamMap}
        finalMatch={finalMatch}
        showResults={showResults}
      />
    </div>
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({
  match,
  picks,
  teamMap,
  allMatches,
  isReadOnly,
  isLocked,
  onPick,
  showResults,
}: {
  match: Match;
} & SharedCardProps) {
  const { teamA, teamB, labelA, labelB } = resolveMatchTeams(
    match,
    picks,
    allMatches,
    teamMap
  );

  const picksByMatch = new Map(picks.map((p) => [p.match_id, p]));
  const pick = picksByMatch.get(match.id);

  const pickedId = pick?.picked_team_id;

  const isCorrectA =
    showResults &&
    !!pick?.picked_team_id &&
    pick.picked_team_id === teamA?.id &&
    teamA?.id === match.winner_team_id;
  const isCorrectB =
    showResults &&
    !!pick?.picked_team_id &&
    pick.picked_team_id === teamB?.id &&
    teamB?.id === match.winner_team_id;
  const isWrongA =
    showResults &&
    !!pick?.picked_team_id &&
    pick.picked_team_id === teamA?.id &&
    match.winner_team_id !== null &&
    teamA?.id !== match.winner_team_id;
  const isWrongB =
    showResults &&
    !!pick?.picked_team_id &&
    pick.picked_team_id === teamB?.id &&
    match.winner_team_id !== null &&
    teamB?.id !== match.winner_team_id;

  const canClickA = !isReadOnly && !isLocked && !!teamA;
  const canClickB = !isReadOnly && !isLocked && !!teamB;

  return (
    <div
      className="w-36 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/80 shadow-sm"
      style={{ height: MATCH_H }}
    >
      <div className="border-b border-zinc-800/60 px-2 py-0.5">
        <span className="text-[9px] font-medium text-zinc-600">
          M{match.match_number}
        </span>
      </div>
      <TeamSlot
        label={labelA}
        isPicked={pickedId === teamA?.id}
        isActualWinner={match.winner_team_id === teamA?.id}
        isCorrect={isCorrectA}
        isWrong={isWrongA}
        canClick={canClickA}
        onClick={() => teamA && onPick?.(match.id, teamA.id, match.round)}
      />
      <div className="border-t border-zinc-800/60" />
      <TeamSlot
        label={labelB}
        isPicked={pickedId === teamB?.id}
        isActualWinner={match.winner_team_id === teamB?.id}
        isCorrect={isCorrectB}
        isWrong={isWrongB}
        canClick={canClickB}
        onClick={() => teamB && onPick?.(match.id, teamB.id, match.round)}
      />
    </div>
  );
}

// ─── Team slot ────────────────────────────────────────────────────────────────

function TeamSlot({
  label,
  isPicked,
  isActualWinner,
  isCorrect,
  isWrong,
  canClick,
  onClick,
}: {
  label: string;
  isPicked: boolean;
  isActualWinner: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  canClick: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!canClick}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs transition-colors",
        // Prediction pick highlighting
        isPicked && !isActualWinner && "bg-emerald-600/25 font-medium text-emerald-300",
        // Actual winner (admin results mode)
        isActualWinner && "bg-amber-500/20 font-semibold text-amber-300",
        // Scoring feedback
        isCorrect && "bg-emerald-600/30 ring-1 ring-emerald-500",
        isWrong && "opacity-50 line-through",
        // Interactive states
        canClick && !isPicked && "hover:bg-zinc-700/60 cursor-pointer",
        !canClick && "cursor-default"
      )}
    >
      <span className="flex-1 truncate leading-tight">{label}</span>
      {isCorrect && <Check className="h-3 w-3 shrink-0 text-emerald-400" />}
      {isWrong && <X className="h-3 w-3 shrink-0 text-red-500" />}
    </button>
  );
}

// ─── Champion card ────────────────────────────────────────────────────────────

function ChampionCard({
  picks,
  teamMap,
  finalMatch,
  showResults,
}: {
  picks: BracketPick[];
  teamMap: Map<string, Team>;
  finalMatch: Match | null;
  showResults: boolean;
}) {
  // Champion = the team picked / won in the final
  const finalPick = finalMatch
    ? picks.find((p) => p.match_id === finalMatch.id)
    : null;
  const champPick = picks.find((p) => p.round === "champion");

  const championId =
    showResults && finalMatch?.winner_team_id
      ? finalMatch.winner_team_id
      : champPick?.picked_team_id ?? finalPick?.picked_team_id;

  const champion = championId ? teamMap.get(championId) : null;

  const isCorrect =
    showResults &&
    finalMatch?.winner_team_id &&
    championId === finalMatch.winner_team_id;

  return (
    <div
      className={cn(
        "flex w-36 flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-4 text-center transition-colors",
        isCorrect
          ? "border-amber-500 bg-amber-500/10"
          : champion
            ? "border-emerald-700 bg-emerald-900/20"
            : "border-zinc-700 bg-zinc-900/40"
      )}
    >
      {champion ? (
        <>
          <span className="text-2xl leading-none">{champion.flag_emoji ?? "🏆"}</span>
          <p className="mt-1.5 text-xs font-bold text-zinc-100">{champion.name}</p>
          {isCorrect && (
            <p className="mt-1 text-[10px] text-amber-400">Correct! +10pts</p>
          )}
        </>
      ) : (
        <>
          <Trophy className="h-6 w-6 text-zinc-600" />
          <p className="mt-1.5 text-xs text-zinc-500">Pick your champion</p>
        </>
      )}
    </div>
  );
}
