import {
  BracketRound,
  BracketPick,
  Match,
  Team,
  MATCH_COUNTS,
} from "@/lib/types/database";

/** Standard bracket advancement: R32 matches 1-2 feed R16 match 1, etc. */
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

export function getMatchNumberForSlot(
  round: BracketRound,
  index: number
): number {
  const offsets: Record<Exclude<BracketRound, "champion">, number> = {
    r32: 0,
    r16: 16,
    qf: 24,
    sf: 28,
    final: 30,
  };
  if (round === "champion") return 31;
  return offsets[round as Exclude<BracketRound, "champion">] + index + 1;
}

export function createDefaultMatches(leagueId: string): Omit<Match, "id" | "created_at">[] {
  const matches: Omit<Match, "id" | "created_at">[] = [];

  const rounds: Exclude<BracketRound, "champion">[] = ["r32", "r16", "qf", "sf", "final"];

  for (const round of rounds) {
    const count = MATCH_COUNTS[round];
    for (let i = 0; i < count; i++) {
      const matchNumber = getMatchNumberForSlot(round, i);
      matches.push({
        league_id: leagueId,
        round,
        match_number: matchNumber,
        team_a_id: null,
        team_b_id: null,
        team_a_placeholder: round === "r32" ? `Team ${matchNumber * 2 - 1}` : null,
        team_b_placeholder: round === "r32" ? `Team ${matchNumber * 2}` : null,
        winner_team_id: null,
        next_match_id: null,
        next_match_slot: null,
        team_a_score: null,
        team_b_score: null,
        scheduled_at: null,
      });
    }
  }

  return matches;
}

export function getNextMatchLink(
  matchNumber: number
): { nextMatchNumber: number; slot: "a" | "b" } | null {
  for (const [a, b, next] of [...R32_TO_R16, ...R16_TO_QF, ...QF_TO_SF, ...SF_TO_FINAL]) {
    if (matchNumber === a) return { nextMatchNumber: next, slot: "a" };
    if (matchNumber === b) return { nextMatchNumber: next, slot: "b" };
  }
  return null;
}

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

export function resolveMatchTeams(
  match: Match,
  picks: BracketPick[],
  allMatches: Match[],
  teams: Map<string, Team>
): { teamA: Team | null; teamB: Team | null; labelA: string; labelB: string } {
  let teamA = match.team_a_id ? teams.get(match.team_a_id) ?? null : null;
  let teamB = match.team_b_id ? teams.get(match.team_b_id) ?? null : null;

  if (match.round !== "r32") {
    const feederMatches = allMatches.filter((m) => m.next_match_id === match.id);
    for (const feeder of feederMatches) {
      const feederPick = picks.find((p) => p.match_id === feeder.id);
      const pickedTeam = feederPick?.picked_team_id
        ? teams.get(feederPick.picked_team_id) ?? null
        : null;

      if (feeder.next_match_slot === "a" && !teamA) teamA = pickedTeam;
      if (feeder.next_match_slot === "b" && !teamB) teamB = pickedTeam;
    }
  }

  return {
    teamA,
    teamB,
    labelA: getTeamDisplay(teamA, match.team_a_placeholder),
    labelB: getTeamDisplay(teamB, match.team_b_placeholder),
  };
}

export function validateBracketComplete(
  picks: BracketPick[],
  matches: Match[]
): boolean {
  const r32Matches = matches.filter((m) => m.round === "r32");
  const r32Picks = picks.filter(
    (p) => p.round === "r32" && p.picked_team_id
  );
  if (r32Picks.length < r32Matches.length) return false;

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

export function cascadePick(
  picks: BracketPick[],
  matchId: string,
  teamId: string,
  matches: Match[]
): BracketPick[] {
  const updated = picks.filter((p) => {
    const match = matches.find((m) => m.id === p.match_id);
    if (!match) return true;

    const changedMatch = matches.find((m) => m.id === matchId);
    if (!changedMatch) return true;

    // Remove downstream picks affected by this change
    return !isDownstream(match, changedMatch, matches);
  });

  const existing = updated.find((p) => p.match_id === matchId);
  const match = matches.find((m) => m.id === matchId);
  if (!match) return updated;

  if (existing) {
    return updated.map((p) =>
      p.match_id === matchId ? { ...p, picked_team_id: teamId } : p
    );
  }

  return [
    ...updated,
    {
      id: crypto.randomUUID(),
      bracket_id: "",
      match_id: matchId,
      picked_team_id: teamId,
      round: match.round,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];
}

function isDownstream(
  match: Match,
  changedMatch: Match,
  allMatches: Match[]
): boolean {
  if (match.id === changedMatch.id) return false;

  let current: Match | undefined = changedMatch;
  const visited = new Set<string>();

  while (current?.next_match_id) {
    if (visited.has(current.id)) break;
    visited.add(current.id);

    if (current.next_match_id === match.id) return true;
    current = allMatches.find((m) => m.id === current!.next_match_id);
  }

  return false;
}

export const ROUND_ORDER: BracketRound[] = ["r32", "r16", "qf", "sf", "final", "champion"];
