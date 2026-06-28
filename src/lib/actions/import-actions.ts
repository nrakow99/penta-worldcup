"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { runImport } from "@/lib/import/importers";
import type { ImportType } from "@/lib/import/templates";

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

export async function importGroupStageData(formData: FormData) {
  const leagueId = formData.get("leagueId") as string;
  const importType = formData.get("importType") as ImportType;
  const file = formData.get("file") as File | null;

  if (!leagueId || !importType || !file) {
    return { error: "Missing league, import type, or file" };
  }

  const auth = await requireAdmin(leagueId);
  if (auth.error) return { error: auth.error };

  const content = await file.text();
  const result = await runImport(leagueId, importType, content, file.name);

  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/groups`);
  revalidatePath(`/league/${leagueId}/admin`);

  if (!result.success) return { error: result.error ?? result.message };

  return { success: true, message: result.message };
}
