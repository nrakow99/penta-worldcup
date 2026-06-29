import {
  BracketRound,
  BracketPick,
  Match,
  Team,
  MATCH_COUNTS,
} from "@/lib/types/database";

// ─── Static bracket structure ────────────────────────────────────────────────
// Each tuple is [slotA_matchNumber, slotB_matchNumber, nextMatchNumber]
// This is the single source of truth for advancement — no DB relationship needed.

const R32_TO_R16: [number, number, number][] = [
  [1, 2, 17], [3, 4, 18], [5, 6, 19], [7, 8, 20],
  [9, 10, 21], [11, 12, 22], [13, 14, 23], [15, 16, 24],
];

const R16_TO_QF: [number, number, number][] = [
  [17, 18, 25], [19, 20, 26], [21, 22, 27], [23, 24, 28],
];

const QF_TO_SF: [number, number, number][] = [
  [25, 26, 29], [27, 28, 30],
];

const SF_TO_FINAL: [number, number, number][] = [
  [29, 30, 31],
];

const ALL_LINKS: [number, number, number][] = [
  ...R32_TO_R16, ...R16_TO_QF, ...QF_TO_SF, ...SF_TO_FINAL,
];

// ─── Public helpers ──────────────────────────────────────────────────────────

export function getMatchNumberForSlot(round: BracketRound, index: number): number {
  const offsets: Record<Exclude<BracketRound, "champion">, number> = {
    r32: 0, r16: 16, qf: 24, sf: 28, final: 30,
  };
  if (round === "champion") return 31;
  return offsets[round as Exclude<BracketRound, "champion">] + index + 1;
}

/** Which match this match feeds into, and which slot. Used for actual result propagation. */
export function getNextMatchLink(
  matchNumber: number
): { nextMatchNumber: number; slot: "a" | "b" } | null {
  for (const [a, b, next] of ALL_LINKS) {
    if (matchNumber === a) return { nextMatchNumber: next, slot: "a" };
    if (matchNumber === b) return { nextMatchNumber: next, slot: "b" };
  }
  return null;
}

/**
 * All match numbers that are downstream of `matchNumber` (exclusive).
 * Computed from the static tables — does NOT rely on next_match_id in the DB.
 */
export function getDownstreamMatchNumbers(matchNumber: number): Set<number> {
  const result = new Set<number>();
  const queue = [matchNumber];
  while (queue.length > 0) {
    const n = queue.shift()!;
    for (const [a, b, next] of ALL_LINKS) {
      if ((a === n || b === n) && !result.has(next)) {
        result.add(next);
        queue.push(next);
      }
    }
  }
  return result;
}

/** Which matches (by number) feed into `targetMatchNumber`, and which slot each occupies. */
function getFeederLinks(
  targetMatchNumber: number
): Array<{ matchNumber: number; slot: "a" | "b" }> {
  const feeders: Array<{ matchNumber: number; slot: "a" | "b" }> = [];
  for (const [a, b, next] of ALL_LINKS) {
    if (next === targetMatchNumber) {
      feeders.push({ matchNumber: a, slot: "a" });
      feeders.push({ matchNumber: b, slot: "b" });
    }
  }
  return feeders;
}

// ─── Match creation ──────────────────────────────────────────────────────────

export function createDefaultMatches(leagueId: string): Omit<Match, "id" | "created_at">[] {
  const matches: Omit<Match, "id" | "created_at">[] = [];
  const rounds: Exclude<BracketRound, "champion">[] = ["r32", "r16", "qf", "sf", "final"];

  for (const round of rounds) {
    const count = MATCH_COUNTS[round];
    for (let i = 0; i < count; i++) {
      const matchNumber = getMatchNumberForSlot(round, i);
      const link = getNextMatchLink(matchNumber);
      matches.push({
        league_id: leagueId,
        round,
        match_number: matchNumber,
        team_a_id: null,
        team_b_id: null,
        team_a_placeholder: round === "r32" ? `Team ${matchNumber * 2 - 1}` : null,
        team_b_placeholder: round === "r32" ? `Team ${matchNumber * 2}` : null,
        winner_team_id: null,
        // Populate next_match info now so DB is consistent (advancement doesn't depend on it,
        // but it's useful metadata)
        next_match_id: null, // filled in second pass during createLeague
        next_match_slot: link ? link.slot : null,
        team_a_score: null,
        team_b_score: null,
        scheduled_at: null,
      });
    }
  }

  return matches;
}

