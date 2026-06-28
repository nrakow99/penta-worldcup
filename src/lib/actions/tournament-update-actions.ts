"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  importTournamentUpdate,
  parseTournamentUpdatePayload,
  type TournamentResultInput,
  type TournamentFixtureInput,
  type TournamentUpdateSummary,
} from "@/lib/import/tournament-update";

async function requireAdmin(leagueId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  const { data: member } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  if (member?.role === "admin") return { error: null };

  const { data: league } = await supabase
    .from("leagues")
    .select("admin_id")
    .eq("id", leagueId)
    .single();

  if (league?.admin_id !== user.id) {
    return { error: "Not authorized" as const };
  }

  return { error: null };
}

function paths(leagueId: string) {
  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/groups`);
  revalidatePath(`/league/${leagueId}/admin`);
  revalidatePath(`/league/${leagueId}/admin/tournament-update`);
}

// ─── Bulk JSON paste ────────────────────────────────────────────────────────

export async function applyTournamentUpdateJson(
  leagueId: string,
  json: string
): Promise<TournamentUpdateSummary | { error: string }> {
  const auth = await requireAdmin(leagueId);
  if (auth.error) return { error: auth.error };

  const { payload, error } = parseTournamentUpdatePayload(json);
  if (error || !payload) return { error: error ?? "Parse failed" };

  const result = await importTournamentUpdate(leagueId, payload);
  paths(leagueId);
  return result;
}

// ─── Single result ───────────────────────────────────────────────────────────

export async function addSingleResult(
  leagueId: string,
  data: Omit<TournamentResultInput, "status"> & { status?: string }
): Promise<TournamentUpdateSummary | { error: string }> {
  const auth = await requireAdmin(leagueId);
  if (auth.error) return { error: auth.error };

  const result = await importTournamentUpdate(leagueId, {
    results: [{ ...data, status: data.status ?? "final" }],
  });
  paths(leagueId);
  return result;
}

// ─── Single fixture ──────────────────────────────────────────────────────────

export async function addSingleFixture(
  leagueId: string,
  data: TournamentFixtureInput
): Promise<TournamentUpdateSummary | { error: string }> {
  const auth = await requireAdmin(leagueId);
  if (auth.error) return { error: auth.error };

  const result = await importTournamentUpdate(leagueId, { fixtures: [data] });
  paths(leagueId);
  return result;
}
