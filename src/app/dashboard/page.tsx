import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserLeagues } from "@/lib/queries/league-queries";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Users } from "lucide-react";
import type { League } from "@/lib/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName = (profile as { display_name: string } | null)?.display_name;

  const memberships = await getUserLeagues(user.id);

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar userName={displayName} />

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Your Leagues</h1>
            <p className="text-sm text-zinc-500">
              Manage your World Cup bracket challenges
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/league/join">
              <Button variant="secondary" size="sm">
                <Users className="mr-1 h-4 w-4" />
                Join League
              </Button>
            </Link>
            <Link href="/league/create">
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Create League
              </Button>
            </Link>
          </div>
        </div>

        {memberships.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-zinc-400">You&apos;re not in any leagues yet.</p>
            <p className="mt-2 text-sm text-zinc-500">
              Create one for your roommates or join with an invite code.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/league/create">
                <Button>Create League</Button>
              </Link>
              <Link href="/league/join">
                <Button variant="secondary">Join League</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {memberships.map((membership) => {
              const league = membership.leagues as League;
              return (
                <Link key={league.id} href={`/league/${league.id}`}>
                  <Card className="transition-colors hover:border-emerald-500/50 hover:bg-zinc-900">
                    <CardHeader>
                      <CardTitle className="text-lg normal-case text-zinc-100">
                        {league.name}
                      </CardTitle>
                      <Badge status={league.status} />
                    </CardHeader>
                    <p className="text-xs text-zinc-500">
                      Code: {league.invite_code}
                      {membership.role === "admin" && (
                        <span className="ml-2 text-emerald-400">Admin</span>
                      )}
                    </p>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
