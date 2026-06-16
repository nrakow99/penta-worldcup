import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLeagueDetails, getLeagueBracketData } from "@/lib/queries/league-queries";
import { getGroupStageData, getUpcomingFixtures } from "@/lib/queries/group-queries";
import { Navbar, LeagueNav } from "@/components/layout/navbar";
import { GroupStageTabs } from "@/components/groups/group-stage-tabs";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupsPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const details = await getLeagueDetails(id, user.id);
  if (!details) notFound();

  const [{ groups, groupTeams, matches, standings }, { teams }] =
    await Promise.all([
      getGroupStageData(id),
      getLeagueBracketData(id),
    ]);

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="mb-4 text-2xl font-bold text-zinc-100">Group Stage</h1>
        <LeagueNav leagueId={id} isAdmin={details.isAdmin} />

        <div className="mt-6">
          <GroupStageTabs
            leagueId={id}
            isAdmin={details.isAdmin}
            groups={groups}
            groupTeams={groupTeams}
            matches={matches}
            standings={standings}
            teams={teams.map((t) => ({
              id: t.id,
              name: t.name,
              flag_emoji: t.flag_emoji,
            }))}
          />
        </div>
      </main>
    </div>
  );
}
