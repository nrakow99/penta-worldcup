import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { RankBadge } from "@/components/ui/badge";
import type { BracketScore } from "@/lib/types/database";
import { Trophy, TrendingDown } from "lucide-react";

interface LeaderboardProps {
  scores: BracketScore[];
  highlightUserId?: string;
}

export function Leaderboard({ scores, highlightUserId }: LeaderboardProps) {
  if (scores.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
        </CardHeader>
        <p className="text-sm text-zinc-500">No brackets submitted yet.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <div className="space-y-2">
        {scores.map((score) => (
          <div
            key={score.userId}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
              score.userId === highlightUserId
                ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                : "bg-zinc-800/50"
            }`}
          >
            <RankBadge rank={score.rank} />
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-zinc-100">
                {score.displayName}
                {!score.isComplete && (
                  <span className="ml-2 text-xs text-red-400">(incomplete)</span>
                )}
              </p>
              <p className="text-xs text-zinc-500">
                {score.correctPicks} correct · {score.missedPicks} missed
              </p>
            </div>
            <div className="text-right">
              <p className="font-bold text-emerald-400">{score.totalPoints}</p>
              <p className="text-xs text-zinc-500">
                +{score.possiblePointsRemaining} possible
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function LoserAlert({ worst }: { worst: BracketScore | null }) {
  if (!worst) return null;

  return (
    <Card variant="danger">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-400">
          <TrendingDown className="h-4 w-4" />
          Loser Alert
        </CardTitle>
      </CardHeader>
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-2xl">
          💀
        </div>
        <div>
          <p className="font-bold text-red-300">{worst.displayName}</p>
          <p className="text-sm text-red-400/80">
            Currently in last place with {worst.totalPoints} points
          </p>
        </div>
      </div>
    </Card>
  );
}
