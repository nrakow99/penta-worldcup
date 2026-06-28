"use server";

import { revalidatePath } from "next/cache";
import { syncWorldCupData } from "@/lib/api-football/sync";
import { createClient } from "@/lib/supabase/server";

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

export async function syncWorldCupFromApi(leagueId: string) {
  const auth = await requireAdmin(leagueId);
  if (auth.error) return { error: auth.error };

  const result = await syncWorldCupData(leagueId);

  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/groups`);
  revalidatePath(`/league/${leagueId}/admin`);
  revalidatePath(`/league/${leagueId}/admin/knockout-setup`);

  if (!result.success) {
    return {
      error: result.error ?? result.message,
      callsUsed: result.callsUsed,
      freePlanBlocked: result.freePlanBlocked,
    };
  }

  return {
    success: true,
    message: result.message,
    callsUsed: result.callsUsed,
  };
}
