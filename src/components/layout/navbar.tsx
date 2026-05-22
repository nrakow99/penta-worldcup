import Link from "next/link";
import { Trophy, LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/league-actions";

export function Navbar({ userName }: { userName?: string }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-emerald-500" />
          <span className="font-bold text-zinc-100">
            Bracket Punishment League
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {userName && (
            <span className="hidden text-sm text-zinc-400 sm:inline">
              {userName}
            </span>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

export function LeagueNav({
  leagueId,
  isAdmin,
}: {
  leagueId: string;
  isAdmin: boolean;
}) {
  const links = [
    { href: `/league/${leagueId}`, label: "Dashboard" },
    { href: `/league/${leagueId}/bracket`, label: "My Bracket" },
    ...(isAdmin ? [{ href: `/league/${leagueId}/admin`, label: "Admin" }] : []),
  ];

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-zinc-800 pb-px">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className="whitespace-nowrap rounded-t-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
