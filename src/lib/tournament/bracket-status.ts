import type { BracketAvailability, League } from "@/lib/types/database";
import { isLeagueLocked } from "@/lib/scoring/calculate-score";

export function getBracketAvailability(league: League): BracketAvailability {
  if (league.status === "in_progress" || league.status === "finished") {
    return "tournament_in_progress";
  }
  if (isLeagueLocked(league)) {
    return "bracket_locked";
  }
  if (!league.r32_ready) {
    return "waiting_for_matchups";
  }
  return "bracket_open";
}

export const BRACKET_STATUS_LABELS: Record<BracketAvailability, string> = {
  waiting_for_matchups: "Not open yet",
  bracket_open: "Bracket open",
  bracket_locked: "Bracket locked",
  tournament_in_progress: "Tournament in progress",
};

export const BRACKET_STATUS_COLORS: Record<BracketAvailability, string> = {
  waiting_for_matchups: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  bracket_open: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  bracket_locked: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  tournament_in_progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

export function canFillBracket(league: League): boolean {
  return getBracketAvailability(league) === "bracket_open";
}
