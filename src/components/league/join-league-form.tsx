"use client";

import { useActionState } from "react";
import { joinLeague } from "@/lib/actions/league-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { UserCircle } from "lucide-react";

interface JoinLeagueFormProps {
  /** The user's current display name, or "" if they haven't set one yet. */
  existingDisplayName: string;
}

type State = { error?: string } | null;

export function JoinLeagueForm({ existingDisplayName }: JoinLeagueFormProps) {
  const needsName = !existingDisplayName;

  const [state, formAction, isPending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      // Inject existing name if user already has one and didn't type a new one
      if (!needsName && !formData.get("displayName")) {
        formData.set("displayName", existingDisplayName);
      }
      return (await joinLeague(formData)) ?? null;
    },
    null
  );

  return (
    <Card>
      <h1 className="mb-1 text-xl font-bold text-zinc-100">Join League</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Enter the invite code from your league admin
      </p>

      <form action={formAction} className="space-y-4">
        {/* Display name — required if user has none, otherwise optional */}
        {needsName ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              <UserCircle className="mr-1 inline h-3.5 w-3.5" />
              Your display name{" "}
              <span className="text-red-400">*</span>
            </label>
            <Input
              name="displayName"
              required
              minLength={2}
              maxLength={20}
              placeholder="e.g. Alex"
              autoFocus
            />
            <p className="mt-1 text-[11px] text-zinc-600">
              2–20 characters. This is how you appear on the leaderboard.
            </p>
          </div>
        ) : (
          <>
            {/* Hidden — existing name is injected via useActionState wrapper */}
            <input type="hidden" name="displayName" value={existingDisplayName} />
            <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <UserCircle className="h-4 w-4 shrink-0 text-zinc-500" />
              <div>
                <p className="text-xs text-zinc-500">Playing as</p>
                <p className="text-sm font-medium text-zinc-200">
                  {existingDisplayName}
                </p>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-xs text-zinc-400">Invite Code</label>
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
          {isPending ? "Joining…" : "Join League"}
        </Button>
      </form>
    </Card>
  );
}
