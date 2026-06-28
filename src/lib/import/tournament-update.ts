import { createClient } from "@/lib/supabase/server";
import { getWinnerFromScores } from "@/lib/tournament/standings";
import { GROUP_NAMES } from "@/lib/tournament/types";

// ─── Public types ──────────────────────────────────────────────────────────

export interface TournamentResultInput {
  date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  /** "final" | "live" | anything — defaults to "final" */
  status?: string;
  /** Optional group hint ("A"–"L"); auto-detected from existing team data */
  group?: string;
}

export interface TournamentFixtureInput {
  date: string;
  home_team: string;
  away_team: string;
  /** "scheduled" | "upcoming" | "live" — mapped to DB enum */
  status?: string;
  /** Optional group hint; auto-detected if omitted */
  group?: string;
}

export interface TournamentUpdatePayload {
  results?: TournamentResultInput[];
  fixtures?: TournamentFixtureInput[];
}

export interface TournamentUpdateSummary {
  success: boolean;
  resultsApplied: number;
  fixturesApplied: number;
  teamsCreated: number;
  warnings: string[];
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

async function ensureGroups(
  supabase: SupabaseClient,
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

function normalizeGroupName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toUpperCase();
  const match = trimmed.match(/GROUP\s*([A-L])/) ?? trimmed.match(/^([A-L])$/);
  return match ? match[1] : undefined;
}

function normalizeStatus(raw: string | undefined, defaultVal: "final" | "upcoming"): "upcoming" | "live" | "final" {
  const s = raw?.toLowerCase() ?? defaultVal;
  if (s === "final" || s === "completed" || s === "finished") return "final";
  if (s === "live" || s === "in_progress") return "live";
  return "upcoming";
}

async function findTeamId(
  supabase: SupabaseClient,
  leagueId: string,
  name: string,
  teamCache: Map<string, string>
): Promise<string | null> {
  const normalized = name.trim().toLowerCase();
  if (teamCache.has(normalized)) return teamCache.get(normalized)!;

  const { data } = await supabase
    .from("teams")
    .select("id, name")
    .eq("league_id", leagueId);

  for (const t of data ?? []) {
    teamCache.set(t.name.trim().toLowerCase(), t.id);
  }

  return teamCache.get(normalized) ?? null;
}

/** Returns the group ID a team currently belongs to (from group_teams). */
async function getTeamGroupId(
  supabase: SupabaseClient,
  teamId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("group_teams")
    .select("group_id")
    .eq("team_id", teamId)
    .maybeSingle();
  return data?.group_id ?? null;
}

/** Find or create a team; assign to group if newly created. */
async function findOrCreateTeam(
  supabase: SupabaseClient,
  leagueId: string,
  name: string,
  groupHint: string | undefined,
  groupMap: Map<string, string>,
  teamCache: Map<string, string>,
  warnings: string[]
): Promise<{ teamId: string; groupId: string | null }> {
  const existingId = await findTeamId(supabase, leagueId, name, teamCache);
  let isNew = false;
  let resolvedTeamId: string;

  if (!existingId) {
    const { data: inserted } = await supabase
      .from("teams")
      .insert({ league_id: leagueId, name: name.trim(), is_placeholder: false })
      .select("id")
      .single();
    if (!inserted?.id) {
      warnings.push(`Failed to create team: ${name}`);
      return { teamId: "", groupId: null };
    }
    resolvedTeamId = inserted.id;
    teamCache.set(name.trim().toLowerCase(), resolvedTeamId);
    isNew = true;
  } else {
    resolvedTeamId = existingId;
  }

  let groupId = await getTeamGroupId(supabase, resolvedTeamId);

  if (!groupId && groupHint) {
    groupId = groupMap.get(groupHint) ?? null;
    if (groupId) {
      await supabase
        .from("group_teams")
        .upsert({ group_id: groupId, team_id: resolvedTeamId }, { onConflict: "group_id,team_id" });
    }
  }

  if (!groupId) {
    warnings.push(
      isNew
        ? `Team "${name}" created but could not be assigned to a group — include a "group" field (e.g. "A") in the payload`
        : `Could not determine group for team "${name}"`
    );
  }

  return { teamId: resolvedTeamId, groupId };
}

async function recalcStandings(supabase: SupabaseClient, groupIds: Set<string>) {
  for (const groupId of groupIds) {
    await supabase.rpc("recalculate_group_standings", { p_group_id: groupId });
  }
}

// ─── Core importer ──────────────────────────────────────────────────────────

export async function importTournamentUpdate(
  leagueId: string,
  payload: TournamentUpdatePayload
): Promise<TournamentUpdateSummary> {
  const supabase = await createClient();
  const groupMap = await ensureGroups(supabase, leagueId);
  const teamCache = new Map<string, string>();
  const warnings: string[] = [];
  const dirtyGroups = new Set<string>();

  let resultsApplied = 0;
  let fixturesApplied = 0;
  let teamsCreated = 0;

  // Track existing team count to detect new creations
  const { count: teamsBefore } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId);

