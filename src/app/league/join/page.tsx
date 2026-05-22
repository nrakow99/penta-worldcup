"use client";

import { useActionState } from "react";
import { joinLeague } from "@/lib/actions/league-actions";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function JoinLeaguePage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return (await joinLeague(formData)) ?? null;
    },
    null
  );

  return (
    <div className="min-h-full bg-zinc-950">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-8">
        <Card>
          <h1 className="mb-1 text-xl font-bold text-zinc-100">Join League</h1>
          <p className="mb-6 text-sm text-zinc-500">
            Enter the invite code from your league admin
          </p>

          <form action={formAction} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">
                Invite Code
              </label>
              <Input
                name="inviteCode"
                required
                placeholder="ABCD1234"
                className="uppercase tracking-widest"
                maxLength={8}
              />
            </div>

            {state?.error && (
              <p className="text-sm text-red-400">{state.error}</p>
            )}

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Joining..." : "Join League"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
