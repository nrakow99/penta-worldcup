import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLeagueDetails, getLeaderboard, getComments } from "@/lib/queries/league-queries";
import {
  canFillBracket,
  getBracketState,
  BRACKET_STATE_LABELS,
  BRACKET_STATE_COLORS,
} from "@/lib/tournament/bracket-status";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CountdownTimer } from "@/components/league/countdown-timer";
import { Leaderboard, LoserAlert } from "@/components/league/leaderboard";
import { PunishmentCard } from "@/components/league/punishment-card";
import { CommentWall } from "@/components/league/comment-wall";
import { ConfettiCelebration } from "@/components/ui/confetti";
import { Trophy, Users, Settings, ClipboardList } from "lucide-react";
import type { Profile } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS = BRACKET_STATE_LABELS;
const STATUS_COLORS = BRACKET_STATE_COLORS;

export default async function LeagueDashboardPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const details = await getLeagueDetails(id, user.id);
  if (!details) notFound();

  const { league, members, punishment, isAdmin, isLocked } = details;
  const { scores, worst, winner, punishmentRecipient } = await getLeaderboard(id);
  const comments = await getComments(id);

  const bracketState = getBracketState(league);
  const canFill = canFillBracket(league);
  const showConfetti = league.status === "finished";

  const myMember = members.find((m) => m.user_id === user.id);
  const displayName = myMember?.profile?.display_name ?? undefined;

  return (
    <div className="min-h-full bg-zinc-950">
      <ConfettiCelebration trigger={showConfetti} type="winner" />
      <Navbar userName={displayName} />

      <main className="mx-auto max-w-4xl px-4 py-6">
        <LeagueNav leagueId={id} isAdmin={isAdmin} />

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {/* ── Left / main column ─────────────────────────────────────────── */}
          <div className="space-y-4 lg:col-span-2">

            {/* Hero card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-zinc-100">{league.name}</h1>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Invite code:{" "}
                    <code className="text-emerald-400">{league.invite_code}</code>
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_COLORS[bracketState]}`}
                >
                  {STATUS_LABELS[bracketState]}
                </span>
              </div>

              {league.lock_deadline && !isLocked && (
                <div className="mt-3 border-t border-zinc-800 pt-3">
                  <CountdownTimer deadline={league.lock_deadline} />
                </div>
              )}
              {isLocked && (
                <p className="mt-3 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                  🔒 Bracket is locked — no more pick changes allowed.
                </p>
              )}
            </div>

            {/* Primary CTA */}
            {canFill && (
              <Link href={`/league/${id}/bracket`}>
                <Button className="w-full py-3 text-base">
                  Fill Out Your Bracket →
                </Button>
              </Link>
            )}

            {bracketState === "locked" && (
              <Link href={`/league/${id}/bracket`}>
                <Button variant="secondary" className="w-full">
                  View My Bracket
                </Button>
              </Link>
            )}

            {bracketState === "not_open" && (
              <div className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-4 py-3">
                <p className="text-sm font-medium text-amber-300">
                  Bracket not open yet
                </p>
                <p className="mt-0.5 text-xs text-amber-600">
                  The admin will open the bracket when it&apos;s ready.
                </p>
              </div>
            )}

            {/* Leaderboard */}
            <Leaderboard scores={scores} highlightUserId={user.id} />

            {/* View other brackets (after lock) */}
            {bracketState === "locked" && members.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>View Brackets</CardTitle>
                </CardHeader>
                <div className="space-y-1">
                  {members.map((member) => {
                    const profile = member.profile as Profile | undefined;
                    return (
                      <Link
                        key={member.user_id}
                        href={`/league/${id}/bracket/${member.user_id}`}
                        className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
                      >
                        <span className="text-zinc-200">
                          {profile?.display_name ?? "Unknown"}
                          {member.user_id === user.id && (
                            <span className="ml-2 text-emerald-400">(you)</span>
                          )}
                        </span>
                        <span className="text-zinc-500">View →</span>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Shit-talk wall */}
            <CommentWall leagueId={id} comments={comments} />
          </div>

          {/* ── Right sidebar ───────────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* Winner banner */}
            {league.status === "finished" && winner && (
              <div className="rounded-xl border border-yellow-600 bg-yellow-950/30 px-4 py-4 text-center">
                <Trophy className="mx-auto h-6 w-6 text-yellow-400" />
                <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-yellow-500">
                  Winner
                </p>
                <p className="mt-1 text-lg font-bold text-zinc-100">
                  {winner.displayName}
                </p>
                <p className="text-sm text-yellow-400">
                  {winner.totalPoints} pts
                </p>
              </div>
            )}

            {/* Admin quick links */}
            {isAdmin && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Admin
                </p>
                <div className="space-y-2">
                  <Link
                    href={`/league/${id}/admin`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-zinc-500" />
                    League Settings
                  </Link>
                  <Link
                    href={`/league/${id}/admin/results`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    <ClipboardList className="h-4 w-4 text-zinc-500" />
                    Enter Results
                  </Link>
                </div>
              </div>
            )}

            {/* Players */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-zinc-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  Players ({members.length})
                </span>
              </div>
              <div className="space-y-1">
                {members.map((member) => {
                  const profile = member.profile as Profile | undefined;
                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-2 rounded px-2 py-1"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-zinc-300">
                        {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <span className="flex-1 truncate text-sm text-zinc-300">
                        {profile?.display_name ?? "Unknown"}
                        {member.user_id === user.id && (
                          <span className="ml-1 text-emerald-400"> (you)</span>
                        )}
                      </span>
                      {member.role === "admin" && (
                        <span className="text-[10px] text-zinc-600">admin</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Punishment */}
            <PunishmentCard
              punishment={punishment}
              recipientName={punishmentRecipient?.displayName}
            />

            {/* Loser alert */}
            <LoserAlert worst={worst} />
          </div>
        </div>
      </main>
    </div>
  );
}
