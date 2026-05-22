import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueDetails,
  getLeagueBracketData,
  getUserBracket,
} from "@/lib/queries/league-queries";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { BracketBuilder } from "@/components/bracket/bracket-builder";

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

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold text-zinc-100">My Bracket</h1>
        <LeagueNav leagueId={id} isAdmin={details.isAdmin} />

        <div className="mt-6">
          <BracketBuilder
            leagueId={id}
            bracketId={userBracket.bracket.id}
            matches={matches}
            initialPicks={userBracket.picks}
            teams={teams}
            isLocked={details.isLocked}
          />
        </div>
      </main>
    </div>
  );
}
