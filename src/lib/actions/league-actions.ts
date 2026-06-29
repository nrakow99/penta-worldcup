"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils/invite-code";
import { createDefaultMatches, getNextMatchLink } from "@/lib/bracket/bracket-utils";

// ─── Shared admin guard ──────────────────────────────────────────────────────

async function requireLeagueAdmin(leagueId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase, user: null };

  const { data: league } = await supabase
    .from("leagues")
    .select("admin_id")
    .eq("id", leagueId)
    .single();
  if (!league) return { error: "League not found" as const, supabase, user: null };

  const { data: member } = await supabase
    .from("league_members")
    .select("role")
    .eq("league_id", leagueId)
    .eq("user_id", user.id)
    .single();

  const isAdmin = member?.role === "admin" || league.admin_id === user.id;
  if (!isAdmin) return { error: "Not authorized" as const, supabase, user: null };

  return { error: null, supabase, user };
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const displayName = formData.get("displayName") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) return { error: error.message };

  // Belt-and-suspenders: ensure profile exists if trigger didn't run
  if (data.user) {
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email,
      display_name: displayName,
    });
  }

  // Email confirmation enabled = no session yet; don't redirect to dashboard
  if (data.session) {
    redirect("/dashboard");
  }

  return {
    success: true,
    message:
      "Account created! Check your email and click the confirmation link, then sign in.",
  };
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createLeague(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const name = formData.get("name") as string;
  const lockDeadline = formData.get("lockDeadline") as string | null;
  const inviteCode = generateInviteCode();

  // Ensure profile exists (leagues.admin_id FK requires it)
  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email ?? "",
    display_name:
      (user.user_metadata?.display_name as string) ??
      user.email?.split("@")[0] ??
      "Player",
  });

  const { data: league, error } = await supabase
    .from("leagues")
    .insert({
      name,
      invite_code: inviteCode,
      admin_id: user.id,
      lock_deadline: lockDeadline || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Creator is auto-added as admin via DB trigger (handle_new_league).
  // Upsert here as a fallback if trigger hasn't run yet.
  await supabase.from("league_members").upsert(
    {
      league_id: league.id,
      user_id: user.id,
      role: "admin",
    },
    { onConflict: "league_id,user_id" }
  );

  const defaultMatches = createDefaultMatches(league.id);
  const { data: insertedMatches } = await supabase
    .from("matches")
    .insert(defaultMatches)
    .select();

  if (insertedMatches) {
    const matchByNumber = new Map(
      insertedMatches.map((m) => [m.match_number, m])
    );

    for (const match of insertedMatches) {
      const link = getNextMatchLink(match.match_number);
      if (link) {
        const nextMatch = matchByNumber.get(link.nextMatchNumber);
        if (nextMatch) {
          await supabase
            .from("matches")
            .update({
              next_match_id: nextMatch.id,
              next_match_slot: link.slot,
            })
            .eq("id", match.id);
        }
      }
    }
  }

  await supabase.from("brackets").insert({
    league_id: league.id,
    user_id: user.id,
  });

  revalidatePath("/dashboard");
  redirect(`/league/${league.id}`);
}

export async function joinLeague(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const inviteCode = (formData.get("inviteCode") as string).toUpperCase().trim();

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("invite_code", inviteCode)
    .single();

  if (leagueError || !league) return { error: "Invalid invite code" };

  const { data: existing } = await supabase
    .from("league_members")
    .select("id")
    .eq("league_id", league.id)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    redirect(`/league/${league.id}`);
  }

  const { error: memberError } = await supabase.from("league_members").insert({
    league_id: league.id,
    user_id: user.id,
    role: "member",
  });

  if (memberError) return { error: memberError.message };

  await supabase.from("brackets").insert({
    league_id: league.id,
    user_id: user.id,
  });

  revalidatePath("/dashboard");
  redirect(`/league/${league.id}`);
}

