"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setR32Ready(leagueId: string, ready: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
    if (league?.admin_id !== user.id) return { error: "Not authorized" };
  }

  const { error } = await supabase
    .from("leagues")
    .update({ r32_ready: ready })
    .eq("id", leagueId);

  if (error) return { error: error.message };

  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/bracket`);
  revalidatePath(`/league/${leagueId}/admin`);
  return { success: true };
}
