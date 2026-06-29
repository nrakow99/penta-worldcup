import type { League } from "@/lib/types/database";

/** Player-facing bracket lifecycle — not_open → open → locked */
export type BracketState = "not_open" | "open" | "locked";

type LeagueRow = League & { r32_ready?: boolean };

/** Read bracket_open from DB, with fallback for unmigrated r32_ready column. */
export function isBracketOpen(league: LeagueRow): boolean {
  if (league.bracket_open === true) return true;
  if (league.r32_ready === true) return true;
  return false;
}

/**
 * Single source of truth for whether players can fill out brackets.
 *
 * 1. not_open — admin has not opened the bracket yet
 * 2. open      — bracket is open and picks are still allowed
 * 3. locked    — bracket was open but deadline passed or admin locked manually
 */
export function getBracketState(league: LeagueRow): BracketState {
  if (!isBracketOpen(league)) {
    return "not_open";
  }

  if (league.is_manually_locked) {
    return "locked";
  }

  if (league.lock_deadline && new Date(league.lock_deadline) <= new Date()) {
    return "locked";
  }

  return "open";
}

export const BRACKET_STATE_LABELS: Record<BracketState, string> = {
  not_open: "Not open yet",
  open: "Bracket open",
  locked: "Bracket locked",
};

export const BRACKET_STATE_COLORS: Record<BracketState, string> = {
  not_open: "border-amber-700 bg-amber-950/40 text-amber-300",
  open: "border-emerald-700 bg-emerald-950/40 text-emerald-300",
  locked: "border-zinc-600 bg-zinc-800/40 text-zinc-300",
};

export function canFillBracket(league: LeagueRow): boolean {
  return getBracketState(league) === "open";
}

/** Normalize a raw Supabase leagues row into a League with bracket_open set. */
export function normalizeLeague<T extends LeagueRow>(league: T): League {
  return {
    ...league,
    bracket_open: isBracketOpen(league),
  };
}
