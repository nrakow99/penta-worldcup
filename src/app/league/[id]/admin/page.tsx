import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueDetails,
  getLeagueBracketData,
} from "@/lib/queries/league-queries";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { AdminPanel } from "@/components/admin/admin-panel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const details = await getLeagueDetails(id, user.id);
  if (!details) notFound();

  if (!details.isAdmin) {
    redirect(`/league/${id}`);
  }

  const { matches, teams } = await getLeagueBracketData(id);

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold text-zinc-100">Admin Panel</h1>
        <LeagueNav leagueId={id} isAdmin={true} />

        <div className="mt-6">
          <AdminPanel
            league={details.league}
            punishment={details.punishment}
            matches={matches}
            teams={teams}
          />
        </div>
      </main>
    </div>
  );
}
