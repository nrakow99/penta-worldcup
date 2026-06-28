import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getLeagueDetails,
  getLeagueBracketData,
} from "@/lib/queries/league-queries";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { AdminPanel } from "@/components/admin/admin-panel";
import { ApiSyncPanel } from "@/components/admin/api-sync-panel";
import { DataImportPanel } from "@/components/admin/data-import-panel";
import { getSyncStatus } from "@/lib/api-football/sync";

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
  const syncStatus = await getSyncStatus(id);

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold text-zinc-100">Admin Panel</h1>
        <LeagueNav leagueId={id} isAdmin={true} />

        <div className="mt-6 space-y-6">
          {/* Quick link to the dedicated update page */}
          <Link
            href={`/league/${id}/admin/tournament-update`}
            className="flex items-center justify-between rounded-xl border border-indigo-700/60 bg-indigo-950/30 px-5 py-4 hover:border-indigo-500 hover:bg-indigo-950/50 transition-colors"
          >
            <div>
              <p className="font-semibold text-indigo-300">Tournament Update</p>
              <p className="mt-0.5 text-sm text-indigo-400/70">
                Paste JSON from screenshots · enter results · schedule fixtures
              </p>
            </div>
            <span className="text-indigo-400 text-lg">→</span>
          </Link>

          <ApiSyncPanel
            leagueId={id}
            configured={syncStatus.configured}
            lastSyncedAt={syncStatus.lastSyncedAt}
            callsUsedToday={syncStatus.callsUsedToday}
            dailyLimit={syncStatus.dailyLimit}
            recentLogs={syncStatus.recentLogs}
          />
          <DataImportPanel leagueId={id} />
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