  // ── Results ──────────────────────────────────────────────────────────────
  for (const r of payload.results ?? []) {
    if (!r.home_team?.trim() || !r.away_team?.trim()) {
      warnings.push(`Skipping result with missing team name: ${JSON.stringify(r)}`);
      continue;
    }
    if (r.home_score == null || r.away_score == null || isNaN(Number(r.home_score)) || isNaN(Number(r.away_score))) {
      warnings.push(`Skipping result with missing scores: ${r.home_team} vs ${r.away_team}`);
      continue;
    }

    const groupHint = normalizeGroupName(r.group);
    const home = await findOrCreateTeam(supabase, leagueId, r.home_team, groupHint, groupMap, teamCache, warnings);
    const away = await findOrCreateTeam(supabase, leagueId, r.away_team, groupHint, groupMap, teamCache, warnings);

    if (!home.teamId || !away.teamId) continue;

    const groupId = home.groupId ?? away.groupId;
    if (!groupId) {
      warnings.push(`No group found for match: ${r.home_team} vs ${r.away_team} — skipping`);
      continue;
    }

    const homeScore = Number(r.home_score);
    const awayScore = Number(r.away_score);
    const winner = getWinnerFromScores(home.teamId, away.teamId, homeScore, awayScore);
    const status = normalizeStatus(r.status, "final");

    const { data: existing } = await supabase
      .from("group_matches")
      .select("id")
      .eq("league_id", leagueId)
      .eq("group_id", groupId)
      .eq("home_team_id", home.teamId)
      .eq("away_team_id", away.teamId)
      .maybeSingle();

    const payload_row = {
      league_id: leagueId,
      group_id: groupId,
      home_team_id: home.teamId,
      away_team_id: away.teamId,
      home_score: homeScore,
      away_score: awayScore,
      match_date: r.date ? new Date(r.date).toISOString() : null,
      status,
      is_draw: winner.isDraw,
      winner_team_id: winner.winnerTeamId,
      is_manual_override: true,
    };

    if (existing) {
      await supabase.from("group_matches").update(payload_row).eq("id", existing.id);
    } else {
      await supabase.from("group_matches").insert(payload_row);
    }

    dirtyGroups.add(groupId);
    resultsApplied++;
  }

  // ── Fixtures ─────────────────────────────────────────────────────────────
  for (const f of payload.fixtures ?? []) {
    if (!f.home_team?.trim() || !f.away_team?.trim()) {
      warnings.push(`Skipping fixture with missing team name: ${JSON.stringify(f)}`);
      continue;
    }

    const groupHint = normalizeGroupName(f.group);
    const home = await findOrCreateTeam(supabase, leagueId, f.home_team, groupHint, groupMap, teamCache, warnings);
    const away = await findOrCreateTeam(supabase, leagueId, f.away_team, groupHint, groupMap, teamCache, warnings);

    if (!home.teamId || !away.teamId) continue;

    const groupId = home.groupId ?? away.groupId;
    if (!groupId) {
      warnings.push(`No group found for fixture: ${f.home_team} vs ${f.away_team} — skipping`);
      continue;
    }

    const status = normalizeStatus(f.status, "upcoming");

    const { data: existing } = await supabase
      .from("group_matches")
      .select("id, status")
      .eq("league_id", leagueId)
      .eq("group_id", groupId)
      .eq("home_team_id", home.teamId)
      .eq("away_team_id", away.teamId)
      .maybeSingle();

    const payload_row = {
      league_id: leagueId,
      group_id: groupId,
      home_team_id: home.teamId,
      away_team_id: away.teamId,
      match_date: f.date ? new Date(f.date).toISOString() : null,
      status,
      is_manual_override: true,
    };

    if (existing) {
      // Don't downgrade a final back to upcoming
      if (existing.status !== "final") {
        await supabase.from("group_matches").update(payload_row).eq("id", existing.id);
      }
    } else {
      await supabase.from("group_matches").insert(payload_row);
      dirtyGroups.add(groupId);
      fixturesApplied++;
    }
  }

  await recalcStandings(supabase, dirtyGroups);

  const { count: teamsAfter } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId);

  teamsCreated = Math.max(0, (teamsAfter ?? 0) - (teamsBefore ?? 0));

  await supabase
    .from("leagues")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", leagueId);

  return {
    success: true,
    resultsApplied,
    fixturesApplied,
    teamsCreated,
    warnings,
  };
}

export function parseTournamentUpdatePayload(json: string): {
  payload?: TournamentUpdatePayload;
  error?: string;
} {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: "JSON must be an object with optional 'results' and 'fixtures' arrays" };
    }
    const obj = parsed as Record<string, unknown>;
    if (obj.results !== undefined && !Array.isArray(obj.results)) {
      return { error: "'results' must be an array" };
    }
    if (obj.fixtures !== undefined && !Array.isArray(obj.fixtures)) {
      return { error: "'fixtures' must be an array" };
    }
    if (!obj.results && !obj.fixtures) {
      return { error: "Payload must include at least one of 'results' or 'fixtures'" };
    }
    return { payload: parsed as TournamentUpdatePayload };
  } catch (e) {
    return { error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
}
