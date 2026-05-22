import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueDetails,
  getLeaderboard,
  getComments,
} from "@/lib/queries/league-queries";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { CountdownTimer } from "@/components/league/countdown-timer";
import { Leaderboard, LoserAlert } from "@/components/league/leaderboard";
import { PunishmentCard } from "@/components/league/punishment-card";
import { CommentWall } from "@/components/league/comment-wall";
import { ConfettiCelebration } from "@/components/ui/confetti";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import type { Profile } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

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
  const { scores, worst, winner, punishmentRecipient } =
    await getLeaderboard(id);
  const comments = await getComments(id);

  const showConfetti = league.status === "finished";

  return (
    <div className="min-h-full bg-zinc-950">
      <ConfettiCelebration trigger={showConfetti} type="winner" />
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-100">{league.name}</h1>
            <Badge status={league.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Invite code:{" "}
            <code className="text-emerald-400">{league.invite_code}</code>
          </p>
        </div>

        <LeagueNav leagueId={id} isAdmin={isAdmin} />

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {!isLocked && league.lock_deadline && (
              <Card>
                <CountdownTimer deadline={league.lock_deadline} />
              </Card>
            )}

            <Leaderboard scores={scores} highlightUserId={user.id} />

            {!isLocked && (
              <Link href={`/league/${id}/bracket`}>
                <Button className="w-full">Fill Out Your Bracket</Button>
              </Link>
            )}

            {isLocked && (
              <Card>
                <CardHeader>
                  <CardTitle>View Brackets</CardTitle>
                </CardHeader>
                <div className="space-y-2">
                  {members.map((member) => {
                    const profile = member.profile as Profile | undefined;
                    return (
                      <Link
                        key={member.user_id}
                        href={`/league/${id}/bracket/${member.user_id}`}
                        className="flex items-center justify-between rounded-lg bg-zinc-800/50 px-3 py-2 text-sm hover:bg-zinc-800"
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

            <CommentWall leagueId={id} comments={comments} />
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Players ({members.length})
                </CardTitle>
              </CardHeader>
              <div className="space-y-1">
                {members.map((member) => {
                  const profile = member.profile as Profile | undefined;
                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-medium text-zinc-300">
                        {profile?.display_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <span className="text-zinc-300">
                        {profile?.display_name ?? "Unknown"}
                      </span>
                      {member.role === "admin" && (
                        <span className="text-xs text-emerald-400">admin</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            <LoserAlert worst={worst} />

            <PunishmentCard
              punishment={punishment}
              recipientName={punishmentRecipient?.displayName}
            />

            {league.status === "finished" && winner && (
              <Card variant="success">
                <CardHeader>
                  <CardTitle className="text-emerald-400">🏆 Champion</CardTitle>
                </CardHeader>
                <p className="text-lg font-bold text-zinc-100">
                  {winner.displayName}
                </p>
                <p className="text-sm text-zinc-400">
                  {winner.totalPoints} points
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
