"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils/invite-code";
import { createDefaultMatches, getNextMatchLink } from "@/lib/bracket/bracket-utils";
// Type alias for the Supabase client — avoids re-importing the function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

interface MatchSnap {
  id: string;
  match_number: number;
  team_a_id: string | null;
  team_b_id: string | null;
  winner_team_id: string | null;
}

/**
 * Recursively clear the team slot (and winner if applicable) that was
 * populated by the winning team propagated from `matchNumber`.
 * Only clears downstream — does NOT touch `matchNumber` itself.
 */
async function cascadeClearDownstream(
  supabase: DbClient,
  leagueId: string,
  matchNumber: number,
  matchByNumber: Map<number, MatchSnap>
): Promise<void> {
  const link = getNextMatchLink(matchNumber);
  if (!link) return;

  const nextMatch = matchByNumber.get(link.nextMatchNumber);
  if (!nextMatch) return;

  const slotField = link.slot === "a" ? "team_a_id" : "team_b_id";
  const slotTeamId = nextMatch[slotField];

  const updates: Record<string, null> = { [slotField]: null };

  // If the next match's WINNER is the same team that was in this slot,
  // also clear the winner and keep cascading.
  const winnerWasThisSlot =
    slotTeamId !== null && nextMatch.winner_team_id === slotTeamId;

  if (winnerWasThisSlot) {
    updates.winner_team_id = null;
    await supabase
      .from("actual_results")
      .delete()
      .eq("league_id", leagueId)
      .eq("match_id", nextMatch.id);
    await cascadeClearDownstream(
      supabase,
      leagueId,
      link.nextMatchNumber,
      matchByNumber
    );
  }

  await supabase.from("matches").update(updates).eq("id", nextMatch.id);
}
import {
  WORLD_CUP_2026_TEAMS,
  SEEDED_R32_MATCHUPS,
} from "@/lib/bracket/seeded-teams";

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

  // ── Seed all 32 World Cup teams for this league ───────────────────────────
  const { data: insertedTeams } = await supabase
    .from("teams")
    .insert(
      WORLD_CUP_2026_TEAMS.map((t) => ({
        league_id: league.id,
        name: t.name,
        flag_emoji: t.flagEmoji,
        is_placeholder: false,
      }))
    )
    .select();

  // Build name → id lookup for quick match assignment
  const teamByName = new Map(
    (insertedTeams ?? []).map((t) => [t.name as string, t.id as string])
  );

  // ── Create all 31 bracket matches ──────────────────────────────────────────
  const defaultMatches = createDefaultMatches(league.id);
  const { data: insertedMatches } = await supabase
    .from("matches")
    .insert(defaultMatches)
    .select();

  if (insertedMatches) {
    const matchByNumber = new Map(
      insertedMatches.map((m) => [m.match_number as number, m])
    );

    // ── Link next_match_id and pre-populate R32 teams in a single pass ─────
    for (const match of insertedMatches) {
      const num = match.match_number as number;
      const link = getNextMatchLink(num);
      const r32Pair = SEEDED_R32_MATCHUPS[num];

      const updates: Record<string, unknown> = {};

      if (link) {
        const nextMatch = matchByNumber.get(link.nextMatchNumber);
        if (nextMatch) {
          updates.next_match_id = nextMatch.id;
          updates.next_match_slot = link.slot;
        }
      }

      if (r32Pair) {
        const [nameA, nameB] = r32Pair;
        const idA = teamByName.get(nameA);
        const idB = teamByName.get(nameB);
        if (idA) {
          updates.team_a_id = idA;
          updates.team_a_placeholder = null;
        }
        if (idB) {
          updates.team_b_id = idB;
          updates.team_b_placeholder = null;
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("matches").update(updates).eq("id", match.id);
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
  const rawName = (formData.get("displayName") as string | null) ?? "";
  const displayName = rawName.trim();

  // Validate display name if provided
  if (displayName && (displayName.length < 2 || displayName.length > 20)) {
    return { error: "Display name must be 2–20 characters" };
  }

  const { data: league, error: leagueError } = await supabase
    .from("leagues")
    .select("*")
    .eq("invite_code", inviteCode)
    .single();

  if (leagueError || !league) return { error: "Invalid invite code" };

  // Save display name before anything else (so errors don't leave it unset)
  if (displayName) {
    await supabase.from("profiles").upsert(
      { id: user.id, email: user.email ?? "", display_name: displayName },
      { onConflict: "id" }
    );
  }

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

export async function setDisplayName(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const displayName = ((formData.get("displayName") as string) ?? "").trim();

  if (displayName.length < 2 || displayName.length > 20) {
    return { error: "Display name must be 2–20 characters" };
  }

  const { error } = await supabase.from("profiles").upsert(
    { id: user.id, email: user.email ?? "", display_name: displayName },
    { onConflict: "id" }
  );

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { success: true };
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

/**
 * Set the actual winner of a match.
 *
 * - No scores required or stored.
 * - If the match already has a winner (admin is changing it), cascade-clears
 *   all downstream actual results that depended on the old winner first.
 * - Then propagates the new winner into the next round's team slot so the
 *   admin can immediately enter subsequent-round results.
 * - Recalculates leaderboard points via revalidatePath.
 */
export async function recordMatchResult(
  leagueId: string,
  matchId: string,
  winnerTeamId: string
) {
  const { error: authError, supabase, user } = await requireLeagueAdmin(leagueId);
  if (authError || !user) return { error: authError ?? "Not authorized" };

  // Load all matches once for cascade logic
  const { data: allMatchRows } = await supabase
    .from("matches")
    .select("id, match_number, team_a_id, team_b_id, winner_team_id")
    .eq("league_id", leagueId);

  const allMatches = (allMatchRows ?? []) as MatchSnap[];
  const matchByNumber = new Map(allMatches.map((m) => [m.match_number, m]));
  const thisMatch = allMatches.find((m) => m.id === matchId);

  if (!thisMatch) return { error: "Match not found" };

  // If already has a winner (changing winner), clear the old downstream chain
  if (thisMatch.winner_team_id) {
    await cascadeClearDownstream(
      supabase,
      leagueId,
      thisMatch.match_number,
      matchByNumber
    );
  }

  // Set new winner on this match
  await supabase
    .from("matches")
    .update({ winner_team_id: winnerTeamId })
    .eq("id", matchId);

  // Propagate winner into the next round's team slot
  const link = getNextMatchLink(thisMatch.match_number);
  if (link) {
    const nextMatch = matchByNumber.get(link.nextMatchNumber);
    if (nextMatch) {
      const slotUpdate =
        link.slot === "a"
          ? { team_a_id: winnerTeamId, team_a_placeholder: null }
          : { team_b_id: winnerTeamId, team_b_placeholder: null };
      await supabase.from("matches").update(slotUpdate).eq("id", nextMatch.id);
    }
  }

  // Mirror to actual_results audit table
  await supabase.from("actual_results").upsert(
    {
      league_id: leagueId,
      match_id: matchId,
      winner_team_id: winnerTeamId,
      team_a_score: 0,
      team_b_score: 0,
      recorded_by: user.id,
    },
    { onConflict: "league_id,match_id" }
  );

  // Mark league as in_progress
  await supabase
    .from("leagues")
    .update({ status: "in_progress" })
    .eq("id", leagueId);

  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/admin/results`);
  return { success: true };
}

/**
 * Remove the actual winner from a match and cascade-clear all downstream
 * actual results that depended on it.
 */
export async function clearMatchResult(leagueId: string, matchId: string) {
  const { error: authError, supabase } = await requireLeagueAdmin(leagueId);
  if (authError) return { error: authError };

  // Load all matches for cascade
  const { data: allMatchRows } = await supabase
    .from("matches")
    .select("id, match_number, team_a_id, team_b_id, winner_team_id")
    .eq("league_id", leagueId);

  const allMatches = (allMatchRows ?? []) as MatchSnap[];
  const matchByNumber = new Map(allMatches.map((m) => [m.match_number, m]));
  const thisMatch = allMatches.find((m) => m.id === matchId);

  if (!thisMatch) return { error: "Match not found" };

  // Cascade-clear downstream slots/winners that depended on this match
  await cascadeClearDownstream(
    supabase,
    leagueId,
    thisMatch.match_number,
    matchByNumber
  );

  // Clear this match's own winner
  await supabase
    .from("matches")
    .update({ winner_team_id: null })
    .eq("id", matchId);

  await supabase
    .from("actual_results")
    .delete()
    .eq("league_id", leagueId)
    .eq("match_id", matchId);

  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/admin/results`);
  return { success: true };
}

export async function deleteLeague(leagueId: string) {
  const { error: authError, supabase } = await requireLeagueAdmin(leagueId);
  if (authError) return { error: authError };

  // Collect bracket ids first so we can remove bracket_picks
  const { data: brackets } = await supabase
    .from("brackets")
    .select("id")
    .eq("league_id", leagueId);

  if (brackets && brackets.length > 0) {
    const ids = brackets.map((b) => b.id as string);
    await supabase.from("bracket_picks").delete().in("bracket_id", ids);
  }

  // Delete everything in FK-safe order
  await supabase.from("actual_results").delete().eq("league_id", leagueId);
  await supabase.from("comments").delete().eq("league_id", leagueId);
  await supabase.from("punishments").delete().eq("league_id", leagueId);
  await supabase.from("brackets").delete().eq("league_id", leagueId);
  await supabase.from("matches").delete().eq("league_id", leagueId);
  await supabase.from("teams").delete().eq("league_id", leagueId);
  await supabase.from("league_members").delete().eq("league_id", leagueId);

  const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  redirect("/dashboard");
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
