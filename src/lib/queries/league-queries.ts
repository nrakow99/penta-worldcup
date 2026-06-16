import { createClient } from "@/lib/supabase/server";
import {
  calculateBracketScore,
  rankBrackets,
  isLeagueLocked,
} from "@/lib/scoring/calculate-score";
import {
  determinePunishmentRecipient,
  determineWinner,
} from "@/lib/scoring/punishment";
import type {
  Bracket,
  BracketPick,
  BracketScore,
  Comment,
  League,
  LeagueMember,
  Match,
  Punishment,
  Team,
} from "@/lib/types/database";

export async function getUserLeagues(userId: string) {
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("league_members")
    .select("*, leagues(*)")
    .eq("user_id", userId);

  return (memberships ?? []) as Array<{
    id: string;
    league_id: string;
    user_id: string;
    role: "admin" | "member";
    joined_at: string;
    leagues: League;
  }>;
}

export async function getLeagueDetails(leagueId: string, userId: string) {
  const supabase = await createClient();

  const { data: league } = await supabase
    .from("leagues")
    .select("*")
    .eq("id", leagueId)
    .single();

  if (!league) return null;

  const { data: members } = await supabase
    .from("league_members")
    .select("*, profiles(*)")
    .eq("league_id", leagueId);

  const { data: punishment } = await supabase
    .from("punishments")
    .select("*")
    .eq("league_id", leagueId)
    .maybeSingle();

  const isMember = members?.some((m) => m.user_id === userId);
  if (!isMember) return null;

  const isAdmin = members?.some(
    (m) => m.user_id === userId && m.role === "admin"
  );

  return {
    league: {
      ...(league as League),
      r32_ready: (league as League).r32_ready ?? false,
    },
    members: (members ?? []) as LeagueMember[],
    punishment: punishment as Punishment | null,
    isAdmin: !!isAdmin,
    isLocked: isLeagueLocked(league as League),
  };
}

export async function getLeagueBracketData(leagueId: string) {
  const supabase = await createClient();

  const [{ data: matches }, { data: teams }, { data: brackets }] =
    await Promise.all([
      supabase
        .from("matches")
        .select("*")
        .eq("league_id", leagueId)
        .order("match_number"),
      supabase.from("teams").select("*").eq("league_id", leagueId),
      supabase
        .from("brackets")
        .select("*, profiles(*)")
        .eq("league_id", leagueId),
    ]);

  const bracketIds = (brackets ?? []).map((b) => b.id);
  let allPicks: BracketPick[] = [];

  if (bracketIds.length > 0) {
    const { data: picks } = await supabase
      .from("bracket_picks")
      .select("*")
      .in("bracket_id", bracketIds);
    allPicks = (picks ?? []) as BracketPick[];
  }

  return {
    matches: (matches ?? []) as Match[],
    teams: (teams ?? []) as Team[],
    brackets: (brackets ?? []) as Bracket[],
    picks: allPicks,
  };
}

export async function getLeaderboard(leagueId: string): Promise<{
  scores: BracketScore[];
  best: BracketScore | null;
  worst: BracketScore | null;
  winner: BracketScore | null;
  punishmentRecipient: BracketScore | null;
}> {
  const { matches, brackets, picks } = await getLeagueBracketData(leagueId);

  const supabase = await createClient();
  const { data: league } = await supabase
    .from("leagues")
    .select("total_goals")
    .eq("id", leagueId)
    .single();

  const totalGoals = (league as { total_goals: number } | null)?.total_goals ?? 0;

  const scores = (brackets ?? []).map((bracket) => {
    const bracketPicks = picks.filter((p) => p.bracket_id === bracket.id);
    const profile = bracket.profile as { display_name: string } | undefined;

    return calculateBracketScore({
      picks: bracketPicks,
      matches,
      displayName: profile?.display_name ?? "Unknown",
      userId: bracket.user_id,
      isComplete: bracket.is_complete,
    });
  });

  const ranked = rankBrackets(scores);
  const best = ranked.length > 0 ? ranked[0] : null;
  const worst = ranked.length > 0 ? ranked[ranked.length - 1] : null;
  const winner = determineWinner(ranked);
  const punishmentRecipient = determinePunishmentRecipient(
    ranked,
    totalGoals
  );

  return { scores: ranked, best, worst, winner, punishmentRecipient };
}

export async function getComments(leagueId: string): Promise<Comment[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("comments")
    .select("*, profiles(*)")
    .eq("league_id", leagueId)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []) as Comment[];
}

export async function getUserBracket(leagueId: string, userId: string) {
  const supabase = await createClient();

  const { data: bracket } = await supabase
    .from("brackets")
    .select("*")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .single();

  if (!bracket) return null;

  const { data: picks } = await supabase
    .from("bracket_picks")
    .select("*")
    .eq("bracket_id", bracket.id);

  return {
    bracket: bracket as Bracket,
    picks: (picks ?? []) as BracketPick[],
  };
}
