import { createClient } from "@/lib/supabase/server";
import {
  API_FOOTBALL_DAILY_LIMIT,
  API_FOOTBALL_FULL_SYNC_ESTIMATE,
  API_FOOTBALL_MIN_SYNC_INTERVAL_HOURS,
  isApiFootballConfigured,
} from "./config";
import {
  fetchAllWorldCupFixtures,
  fetchWorldCupStandings,
  fetchWorldCupTeams,
  isGroupStageFixture,
  mapFixtureStatus,
  parseGroupLetterFromRound,
  parseGroupLetterFromStandingGroup,
  ApiFootballError,
} from "./client";
import { FREE_PLAN_SEASON_MESSAGE, isFreePlanSeasonError } from "./errors";
import { getWinnerFromScores } from "@/lib/tournament/standings";
import { GROUP_NAMES } from "@/lib/tournament/types";
import type { ApiSyncLog, GroupMatchStatus } from "@/lib/types/database";

export interface SyncResult {
  success: boolean;
  error?: string;
  callsUsed: number;
  message: string;
  teamsImported?: number;
  fixturesImported?: number;
  standingsUpdated?: number;
  freePlanBlocked?: boolean;
}

async function getCallsUsedToday(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { data } = await supabase.rpc("get_api_calls_used_today");
  return (data as number) ?? 0;
}

async function logSync(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leagueId: string,
  status: "success" | "error" | "partial",
  callsUsed: number,
  message: string
) {
  await supabase.from("api_sync_logs").insert({
    league_id: leagueId,
    sync_type: "full",
    status,
    calls_used: callsUsed,
    message,
  });
}

async function ensureGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leagueId: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  for (const name of GROUP_NAMES) {
    await supabase
      .from("groups")
      .upsert({ league_id: leagueId, name }, { onConflict: "league_id,name" });
  }

  const { data: existing } = await supabase
    .from("groups")
    .select("id, name")
    .eq("league_id", leagueId);

  for (const g of existing ?? []) {
    map.set(g.name, g.id);
  }

  return map;
}

