export type BracketState = "not_open" | "open" | "locked";
export type LeagueStatus = "open" | "locked" | "in_progress" | "finished";
export type MemberRole = "admin" | "member";
export type BracketRound = "r32" | "r16" | "qf" | "sf" | "final" | "champion";
export type MatchSlot = "a" | "b";

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface League {
  id: string;
  name: string;
  invite_code: string;
  admin_id: string;
  status: LeagueStatus;
  lock_deadline: string | null;
  is_manually_locked: boolean;
  total_goals: number;
  bracket_open: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
  profile?: Profile;
}

export interface Team {
  id: string;
  league_id: string;
  name: string;
  short_name: string | null;
  flag_emoji: string | null;
  is_placeholder: boolean;
  placeholder_label: string | null;
  created_at: string;
}

export interface Match {
  id: string;
  league_id: string;
  round: BracketRound;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_placeholder: string | null;
  team_b_placeholder: string | null;
  winner_team_id: string | null;
  next_match_id: string | null;
  next_match_slot: MatchSlot | null;
  team_a_score: number | null;
  team_b_score: number | null;
  scheduled_at: string | null;
  created_at: string;
  team_a?: Team | null;
  team_b?: Team | null;
  winner?: Team | null;
}

export interface Bracket {
  id: string;
  league_id: string;
  user_id: string;
  is_complete: boolean;
  is_locked: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  picks?: BracketPick[];
}

export interface BracketPick {
  id: string;
  bracket_id: string;
  match_id: string;
  picked_team_id: string | null;
  round: BracketRound;
  created_at: string;
  updated_at: string;
  picked_team?: Team | null;
  match?: Match;
}

export interface ActualResult {
  id: string;
  league_id: string;
  match_id: string;
  winner_team_id: string;
  team_a_score: number;
  team_b_score: number;
  recorded_at: string;
  recorded_by: string;
}

export interface Punishment {
  id: string;
  league_id: string;
  description: string;
  set_by: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  league_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: Profile;
}

export interface BracketScore {
  userId: string;
  displayName: string;
  totalPoints: number;
  possiblePointsRemaining: number;
  correctPicks: number;
  missedPicks: number;
  correctFinalists: number;
  correctSemifinalists: number;
  championCorrect: boolean;
  isComplete: boolean;
  rank: number;
}

export interface LeagueWithDetails extends League {
  members: LeagueMember[];
  punishment: Punishment | null;
  memberCount: number;
  isLocked: boolean;
}

export const ROUND_POINTS: Record<BracketRound, number> = {
  r32: 1,
  r16: 2,
  qf: 4,
  sf: 8,
  final: 16,
  champion: 10,
};

export const ROUND_LABELS: Record<BracketRound, string> = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarterfinals",
  sf: "Semifinals",
  final: "Final",
  champion: "Champion",
};

export const ROUNDS_ORDER: BracketRound[] = [
  "r32",
  "r16",
  "qf",
  "sf",
  "final",
  "champion",
];

export const MATCH_COUNTS: Record<Exclude<BracketRound, "champion">, number> = {
  r32: 16,
  r16: 8,
  qf: 4,
  sf: 2,
  final: 1,
};
