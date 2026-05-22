"use client";

import { useCallback, useState, useTransition } from "react";
import { BracketTree } from "@/components/bracket/bracket-tree";
import { Button } from "@/components/ui/button";
import { saveBracketPicks, submitBracket } from "@/lib/actions/league-actions";
import { cascadePick, validateBracketComplete } from "@/lib/bracket/bracket-utils";
import type { BracketPick, BracketRound, Match, Team } from "@/lib/types/database";

interface BracketBuilderProps {
  leagueId: string;
  bracketId: string;
  matches: Match[];
  initialPicks: BracketPick[];
  teams: Team[];
  isLocked: boolean;
}

export function BracketBuilder({
  leagueId,
  bracketId,
  matches,
  initialPicks,
  teams,
  isLocked,
}: BracketBuilderProps) {
  const [picks, setPicks] = useState<BracketPick[]>(initialPicks);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

  const handlePick = useCallback(
    (matchId: string, teamId: string, round: BracketRound) => {
      if (isLocked) return;
      setPicks((prev) => cascadePick(prev, matchId, teamId, matches));
      setSaveStatus("idle");
    },
    [isLocked, matches]
  );

  const handleSave = () => {
    startTransition(async () => {
      const pickData = picks
        .filter((p) => p.picked_team_id)
        .map((p) => ({
          matchId: p.match_id,
          teamId: p.picked_team_id!,
          round: p.round,
        }));

      const result = await saveBracketPicks(leagueId, bracketId, pickData);
      setSaveStatus(result.error ? "error" : "saved");
    });
  };

  const handleSubmit = () => {
    startTransition(async () => {
      await handleSave();
      await submitBracket(leagueId, bracketId);
    });
  };

  const isComplete = validateBracketComplete(picks, matches);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {isLocked ? (
            <span className="text-sm text-amber-400">🔒 Bracket locked</span>
          ) : (
            <span className="text-sm text-zinc-400">
              Tap teams to advance them · Save draft anytime
            </span>
          )}
        </div>
        {!isLocked && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending || !isComplete}
            >
              Submit Bracket
            </Button>
          </div>
        )}
        {saveStatus === "saved" && (
          <span className="text-xs text-emerald-400">Draft saved!</span>
        )}
        {saveStatus === "error" && (
          <span className="text-xs text-red-400">Save failed</span>
        )}
      </div>

      <BracketTree
        matches={matches}
        picks={picks}
        teams={teams}
        isLocked={isLocked}
        isReadOnly={isLocked}
        onPick={handlePick}
        showResults={isLocked}
      />
    </div>
  );
}
