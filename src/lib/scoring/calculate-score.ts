import {
  BracketPick,
  BracketRound,
  BracketScore,
  League,
  Match,
  ROUND_POINTS,
  ROUNDS_ORDER,
} from "@/lib/types/database";

interface ScoreInput {
  picks: BracketPick[];
  matches: Match[];
  displayName: string;
  userId: string;
  isComplete: boolean;
}

function getActualWinner(match: Match): string | null {
  return match.winner_team_id;
}

function isMatchDecided(match: Match): boolean {
  return match.winner_team_id !== null;
}

export function calculateBracketScore(input: ScoreInput): Omit<BracketScore, "rank"> {
  const { picks, matches, displayName, userId, isComplete } = input;

  const picksByMatch = new Map(picks.map((p) => [p.match_id, p]));
  const matchesByRound = new Map<BracketRound, Match[]>();

  for (const round of ROUNDS_ORDER) {
    matchesByRound.set(
      round,
      matches.filter((m) => m.round === round)
    );
  }

  let totalPoints = 0;
  let correctPicks = 0;
  let missedPicks = 0;
  let possiblePointsRemaining = 0;

  for (const round of ROUNDS_ORDER) {
    if (round === "champion") continue;

    const roundMatches = matchesByRound.get(round) ?? [];
    const points = ROUND_POINTS[round];

    for (const match of roundMatches) {
      const pick = picksByMatch.get(match.id);
      const decided = isMatchDecided(match);

      if (decided) {
        const actualWinner = getActualWinner(match);
        if (pick?.picked_team_id && pick.picked_team_id === actualWinner) {
          totalPoints += points;
          correctPicks++;
        } else if (pick?.picked_team_id) {
          missedPicks++;
        } else {
          missedPicks++;
        }
      } else {
        if (pick?.picked_team_id) {
          possiblePointsRemaining += points;
        }
      }
    }
  }

  // Champion bonus
  const finalMatch = matches.find((m) => m.round === "final");
  const championPick = picks.find((p) => p.round === "champion" || p.match_id === finalMatch?.id);

  let championCorrect = false;
  if (finalMatch && isMatchDecided(finalMatch)) {
    const championTeamId = finalMatch.winner_team_id;
    const pickedChampion =
      picks.find((p) => p.round === "champion")?.picked_team_id ??
      championPick?.picked_team_id;

    if (pickedChampion === championTeamId) {
      totalPoints += ROUND_POINTS.champion;
      championCorrect = true;
    }
  } else {
    const hasChampionPick = picks.some(
      (p) => p.round === "champion" && p.picked_team_id
    );
    if (hasChampionPick) {
      possiblePointsRemaining += ROUND_POINTS.champion;
    }
  }

  const sfMatches = matchesByRound.get("sf") ?? [];
  const finalMatches = matchesByRound.get("final") ?? [];
  const finalistMatchIds = new Set([
    ...sfMatches.map((m) => m.next_match_id).filter(Boolean),
    ...finalMatches.map((m) => m.id),
  ]);

  let correctSemifinalists = 0;
  for (const match of sfMatches) {
    if (!isMatchDecided(match)) continue;
    const pick = picksByMatch.get(match.id);
    if (pick?.picked_team_id === match.winner_team_id) {
      correctSemifinalists++;
    }
  }

  let correctFinalists = 0;
  for (const matchId of finalistMatchIds) {
    const match = matches.find((m) => m.id === matchId);
    if (!match || !isMatchDecided(match)) continue;
    const pick = picksByMatch.get(match.id);
    if (pick?.picked_team_id === match.winner_team_id) {
      correctFinalists++;
    }
  }

  return {
    userId,
    displayName,
    totalPoints,
    possiblePointsRemaining,
    correctPicks,
    missedPicks,
    correctFinalists,
    correctSemifinalists,
    championCorrect,
    isComplete,
  };
}

export function rankBrackets(scores: Omit<BracketScore, "rank">[]): BracketScore[] {
  const sorted = [...scores].sort((a, b) => {
    // Incomplete brackets go last
    if (a.isComplete !== b.isComplete) {
      return a.isComplete ? -1 : 1;
    }
    // Higher points = better (rank 1 is best)
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    // Tiebreakers for ranking (best bracket)
    if (b.correctFinalists !== a.correctFinalists) {
      return b.correctFinalists - a.correctFinalists;
    }
    if (b.correctSemifinalists !== a.correctSemifinalists) {
      return b.correctSemifinalists - a.correctSemifinalists;
    }
    if (a.championCorrect !== b.championCorrect) {
      return a.championCorrect ? -1 : 1;
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return sorted.map((score, index) => ({
    ...score,
    rank: index + 1,
  }));
}

export function getBestAndWorst(scores: BracketScore[]): {
  best: BracketScore | null;
  worst: BracketScore | null;
} {
  if (scores.length === 0) return { best: null, worst: null };

  const complete = scores.filter((s) => s.isComplete);
  const pool = complete.length > 0 ? complete : scores;

  const best = pool.reduce((a, b) => (a.rank < b.rank ? a : b));
  const worst = pool.reduce((a, b) => (a.rank > b.rank ? a : b));

  return { best, worst };
}

export function isLeagueLocked(league: League): boolean {
  if (league.is_manually_locked) return true;
  if (league.lock_deadline) {
    return new Date(league.lock_deadline) <= new Date();
  }
  return league.status === "locked" || league.status === "in_progress" || league.status === "finished";
}

export function getLeagueStatus(
  league: League,
  hasResults: boolean,
  allMatchesComplete: boolean
): League["status"] {
  if (allMatchesComplete) return "finished";
  if (hasResults) return "in_progress";
  if (isLeagueLocked(league)) return "locked";
  return "open";
}
