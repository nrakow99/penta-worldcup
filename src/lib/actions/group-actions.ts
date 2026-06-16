"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getWinnerFromScores } from "@/lib/tournament/standings";
import { GROUP_NAMES } from "@/lib/tournament/types";
import type { GroupMatchStatus } from "@/lib/types/database";

async function requireAdmin(leagueId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase, user: null };

  const { data: member } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (!member || member.role !== "admin") {
    const { data: league } = await supabase
      .from("leagues")
      .select("admin_id")
      .eq("id", leagueId)
      .single();
    if (league?.admin_id !== user.id) {
      return { error: "Not authorized" as const, supabase, user: null };
    }
  }

  return { error: null, supabase, user };
}

async function recalcStandings(supabase: Awaited<ReturnType<typeof createClient>>, groupId: string) {
  await supabase.rpc("recalculate_group_standings", { p_group_id: groupId });
}

export async function initializeGroups(leagueId: string) {
  const { error, supabase } = await requireAdmin(leagueId);
  if (error) return { error };

  for (const name of GROUP_NAMES) {
    await supabase.from("groups").upsert(
      { league_id: leagueId, name },
      { onConflict: "league_id,name" }
    );
  }

  revalidatePath(`/league/${leagueId}/groups`);
  return { success: true };
}

export async function addTeamToGroup(groupId: string, teamId: string, leagueId: string) {
  const { error, supabase } = await requireAdmin(leagueId);
  if (error) return { error };

  const { error: insertError } = await supabase.from("group_teams").insert({
    group_id: groupId,
    team_id: teamId,
  });
  if (insertError) return { error: insertError.message };

  await recalcStandings(supabase, groupId);
  revalidatePath(`/league/${leagueId}/groups`);
  return { success: true };
}

export async function upsertGroupMatch(
  leagueId: string,
  data: {
    id?: string;
    groupId: string;
    homeTeamId: string;
    awayTeamId: string;
    matchDate?: string | null;
    status?: GroupMatchStatus;
    homeScore?: number | null;
    awayScore?: number | null;
  }
) {
  const { error, supabase } = await requireAdmin(leagueId);
  if (error) return { error };

  let isDraw = false;
  let winnerTeamId: string | null = null;
  let status = data.status ?? "upcoming";

  if (
    data.homeScore != null &&
    data.awayScore != null &&
    status === "final"
  ) {
    const result = getWinnerFromScores(
      data.homeTeamId,
      data.awayTeamId,
      data.homeScore,
      data.awayScore
    );
    isDraw = result.isDraw;
    winnerTeamId = result.winnerTeamId;
  }

  const row = {
    league_id: leagueId,
    group_id: data.groupId,
    home_team_id: data.homeTeamId,
    away_team_id: data.awayTeamId,
    match_date: data.matchDate ?? null,
    status,
    home_score: data.homeScore ?? null,
    away_score: data.awayScore ?? null,
    is_draw: isDraw,
    winner_team_id: winnerTeamId,
  };

  if (data.id) {
    const { error: updateError } = await supabase
      .from("group_matches")
      .update(row)
      .eq("id", data.id);
    if (updateError) return { error: updateError.message };
  } else {
    const { error: insertError } = await supabase.from("group_matches").insert(row);
    if (insertError) return { error: insertError.message };
  }

  await recalcStandings(supabase, data.groupId);
  revalidatePath(`/league/${leagueId}/groups`);
  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}

export async function markGroupMatchFinal(
  leagueId: string,
  matchId: string,
  homeScore: number,
  awayScore: number
) {
  const { error, supabase } = await requireAdmin(leagueId);
  if (error) return { error };

  const { data: match } = await supabase
    .from("group_matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (!match) return { error: "Match not found" };

  const result = getWinnerFromScores(
    match.home_team_id,
    match.away_team_id,
    homeScore,
    awayScore
  );

  const { error: updateError } = await supabase
    .from("group_matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: "final",
      is_draw: result.isDraw,
      winner_team_id: result.winnerTeamId,
    })
    .eq("id", matchId);

  if (updateError) return { error: updateError.message };

  await recalcStandings(supabase, match.group_id);
  revalidatePath(`/league/${leagueId}/groups`);
  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}

export async function updateGroupMatchStatus(
  leagueId: string,
  matchId: string,
  status: GroupMatchStatus
) {
  const { error, supabase } = await requireAdmin(leagueId);
  if (error) return { error };

  const { data: match } = await supabase
    .from("group_matches")
    .select("group_id")
    .eq("id", matchId)
    .single();

  const { error: updateError } = await supabase
    .from("group_matches")
    .update({ status })
    .eq("id", matchId);

  if (updateError) return { error: updateError.message };

  if (match?.group_id) await recalcStandings(supabase, match.group_id);
  revalidatePath(`/league/${leagueId}/groups`);
  return { success: true };
}

