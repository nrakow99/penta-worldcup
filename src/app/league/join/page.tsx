import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/navbar";
import { JoinLeagueForm } from "@/components/league/join-league-form";

export default async function JoinLeaguePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Pre-fetch the user's current display name so the form can decide
  // whether the field is pre-filled (returning user) or required (new user).
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const existingName =
    (profile as { display_name: string | null } | null)?.display_name ?? "";

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar userName={existingName || undefined} />
      <main className="mx-auto max-w-md px-4 py-8">
        <JoinLeagueForm existingDisplayName={existingName} />
      </main>
    </div>
  );
}
