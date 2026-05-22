import Link from "next/link";
import { Trophy, Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex min-h-full flex-col bg-zinc-950">
      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-zinc-950" />

        <div className="relative z-10 max-w-lg text-center">
          <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-emerald-500/10 p-4">
            <Trophy className="h-12 w-12 text-emerald-500" />
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
            Bracket Punishment League
          </h1>

          <p className="mb-8 text-lg text-zinc-400">
            World Cup 2026 bracket challenge for you and your roommates.
            Worst bracket takes the punishment. 💀
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                Get Started
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="relative z-10 mt-16 grid max-w-2xl gap-4 sm:grid-cols-3">
          {[
            { icon: Users, title: "Private Leagues", desc: "Invite your roommates with a code" },
            { icon: Trophy, title: "Bracket Picks", desc: "Round of 32 through Champion" },
            { icon: Plus, title: "Punishment", desc: "Loser pays the price" },
          ].map(({ icon: Icon, title, desc }) => (
            <Card key={title} className="text-center">
              <Icon className="mx-auto mb-2 h-6 w-6 text-emerald-500" />
              <h3 className="font-semibold text-zinc-200">{title}</h3>
              <p className="mt-1 text-xs text-zinc-500">{desc}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