export async function saveBracketPicks(
  leagueId: string,
  bracketId: string,
  picks: { matchId: string; teamId: string; round: string }[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Verify the bracket belongs to this user
  const { data: bracket } = await supabase
    .from("brackets")
    .select("user_id")
    .eq("id", bracketId)
    .eq("league_id", leagueId)
    .single();

  if (!bracket) return { error: "Bracket not found" };
  if (bracket.user_id !== user.id) return { error: "Not your bracket" };

  const { data: league } = await supabase
    .from("leagues")
    .select("r32_ready, is_manually_locked, lock_deadline")
    .eq("id", leagueId)
    .single();

  if (!league) return { error: "League not found" };
  if (!league.r32_ready) return { error: "Bracket not open yet" };

  const isLocked =
    league.is_manually_locked ||
    (league.lock_deadline && new Date(league.lock_deadline) <= new Date());
  if (isLocked) return { error: "Bracket is locked" };

  if (picks.length === 0) return { success: true };

  // Batch upsert — single DB round trip
  const { error } = await supabase.from("bracket_picks").upsert(
    picks.map((p) => ({
      bracket_id: bracketId,
      match_id: p.matchId,
      picked_team_id: p.teamId,
      round: p.round as "r32" | "r16" | "qf" | "sf" | "final" | "champion",
    })),
    { onConflict: "bracket_id,match_id" }
  );

  if (error) return { error: error.message };

  revalidatePath(`/league/${leagueId}/bracket`);
  return { success: true };
}

export async function submitBracket(leagueId: string, bracketId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("brackets")
    .update({
      is_complete: true,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", bracketId);

  if (error) return { error: error.message };

  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}

export async function updateLeagueSettings(
  leagueId: string,
  data: {
    name?: string;
    lockDeadline?: string | null;
    isManuallyLocked?: boolean;
    status?: string;
  }
) {
  const { error: authError, supabase } = await requireLeagueAdmin(leagueId);
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("leagues")
    .update({
      name: data.name,
      lock_deadline: data.lockDeadline,
      is_manually_locked: data.isManuallyLocked,
      status: data.status as "open" | "locked" | "in_progress" | "finished" | undefined,
    })
    .eq("id", leagueId);

  if (error) return { error: error.message };

  if (data.isManuallyLocked) {
    await supabase
      .from("brackets")
      .update({ is_locked: true })
      .eq("league_id", leagueId);
  }

  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/admin`);
  return { success: true };
}

export async function setPunishment(leagueId: string, description: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("punishments").upsert(
    {
      league_id: leagueId,
      description,
      set_by: user.id,
    },
    { onConflict: "league_id" }
  );

  if (error) return { error: error.message };

  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}

export async function addComment(leagueId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("comments").insert({
    league_id: leagueId,
    user_id: user.id,
    content,
  });

  if (error) return { error: error.message };

  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}

export async function recordMatchResult(
  leagueId: string,
  matchId: string,
  winnerTeamId: string,
  teamAScore: number,
  teamBScore: number
) {
  const { error: authError, supabase, user } = await requireLeagueAdmin(leagueId);
  if (authError || !user) return { error: authError ?? "Not authorized" };

  await supabase
    .from("matches")
    .update({
      winner_team_id: winnerTeamId,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
    })
    .eq("id", matchId);

  await supabase.from("actual_results").upsert(
    {
      league_id: leagueId,
      match_id: matchId,
      winner_team_id: winnerTeamId,
      team_a_score: teamAScore,
      team_b_score: teamBScore,
      recorded_by: user.id,
    },
    { onConflict: "league_id,match_id" }
  );

  const { data: allResults } = await supabase
    .from("actual_results")
    .select("team_a_score, team_b_score")
    .eq("league_id", leagueId);

  const totalGoals = (allResults ?? []).reduce(
    (sum, r) => sum + r.team_a_score + r.team_b_score,
    0
  );

  await supabase
    .from("leagues")
    .update({ status: "in_progress", total_goals: totalGoals })
    .eq("id", leagueId);

  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/admin`);
  return { success: true };
}

export async function upsertTeam(
  leagueId: string,
  team: {
    id?: string;
    name: string;
    shortName?: string;
    flagEmoji?: string;
    isPlaceholder?: boolean;
    placeholderLabel?: string;
  }
) {
  const { error: authError, supabase } = await requireLeagueAdmin(leagueId);
  if (authError) return { error: authError };

  if (team.id) {
    const { error } = await supabase
      .from("teams")
      .update({
        name: team.name,
        short_name: team.shortName,
        flag_emoji: team.flagEmoji,
        is_placeholder: team.isPlaceholder ?? false,
        placeholder_label: team.placeholderLabel,
      })
      .eq("id", team.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("teams").insert({
      league_id: leagueId,
      name: team.name,
      short_name: team.shortName,
      flag_emoji: team.flagEmoji,
      is_placeholder: team.isPlaceholder ?? false,
      placeholder_label: team.placeholderLabel,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/league/${leagueId}/admin`);
  return { success: true };
}

export async function updateMatchTeams(
  matchId: string,
  leagueId: string,
  data: {
    teamAId?: string | null;
    teamBId?: string | null;
    teamAPlaceholder?: string;
    teamBPlaceholder?: string;
  }
) {
  const { error: authError, supabase } = await requireLeagueAdmin(leagueId);
  if (authError) return { error: authError };

  const { error } = await supabase
    .from("matches")
    .update({
      team_a_id: data.teamAId,
      team_b_id: data.teamBId,
      team_a_placeholder: data.teamAPlaceholder,
      team_b_placeholder: data.teamBPlaceholder,
    })
    .eq("id", matchId);

  if (error) return { error: error.message };

  revalidatePath(`/league/${leagueId}/admin`);
  return { success: true };
}

export async function resetBracketData(leagueId: string) {
  const { error: authError, supabase } = await requireLeagueAdmin(leagueId);
  if (authError) return { error: authError };

  const { data: brackets } = await supabase
    .from("brackets")
    .select("id")
    .eq("league_id", leagueId);

  if (brackets) {
    for (const bracket of brackets) {
      await supabase.from("bracket_picks").delete().eq("bracket_id", bracket.id);
    }
    await supabase
      .from("brackets")
      .update({ is_complete: false, is_locked: false, submitted_at: null })
      .eq("league_id", leagueId);
  }

  await supabase.from("actual_results").delete().eq("league_id", leagueId);
  await supabase
    .from("matches")
    .update({
      winner_team_id: null,
      team_a_score: null,
      team_b_score: null,
    })
    .eq("league_id", leagueId);

  await supabase
    .from("leagues")
    .update({ status: "open", total_goals: 0, is_manually_locked: false })
    .eq("id", leagueId);

  revalidatePath(`/league/${leagueId}`);
  return { success: true };
}
