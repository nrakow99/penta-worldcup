import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/navbar";
import { DisplayNameForm } from "@/components/profile/display-name-form";
import { Card } from "@/components/ui/card";
import { UserCircle } from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    (profile as { display_name: string | null } | null)?.display_name ?? "";

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar userName={displayName} />
      <main className="mx-auto max-w-md px-4 py-8">
        <Card>
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800">
              <UserCircle className="h-6 w-6 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-100">Settings</h1>
              <p className="text-sm text-zinc-500">{user.email}</p>
            </div>
          </div>

          <div className="border-t border-zinc-800 pt-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Display Name
            </h2>
            <DisplayNameForm currentName={displayName} />
          </div>
        </Card>
      </main>
    </div>
  );
}