export async function assignR32Team(
  leagueId: string,
  matchId: string,
  slot: "a" | "b",
  teamId: string | null
) {
  const { error, supabase } = await requireAdmin(leagueId);
  if (error) return { error };

  const update =
    slot === "a"
      ? { team_a_id: teamId, team_a_placeholder: teamId ? null : "TBD" }
      : { team_b_id: teamId, team_b_placeholder: teamId ? null : "TBD" };

  const { error: updateError } = await supabase
    .from("matches")
    .update(update)
    .eq("id", matchId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/league/${leagueId}/admin/knockout-setup`);
  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}

export async function setR32Ready(leagueId: string, ready: boolean) {
  const { error, supabase } = await requireAdmin(leagueId);
  if (error) return { error };

  const { error: updateError } = await supabase
    .from("leagues")
    .update({ r32_ready: ready })
    .eq("id", leagueId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/bracket`);
  revalidatePath(`/league/${leagueId}/admin/knockout-setup`);
  return { success: true };
}

export async function seedSampleGroupStage(leagueId: string) {
  const { error, supabase } = await requireAdmin(leagueId);
  if (error) return { error };

  await initializeGroups(leagueId);

  const sampleTeams = [
    { name: "USA", flag: "🇺🇸", group: "A" },
    { name: "Mexico", flag: "🇲🇽", group: "A" },
    { name: "Canada", flag: "🇨🇦", group: "A" },
    { name: "Jamaica", flag: "🇯🇲", group: "A" },
    { name: "Brazil", flag: "🇧🇷", group: "B" },
    { name: "Argentina", flag: "🇦🇷", group: "B" },
    { name: "Uruguay", flag: "🇺🇾", group: "B" },
    { name: "Colombia", flag: "🇨🇴", group: "B" },
    { name: "France", flag: "🇫🇷", group: "C" },
    { name: "Germany", flag: "🇩🇪", group: "C" },
    { name: "Spain", flag: "🇪🇸", group: "C" },
    { name: "Italy", flag: "🇮🇹", group: "C" },
    { name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "D" },
    { name: "Netherlands", flag: "🇳🇱", group: "D" },
    { name: "Portugal", flag: "🇵🇹", group: "D" },
    { name: "Belgium", flag: "🇧🇪", group: "D" },
  ];

  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("league_id", leagueId);

  const groupMap = new Map((groups ?? []).map((g) => [g.name, g.id]));
  const teamMap = new Map<string, string>();

  for (const t of sampleTeams) {
    const { data: team } = await supabase
      .from("teams")
      .insert({
        league_id: leagueId,
        name: t.name,
        flag_emoji: t.flag,
      })
      .select("id")
      .single();

    if (team) {
      teamMap.set(t.name, team.id);
      const groupId = groupMap.get(t.group);
      if (groupId) {
        await supabase.from("group_teams").upsert(
          { group_id: groupId, team_id: team.id },
          { onConflict: "group_id,team_id" }
        );
      }
    }
  }

  // Sample fixtures for Group A
  const groupA = groupMap.get("A");
  const usa = teamMap.get("USA");
  const mex = teamMap.get("Mexico");
  const can = teamMap.get("Canada");
  const jam = teamMap.get("Jamaica");

  if (groupA && usa && mex && can && jam) {
    const fixtures = [
      { home: usa, away: mex, date: "2026-06-15T18:00:00Z", status: "final" as const, hs: 2, as: 1 },
      { home: can, away: jam, date: "2026-06-16T20:00:00Z", status: "final" as const, hs: 1, as: 1 },
      { home: usa, away: can, date: "2026-06-22T18:00:00Z", status: "upcoming" as const, hs: null, as: null },
      { home: mex, away: jam, date: "2026-06-23T20:00:00Z", status: "upcoming" as const, hs: null, as: null },
    ];

    for (const f of fixtures) {
      let isDraw = false;
      let winner: string | null = null;
      if (f.status === "final" && f.hs != null && f.as != null) {
        const r = getWinnerFromScores(f.home, f.away, f.hs, f.as);
        isDraw = r.isDraw;
        winner = r.winnerTeamId;
      }
      await supabase.from("group_matches").insert({
        league_id: leagueId,
        group_id: groupA,
        home_team_id: f.home,
        away_team_id: f.away,
        match_date: f.date,
        status: f.status,
        home_score: f.hs,
        away_score: f.as,
        is_draw: isDraw,
        winner_team_id: winner,
      });
    }
    await recalcStandings(supabase, groupA);
  }

  revalidatePath(`/league/${leagueId}/groups`);
  return { success: true };
}
