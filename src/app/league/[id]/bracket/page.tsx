import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueDetails,
  getLeagueBracketData,
  getUserBracket,
} from "@/lib/queries/league-queries";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { BracketBuilder } from "@/components/bracket/bracket-builder";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { canFillBracket, getBracketAvailability, BRACKET_STATUS_LABELS } from "@/lib/tournament/bracket-status";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MyBracketPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const details = await getLeagueDetails(id, user.id);
  if (!details) notFound();

  const { matches, teams } = await getLeagueBracketData(id);
  const userBracket = await getUserBracket(id, user.id);

  if (!userBracket) notFound();

  const availability = getBracketAvailability(details.league);
  const canEdit = canFillBracket(details.league);

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold text-zinc-100">My Bracket</h1>
        <LeagueNav leagueId={id} isAdmin={details.isAdmin} />

        <div className="mt-6">
          {!canEdit && !details.isLocked ? (
            <Card className="text-center py-12">
              <p className="text-lg font-medium text-amber-300">
                Bracket not open yet
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Status: {BRACKET_STATUS_LABELS[availability]}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                The admin must confirm Round of 32 matchups before you can
                fill out your bracket.
              </p>
              <Link href={`/league/${id}/groups`} className="mt-4 inline-block">
                <Button variant="secondary">View Group Stage</Button>
              </Link>
            </Card>
          ) : (
            <BracketBuilder
              leagueId={id}
              bracketId={userBracket.bracket.id}
              matches={matches}
              initialPicks={userBracket.picks}
              teams={teams}
              isLocked={details.isLocked || !canEdit}
            />
          )}
        </div>
      </main>
    </div>
  );
}
