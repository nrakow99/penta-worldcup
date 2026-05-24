"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/lib/actions/league-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => {
      return (await signIn(formData)) ?? null;
    },
    null
  );

  return (
    <div className="flex min-h-full items-center justify-center bg-zinc-950 px-4">
      <Card className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Trophy className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <h1 className="text-xl font-bold text-zinc-100">Sign In</h1>
          <p className="text-sm text-zinc-500">Welcome back to the league</p>
        </div>

        <form action={formAction} className="space-y-4">
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
              autoComplete="current-password"
            />
          </div>

          {state?.error && (
            <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
              {state.error}
              {state.error.toLowerCase().includes("email not confirmed") && (
                <p className="mt-2 text-xs text-red-300/80">
                  Check your inbox for the confirmation link, or ask the admin
                  to disable email confirmation in Supabase (Authentication →
                  Providers → Email).
                </p>
              )}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500">
          No account?{" "}
          <Link href="/signup" className="text-emerald-400 hover:underline">
            Sign up
          </Link>
        </p>
      </Card>
    </div>
  );
}
