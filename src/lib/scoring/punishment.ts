import { BracketScore } from "@/lib/types/database";

interface PunishmentCandidate extends BracketScore {
  totalGoalsDiff?: number;
}

/**
 * Determine worst bracket for punishment.
 * Lower rank = better, so worst = highest rank number among tied lowest scores.
 * Tiebreakers (worst wins = gets punishment):
 * 1. Fewer correct finalists
 * 2. Fewer correct semifinalists
 * 3. Wrong champion (prefer those who got champion wrong)
 * 4. Final total goals tiebreaker (furthest from actual)
 * 5. Random coin flip
 */
export function determinePunishmentRecipient(
  scores: BracketScore[],
  leagueTotalGoals: number,
  userGoalPicks?: Map<string, number>
): BracketScore | null {
  if (scores.length === 0) return null;

  const incomplete = scores.filter((s) => !s.isComplete);
  if (incomplete.length === 1) return incomplete[0];
  if (incomplete.length > 1) {
    return breakPunishmentTie(
      incomplete.map((s) => ({
        ...s,
        totalGoalsDiff: Math.abs(
          (userGoalPicks?.get(s.userId) ?? 0) - leagueTotalGoals
        ),
      })),
      leagueTotalGoals
    );
  }

  const minPoints = Math.min(...scores.map((s) => s.totalPoints));
  const tied = scores.filter((s) => s.totalPoints === minPoints);

  if (tied.length === 1) return tied[0];

  return breakPunishmentTie(
    tied.map((s) => ({
      ...s,
      totalGoalsDiff: Math.abs(
        (userGoalPicks?.get(s.userId) ?? 0) - leagueTotalGoals
      ),
    })),
    leagueTotalGoals
  );
}

function breakPunishmentTie(
  candidates: PunishmentCandidate[],
  _leagueTotalGoals: number
): BracketScore {
  let pool = [...candidates];

  // 1. Fewer correct finalists = worse
  const minFinalists = Math.min(...pool.map((c) => c.correctFinalists));
  pool = pool.filter((c) => c.correctFinalists === minFinalists);
  if (pool.length === 1) return pool[0];

  // 2. Fewer correct semifinalists = worse
  const minSemifinalists = Math.min(...pool.map((c) => c.correctSemifinalists));
  pool = pool.filter((c) => c.correctSemifinalists === minSemifinalists);
  if (pool.length === 1) return pool[0];

  // 3. Wrong champion = worse (those who didn't get champion correct)
  const wrongChampion = pool.filter((c) => !c.championCorrect);
  if (wrongChampion.length === 1) return wrongChampion[0];
  if (wrongChampion.length > 0) pool = wrongChampion;

  // 4. Total goals tiebreaker — furthest from actual is worst
  const maxDiff = Math.max(...pool.map((c) => c.totalGoalsDiff ?? 0));
  pool = pool.filter((c) => (c.totalGoalsDiff ?? 0) === maxDiff);
  if (pool.length === 1) return pool[0];

  // 5. Random coin flip
  return pool[Math.floor(Math.random() * pool.length)];
}

export function determineWinner(scores: BracketScore[]): BracketScore | null {
  if (scores.length === 0) return null;
  const complete = scores.filter((s) => s.isComplete);
  const pool = complete.length > 0 ? complete : scores;
  return pool.reduce((a, b) => (a.rank < b.rank ? a : b));
}
