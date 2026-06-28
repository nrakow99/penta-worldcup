import { createClient } from "@/lib/supabase/server";
import { getWinnerFromScores } from "@/lib/tournament/standings";
import { GROUP_NAMES } from "@/lib/tournament/types";
import { extractRows, detectFormat, normalizeGroupName } from "./parse";
import type { ImportType } from "./templates";
import type { GroupMatchStatus } from "@/lib/types/database";

export interface ImportResult {
  success: boolean;
  message: string;
  error?: string;
  imported?: number;
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
  const { data } = await supabase
    .from("groups")
    .select("id, name")
    .eq("league_id", leagueId);
  for (const g of data ?? []) map.set(g.name, g.id);
  return map;
}

async function findTeamByName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leagueId: string,
  name: string
): Promise<string | null> {
  const { data } = await supabase
    .from("teams")
    .select("id, name")
    .eq("league_id", leagueId);

  const normalized = name.trim().toLowerCase();
  const match = (data ?? []).find(
    (t) => t.name.trim().toLowerCase() === normalized
  );
  return match?.id ?? null;
}

async function recalcAllStandings(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupMap: Map<string, string>
) {
  for (const groupId of groupMap.values()) {
    await supabase.rpc("recalculate_group_standings", { p_group_id: groupId });
  }
}

export async function importTeams(
  leagueId: string,
  content: string,
  filename: string
): Promise<ImportResult> {
  const supabase = await createClient();
  const format = detectFormat(filename, content);
  const rows = extractRows(content, format, "teams");
  const groupMap = await ensureGroups(supabase, leagueId);

  let imported = 0;
  for (const row of rows) {
    const name = row.name?.trim();
    const groupName = normalizeGroupName(row.group_name ?? "");
    if (!name || !groupName) continue;

    const groupId = groupMap.get(groupName);
    if (!groupId) continue;

    let teamId = await findTeamByName(supabase, leagueId, name);

    if (teamId) {
      await supabase
        .from("teams")
        .update({
          short_name: row.short_name || null,
          flag_emoji: row.flag_emoji || null,
          is_placeholder: false,
        })
        .eq("id", teamId);
    } else {
      const { data: inserted } = await supabase
        .from("teams")
        .insert({
          league_id: leagueId,
          name,
          short_name: row.short_name || null,
          flag_emoji: row.flag_emoji || null,
          is_placeholder: false,
        })
        .select("id")
        .single();
      teamId = inserted?.id ?? null;
      if (teamId) imported++;
    }

    if (teamId) {
      await supabase.from("group_teams").upsert(
        { group_id: groupId, team_id: teamId },
        { onConflict: "group_id,team_id" }
      );
    }
  }

  await recalcAllStandings(supabase, groupMap);
  await supabase
    .from("leagues")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", leagueId);

  return {
    success: true,
    imported,
    message: `Imported ${imported} new teams (${rows.length} rows processed). Standings recalculated.`,
  };
}

export async function importFixtures(
  leagueId: string,
  content: string,
  filename: string
): Promise<ImportResult> {
  const supabase = await createClient();
  const format = detectFormat(filename, content);
  const rows = extractRows(content, format, "fixtures");
  const groupMap = await ensureGroups(supabase, leagueId);

  let imported = 0;
  for (const row of rows) {
    const groupName = normalizeGroupName(row.group_name ?? "");
    const homeName = row.home_team?.trim();
    const awayName = row.away_team?.trim();
    if (!groupName || !homeName || !awayName) continue;

    const groupId = groupMap.get(groupName);
    if (!groupId) continue;

    const homeId = await findTeamByName(supabase, leagueId, homeName);
    const awayId = await findTeamByName(supabase, leagueId, awayName);
    if (!homeId || !awayId) continue;

    const status = (row.status?.toLowerCase() || "upcoming") as GroupMatchStatus;
    const validStatus: GroupMatchStatus[] = ["upcoming", "live", "final"];
    const matchStatus = validStatus.includes(status) ? status : "upcoming";

    const { data: existing } = await supabase
      .from("group_matches")
      .select("id")
      .eq("league_id", leagueId)
      .eq("group_id", groupId)
      .eq("home_team_id", homeId)
      .eq("away_team_id", awayId)
      .maybeSingle();

    const payload = {
      league_id: leagueId,
      group_id: groupId,
      home_team_id: homeId,
      away_team_id: awayId,
      match_date: row.match_date || null,
      status: matchStatus,
      is_manual_override: true,
    };

    if (existing) {
      await supabase.from("group_matches").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("group_matches").insert(payload);
      imported++;
    }
  }

  await recalcAllStandings(supabase, groupMap);
  await supabase
    .from("leagues")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", leagueId);

  return {
    success: true,
    imported,
    message: `Imported ${imported} new fixtures (${rows.length} rows processed).`,
  };
}

export async function importResults(
  leagueId: string,
  content: string,
  filename: string
): Promise<ImportResult> {
  const supabase = await createClient();
  const format = detectFormat(filename, content);
  const rows = extractRows(content, format, "results");
  const groupMap = await ensureGroups(supabase, leagueId);

  let updated = 0;
  for (const row of rows) {
    const groupName = normalizeGroupName(row.group_name ?? "");
    const homeName = row.home_team?.trim();
    const awayName = row.away_team?.trim();
    const homeScore = parseInt(row.home_score ?? "", 10);
    const awayScore = parseInt(row.away_score ?? "", 10);

    if (!groupName || !homeName || !awayName || isNaN(homeScore) || isNaN(awayScore)) {
      continue;
    }

    const groupId = groupMap.get(groupName);
    if (!groupId) continue;

    const homeId = await findTeamByName(supabase, leagueId, homeName);
    const awayId = await findTeamByName(supabase, leagueId, awayName);
    if (!homeId || !awayId) continue;

    const result = getWinnerFromScores(homeId, awayId, homeScore, awayScore);

    const { data: existing } = await supabase
      .from("group_matches")
      .select("id")
      .eq("league_id", leagueId)
      .eq("group_id", groupId)
      .eq("home_team_id", homeId)
      .eq("away_team_id", awayId)
      .maybeSingle();

    const payload = {
      league_id: leagueId,
      group_id: groupId,
      home_team_id: homeId,
      away_team_id: awayId,
      home_score: homeScore,
      away_score: awayScore,
      match_date: row.match_date || null,
      status: "final" as const,
      is_draw: result.isDraw,
      winner_team_id: result.winnerTeamId,
      is_manual_override: true,
    };

    if (existing) {
      await supabase.from("group_matches").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("group_matches").insert(payload);
    }
    updated++;
  }

  await recalcAllStandings(supabase, groupMap);
  await supabase
    .from("leagues")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", leagueId);

  return {
    success: true,
    imported: updated,
    message: `Updated ${updated} match results. Standings recalculated.`,
  };
}

export async function runImport(
  leagueId: string,
  importType: ImportType,
  content: string,
  filename: string
): Promise<ImportResult> {
  try {
    switch (importType) {
      case "teams":
        return await importTeams(leagueId, content, filename);
      case "fixtures":
        return await importFixtures(leagueId, content, filename);
      case "results":
        return await importResults(leagueId, content, filename);
      default:
        return { success: false, message: "Unknown import type", error: "Unknown import type" };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Import failed";
    return { success: false, message: msg, error: msg };
  }
}
