import { createClient } from "@/lib/supabase/server";
import type {
  GroupMatch,
  GroupStanding,
  GroupTeam,
  Match,
  WcGroup,
} from "@/lib/types/database";

export async function getGroupStageData(leagueId: string) {
  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("groups")
    .select("*")
    .eq("league_id", leagueId)
    .order("name");

  const groupIds = (groups ?? []).map((g) => g.id);

  let groupTeams: GroupTeam[] = [];
  let matches: GroupMatch[] = [];
  let standings: GroupStanding[] = [];

  if (groupIds.length > 0) {
    const [teamsRes, matchesRes, standingsRes] = await Promise.all([
      supabase.from("group_teams").select("*, team:teams(*)").in("group_id", groupIds),
      supabase
        .from("group_matches")
        .select("*, home_team:teams!group_matches_home_team_id_fkey(*), away_team:teams!group_matches_away_team_id_fkey(*)")
        .eq("league_id", leagueId)
        .order("match_date", { ascending: true }),
      supabase
        .from("group_standings")
        .select("*, team:teams(*)")
        .in("group_id", groupIds)
        .order("rank"),
    ]);

    groupTeams = (teamsRes.data ?? []) as GroupTeam[];
    matches = (matchesRes.data ?? []) as GroupMatch[];
    standings = (standingsRes.data ?? []) as GroupStanding[];

    const groupMap = new Map((groups ?? []).map((g) => [g.id, g]));
    for (const m of matches) {
      m.group = groupMap.get(m.group_id);
    }
    for (const s of standings) {
      s.group = groupMap.get(s.group_id);
    }
  }

  return {
    groups: (groups ?? []) as WcGroup[],
    groupTeams,
    matches,
    standings,
  };
}

export async function getUpcomingFixtures(leagueId: string, limit = 5) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("group_matches")
    .select("*, home_team:teams!group_matches_home_team_id_fkey(*), away_team:teams!group_matches_away_team_id_fkey(*), group:groups(*)")
    .eq("league_id", leagueId)
    .in("status", ["upcoming", "live"])
    .order("match_date", { ascending: true })
    .limit(limit);

  return (data ?? []) as GroupMatch[];
}

export async function getRecentResults(leagueId: string, limit = 5) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("group_matches")
    .select("*, home_team:teams!group_matches_home_team_id_fkey(*), away_team:teams!group_matches_away_team_id_fkey(*), group:groups(*)")
    .eq("league_id", leagueId)
    .eq("status", "final")
    .order("match_date", { ascending: false })
    .limit(limit);

  return (data ?? []) as GroupMatch[];
}

export async function getR32Matches(leagueId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("matches")
    .select("*, team_a:teams!matches_team_a_id_fkey(*), team_b:teams!matches_team_b_id_fkey(*)")
    .eq("league_id", leagueId)
    .eq("round", "r32")
    .order("match_number");

  return (data ?? []) as Match[];
}
