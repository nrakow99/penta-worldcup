"use client";

import { useActionState } from "react";
import { setDisplayName } from "@/lib/actions/league-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

type State = { error?: string; success?: boolean } | null;

export function DisplayNameForm({ currentName }: { currentName: string }) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      return (await setDisplayName(formData)) ?? null;
    },
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">
          Display name
        </label>
        <Input
          name="displayName"
          defaultValue={currentName}
          required
          minLength={2}
          maxLength={20}
          placeholder="2–20 characters"
        />
        <p className="mt-1 text-[11px] text-zinc-600">
          This is how you appear on the leaderboard and bracket views.
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}

      {state?.success && (
        <p className="flex items-center gap-1 text-sm text-emerald-400">
          <Check className="h-3.5 w-3.5" /> Saved!
        </p>
      )}

      <Button type="submit" disabled={isPending} size="sm">
        {isPending ? "Saving…" : "Save Display Name"}
      </Button>
    </form>
  );
}
