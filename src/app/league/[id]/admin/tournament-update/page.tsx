import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueDetails } from "@/lib/queries/league-queries";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { TournamentUpdatePanel } from "@/components/admin/tournament-update-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentUpdatePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const details = await getLeagueDetails(id, user.id);
  if (!details) notFound();
  if (!details.isAdmin) redirect(`/league/${id}`);

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Tournament Update</h1>
            <p className="mt-0.5 text-sm text-zinc-400">{details.league.name}</p>
          </div>
        </div>

        <LeagueNav leagueId={id} isAdmin={true} />

        <div className="mt-6">
          <TournamentUpdatePanel leagueId={id} />
        </div>

        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="mb-2 text-sm font-semibold text-zinc-300">Workflow tip</p>
          <ol className="space-y-1.5 text-sm text-zinc-400 list-decimal list-inside">
            <li>Take a screenshot of current World Cup standings or results.</li>
            <li>Ask an AI (or type manually) to produce JSON in the format shown in the Paste JSON tab.</li>
            <li>Paste the JSON and click <strong className="text-zinc-200">Apply Update</strong>.</li>
            <li>Standings are recalculated instantly. New teams are auto-created.</li>
            <li>Check the <a href={`/league/${id}/groups`} className="text-indigo-400 hover:underline">Groups page</a> to verify.</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
