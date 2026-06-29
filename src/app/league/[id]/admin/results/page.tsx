import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueDetails, getLeagueBracketData } from "@/lib/queries/league-queries";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { AdminResultsPanel } from "@/components/admin/admin-results-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminResultsPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const details = await getLeagueDetails(id, user.id);
  if (!details) notFound();
  if (!details.isAdmin) redirect(`/league/${id}`);

  const { matches, teams } = await getLeagueBracketData(id);

  const myMember = details.members.find((m) => m.user_id === user.id);
  const displayName = myMember?.profile?.display_name ?? undefined;

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar userName={displayName} />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">Match Results</h1>
          <p className="text-sm text-zinc-500">{details.league.name}</p>
        </div>
        <LeagueNav leagueId={id} isAdmin={true} />

        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-400">
          Click a team to mark it as the actual winner. Winners advance to the
          next round automatically. Use{" "}
          <span className="font-medium text-zinc-300">Reset</span> to undo a
          result — downstream results clear too. Scores are not required.
        </div>

        <div className="mt-6">
          <AdminResultsPanel
            leagueId={id}
            matches={matches}
            teams={teams}
          />
        </div>
      </main>
    </div>
  );
}
