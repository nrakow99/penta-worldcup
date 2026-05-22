"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp } from "@/lib/actions/league-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return (await signUp(formData)) ?? null;
    },
    null
  );

  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Trophy className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <h1 className="text-xl font-bold text-zinc-100">Create Account</h1>
          <p className="text-sm text-zinc-500">Join the bracket punishment</p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Display Name</label>
            <Input name="displayName" required placeholder="Your nickname" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Email</label>
            <Input name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Password</label>
            <Input
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-400">{state.error}</p>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Creating account..." : "Sign Up"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