// ─── Team display ─────────────────────────────────────────────────────────────

export function getTeamDisplay(
  team: Team | null | undefined,
  placeholder: string | null
): string {
  if (team) {
    const emoji = team.flag_emoji ? `${team.flag_emoji} ` : "";
    return `${emoji}${team.name}`;
  }
  return placeholder ?? "TBD";
}

// ─── Bracket resolution ───────────────────────────────────────────────────────

/**
 * Resolve which teams appear in a match slot for display.
 *
 * For R32: teams come directly from match.team_a_id / team_b_id.
 * For later rounds: look up which R32/earlier picks flow into this slot
 * using the STATIC match_number tables — does NOT require next_match_id in DB.
 */
export function resolveMatchTeams(
  match: Match,
  picks: BracketPick[],
  allMatches: Match[],
  teams: Map<string, Team>
): { teamA: Team | null; teamB: Team | null; labelA: string; labelB: string } {
  // Start with explicitly assigned teams (set for R32 by admin, and for later
  // rounds by actual result propagation)
  let teamA = match.team_a_id ? (teams.get(match.team_a_id) ?? null) : null;
  let teamB = match.team_b_id ? (teams.get(match.team_b_id) ?? null) : null;

  if (match.round !== "r32") {
    // Build a number→match lookup for O(1) access
    const byNumber = new Map(allMatches.map((m) => [m.match_number, m]));
    const feeders = getFeederLinks(match.match_number);

    for (const { matchNumber, slot } of feeders) {
      const feederMatch = byNumber.get(matchNumber);
      if (!feederMatch) continue;

      // User's pick for the feeder match
      const pick = picks.find((p) => p.match_id === feederMatch.id);
      const pickedTeam = pick?.picked_team_id
        ? (teams.get(pick.picked_team_id) ?? null)
        : null;

      if (slot === "a" && !teamA) teamA = pickedTeam;
      if (slot === "b" && !teamB) teamB = pickedTeam;
    }
  }

  return {
    teamA,
    teamB,
    labelA: getTeamDisplay(teamA, match.team_a_placeholder),
    labelB: getTeamDisplay(teamB, match.team_b_placeholder),
  };
}

// ─── Bracket picking ──────────────────────────────────────────────────────────

export function validateBracketComplete(
  picks: BracketPick[],
  matches: Match[]
): boolean {
  const decidedRounds: BracketRound[] = ["r32", "r16", "qf", "sf", "final"];
  for (const round of decidedRounds) {
    const roundMatches = matches.filter((m) => m.round === round);
    for (const match of roundMatches) {
      const pick = picks.find((p) => p.match_id === match.id);
      if (!pick?.picked_team_id) return false;
    }
  }
  return true;
}

/**
 * Update a user's pick for `matchId` to `teamId`, clearing all downstream
 * picks that depended on the previous selection.
 *
 * Uses static match_number tables — does NOT require next_match_id in DB.
 */
export function cascadePick(
  picks: BracketPick[],
  matchId: string,
  teamId: string,
  matches: Match[]
): BracketPick[] {
  const changedMatch = matches.find((m) => m.id === matchId);
  if (!changedMatch) return picks;

  // Collect all downstream match IDs from the static structure
  const downstreamNumbers = getDownstreamMatchNumbers(changedMatch.match_number);
  const downstreamIds = new Set(
    matches
      .filter((m) => downstreamNumbers.has(m.match_number))
      .map((m) => m.id)
  );

  // Drop every pick that lives in a downstream match
  const kept = picks.filter((p) => !downstreamIds.has(p.match_id));

  // Update or create the pick for the changed match
  const existingIdx = kept.findIndex((p) => p.match_id === matchId);
  if (existingIdx >= 0) {
    return kept.map((p, i) =>
      i === existingIdx ? { ...p, picked_team_id: teamId } : p
    );
  }

  return [
    ...kept,
    {
      id: crypto.randomUUID(),
      bracket_id: "",
      match_id: matchId,
      picked_team_id: teamId,
      round: changedMatch.round,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

export const ROUND_ORDER: BracketRound[] = [
  "r32", "r16", "qf", "sf", "final", "champion",
];
