import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueDetails,
  getLeagueBracketData,
  getUserBracket,
} from "@/lib/queries/league-queries";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { BracketTree } from "@/components/bracket/bracket-tree";

interface PageProps {
  params: Promise<{ id: string; userId: string }>;
}

export default async function ViewBracketPage({ params }: PageProps) {
  const { id, userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const details = await getLeagueDetails(id, user.id);
  if (!details) notFound();

  // Can only view others' brackets when locked (unless viewing own)
  if (!details.isLocked && userId !== user.id) {
    redirect(`/league/${id}/bracket`);
  }

  const { matches, teams } = await getLeagueBracketData(id);
  const userBracket = await getUserBracket(id, userId);

  if (!userBracket) notFound();

  const { data: profileData } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .single();

  const profile = profileData as { display_name: string } | null;

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold text-zinc-100">
          {profile?.display_name ?? "Unknown"}&apos;s Bracket
        </h1>
        <LeagueNav leagueId={id} isAdmin={details.isAdmin} />

        <div className="mt-6">
          <BracketTree
            matches={matches}
            picks={userBracket.picks}
            teams={teams}
            isLocked={true}
            isReadOnly={true}
            showResults={details.league.status !== "open"}
          />
        </div>
      </main>
    </div>
  );
}