export async function syncWorldCupData(leagueId: string): Promise<SyncResult> {
  if (!isApiFootballConfigured()) {
    return {
      success: false,
      error: "API_FOOTBALL_KEY is not set. Add it to your server environment variables.",
      callsUsed: 0,
      message: "Missing API key",
    };
  }

  const supabase = await createClient();
  let totalCalls = 0;

  try {
    const usedToday = await getCallsUsedToday(supabase);
    if (usedToday + API_FOOTBALL_FULL_SYNC_ESTIMATE > API_FOOTBALL_DAILY_LIMIT) {
      const msg = `Daily API limit reached (${usedToday}/${API_FOOTBALL_DAILY_LIMIT} calls used today). Try again tomorrow.`;
      await logSync(supabase, leagueId, "error", 0, msg);
      return { success: false, error: msg, callsUsed: 0, message: msg };
    }

    const { data: league } = await supabase
      .from("leagues")
      .select("last_synced_at")
      .eq("id", leagueId)
      .single();

    if (league?.last_synced_at) {
      const lastSync = new Date(league.last_synced_at);
      const hoursSince =
        (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
      if (hoursSince < API_FOOTBALL_MIN_SYNC_INTERVAL_HOURS) {
        const msg = `Synced recently. Wait ${API_FOOTBALL_MIN_SYNC_INTERVAL_HOURS}h between syncs to conserve API quota.`;
        return { success: false, error: msg, callsUsed: 0, message: msg };
      }
    }

    const groupMap = await ensureGroups(supabase, leagueId);
    const teamApiToLocal = new Map<number, string>();

    // ── 1. Teams ──
    const { data: teamsData, callsUsed: teamsCalls } = await fetchWorldCupTeams();
    totalCalls += teamsCalls;

    let teamsImported = 0;
    for (const item of teamsData.response ?? []) {
      const apiTeam = item.team;
      const { data: existing } = await supabase
        .from("teams")
        .select("id")
        .eq("league_id", leagueId)
        .eq("api_team_id", apiTeam.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("teams")
          .update({
            name: apiTeam.name,
            short_name: apiTeam.code,
            is_placeholder: false,
          })
          .eq("id", existing.id);
        teamApiToLocal.set(apiTeam.id, existing.id);
      } else {
        const { data: inserted } = await supabase
          .from("teams")
          .insert({
            league_id: leagueId,
            name: apiTeam.name,
            short_name: apiTeam.code,
            api_team_id: apiTeam.id,
            is_placeholder: false,
          })
          .select("id")
          .single();
        if (inserted) {
          teamApiToLocal.set(apiTeam.id, inserted.id);
          teamsImported++;
        }
      }
    }

    // Refresh team map for any pre-existing api_team_id rows
    const { data: allTeams } = await supabase
      .from("teams")
      .select("id, api_team_id")
      .eq("league_id", leagueId)
      .not("api_team_id", "is", null);

    for (const t of allTeams ?? []) {
      if (t.api_team_id) teamApiToLocal.set(t.api_team_id, t.id);
    }

    // ── 2. Standings (assign teams to groups) ──
    const { data: standingsData, callsUsed: standingsCalls } =
      await fetchWorldCupStandings();
    totalCalls += standingsCalls;

    let standingsUpdated = 0;
    const teamToGroup = new Map<number, string>();

    for (const block of standingsData.response ?? []) {
      for (const groupRows of block.league.standings ?? []) {
        for (const row of groupRows) {
          const letter = parseGroupLetterFromStandingGroup(row.group);
          if (!letter) continue;

          const groupId = groupMap.get(letter);
          const localTeamId = teamApiToLocal.get(row.team.id);
          if (!groupId || !localTeamId) continue;

          teamToGroup.set(row.team.id, letter);

          await supabase.from("group_teams").upsert(
            { group_id: groupId, team_id: localTeamId },
            { onConflict: "group_id,team_id" }
          );

          await supabase.from("group_standings").upsert(
            {
              group_id: groupId,
              team_id: localTeamId,
              played: row.all.played,
              won: row.all.win,
              drawn: row.all.draw,
              lost: row.all.lose,
              goals_for: row.all.goals.for,
              goals_against: row.all.goals.against,
              goal_difference: row.goalsDiff,
              points: row.points,
              rank: row.rank,
            },
            { onConflict: "group_id,team_id" }
          );
          standingsUpdated++;
        }
      }
    }

    // ── 3. Fixtures ──
    const { fixtures, callsUsed: fixtureCalls } = await fetchAllWorldCupFixtures();
    totalCalls += fixtureCalls;

    let fixturesImported = 0;
    for (const f of fixtures) {
      if (!isGroupStageFixture(f.league.round)) continue;

      const homeApiId = f.teams.home.id;
      const awayApiId = f.teams.away.id;
      const homeId = teamApiToLocal.get(homeApiId);
      const awayId = teamApiToLocal.get(awayApiId);
      if (!homeId || !awayId) continue;

      const groupLetter =
        parseGroupLetterFromRound(f.league.round) ??
        teamToGroup.get(homeApiId) ??
        teamToGroup.get(awayApiId) ??
        null;

      if (!groupLetter) continue;
      const groupId = groupMap.get(groupLetter);
      if (!groupId) continue;

      const status = mapFixtureStatus(f.fixture.status.short);
      const homeScore = f.goals.home;
      const awayScore = f.goals.away;

      let isDraw = false;
      let winnerTeamId: string | null = null;
      if (
        status === "final" &&
        homeScore != null &&
        awayScore != null
      ) {
        const result = getWinnerFromScores(homeId, awayId, homeScore, awayScore);
        isDraw = result.isDraw;
        winnerTeamId = result.winnerTeamId;
      }

      const { data: existingMatch } = await supabase
        .from("group_matches")
        .select("id, is_manual_override")
        .eq("league_id", leagueId)
        .eq("api_fixture_id", f.fixture.id)
        .maybeSingle();

      if (existingMatch?.is_manual_override) continue;

      const row = {
        league_id: leagueId,
        group_id: groupId,
        home_team_id: homeId,
        away_team_id: awayId,
        home_score: homeScore,
        away_score: awayScore,
        match_date: f.fixture.date,
        status: status as GroupMatchStatus,
        is_draw: isDraw,
        winner_team_id: winnerTeamId,
        api_fixture_id: f.fixture.id,
        is_manual_override: false,
      };

      if (existingMatch) {
        await supabase.from("group_matches").update(row).eq("id", existingMatch.id);
      } else {
        await supabase.from("group_matches").insert(row);
        fixturesImported++;
      }
    }

    // Recalculate standings from matches for groups without API standings
    for (const groupId of groupMap.values()) {
      await supabase.rpc("recalculate_group_standings", { p_group_id: groupId });
    }

    await supabase
      .from("leagues")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", leagueId);

    const message = `Synced ${teamsImported} new teams, ${fixturesImported} new fixtures, ${standingsUpdated} standing rows. Used ${totalCalls} API call(s).`;
    await logSync(supabase, leagueId, "success", totalCalls, message);

    return {
      success: true,
      callsUsed: totalCalls,
      message,
      teamsImported,
      fixturesImported,
      standingsUpdated,
    };
  } catch (err) {
    const raw =
      err instanceof ApiFootballError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Unknown sync error";

    const msg = isFreePlanSeasonError(raw) ? FREE_PLAN_SEASON_MESSAGE : raw;

    await logSync(supabase, leagueId, "error", totalCalls, msg);

    return {
      success: false,
      error: msg,
      callsUsed: totalCalls,
      message: msg,
      freePlanBlocked: isFreePlanSeasonError(raw),
    };
  }
}

export async function getSyncStatus(leagueId: string) {
  const supabase = await createClient();

  const [{ data: league }, callsUsedToday, { data: logs }] = await Promise.all([
    supabase.from("leagues").select("last_synced_at").eq("id", leagueId).single(),
    getCallsUsedToday(supabase),
    supabase
      .from("api_sync_logs")
      .select("*")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    configured: isApiFootballConfigured(),
    lastSyncedAt: league?.last_synced_at ?? null,
    callsUsedToday,
    dailyLimit: API_FOOTBALL_DAILY_LIMIT,
    recentLogs: (logs ?? []) as ApiSyncLog[],
  };
}
