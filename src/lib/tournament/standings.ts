import type { GroupMatch, GroupStanding, Team } from "@/lib/types/database";

export interface TeamStats {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

function emptyStats(teamId: string): TeamStats {
  return {
    teamId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

/** Calculate standings from final group matches (client-side fallback) */
export function calculateStandingsFromMatches(
  teamIds: string[],
  matches: GroupMatch[]
): GroupStanding[] {
  const stats = new Map<string, TeamStats>();
  for (const id of teamIds) stats.set(id, emptyStats(id));

  for (const m of matches) {
    if (m.status !== "final") continue;
    if (m.home_score == null || m.away_score == null) continue;

    const home = stats.get(m.home_team_id)!;
    const away = stats.get(m.away_team_id)!;

    home.played++;
    away.played++;
    home.goalsFor += m.home_score;
    home.goalsAgainst += m.away_score;
    away.goalsFor += m.away_score;
    away.goalsAgainst += m.home_score;

    if (m.is_draw || m.home_score === m.away_score) {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    } else if (m.home_score > m.away_score) {
      home.won++;
      away.lost++;
      home.points += 3;
    } else {
      away.won++;
      home.lost++;
      away.points += 3;
    }
  }

  const rows = [...stats.values()].map((s) => ({
    ...s,
    goalDifference: s.goalsFor - s.goalsAgainst,
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  return rows.map((s, i) => ({
    id: "",
    group_id: "",
    team_id: s.teamId,
    played: s.played,
    won: s.won,
    drawn: s.drawn,
    lost: s.lost,
    goals_for: s.goalsFor,
    goals_against: s.goalsAgainst,
    goal_difference: s.goalDifference,
    points: s.points,
    rank: i + 1,
    updated_at: new Date().toISOString(),
  }));
}

export function resolveMatchResult(
  homeScore: number,
  awayScore: number
): { isDraw: boolean; winnerTeamId: string | null; homeId: string; awayId: string } {
  const isDraw = homeScore === awayScore;
  return {
    isDraw,
    winnerTeamId: null,
    homeId: "",
    awayId: "",
  };
}

export function getWinnerFromScores(
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number
): { isDraw: boolean; winnerTeamId: string | null } {
  if (homeScore === awayScore) {
    return { isDraw: true, winnerTeamId: null };
  }
  return {
    isDraw: false,
    winnerTeamId: homeScore > awayScore ? homeTeamId : awayTeamId,
  };
}

export function formatTeamName(team: Team | null | undefined): string {
  if (!team) return "TBD";
  return `${team.flag_emoji ? team.flag_emoji + " " : ""}${team.name}`;
}
