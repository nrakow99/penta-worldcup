"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BracketTree } from "@/components/bracket/bracket-tree";
import { Button } from "@/components/ui/button";
import { saveBracketPicks, submitBracket } from "@/lib/actions/league-actions";
import { cascadePick, validateBracketComplete } from "@/lib/bracket/bracket-utils";
import type { BracketPick, BracketRound, Match, Team } from "@/lib/types/database";
import { MATCH_COUNTS } from "@/lib/types/database";

interface BracketBuilderProps {
  leagueId: string;
  bracketId: string;
  matches: Match[];
  initialPicks: BracketPick[];
  teams: Team[];
  isLocked: boolean;
  lockDeadline?: string | null;
}

type SaveStatus = "saved" | "saving" | "unsaved" | "error";

const AUTOSAVE_DELAY_MS = 1200;
const TOTAL_PICKS = Object.values(MATCH_COUNTS).reduce((a, b) => a + b, 0); // 31

export function BracketBuilder({
  leagueId,
  bracketId,
  matches,
  initialPicks,
  teams,
  isLocked,
  lockDeadline,
}: BracketBuilderProps) {
  const [picks, setPicks] = useState<BracketPick[]>(initialPicks);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [isPending, startTransition] = useTransition();
  const [submitDone, setSubmitDone] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    async (currentPicks: BracketPick[]) => {
      if (isLocked) return;
      const pickData = currentPicks
        .filter((p) => p.picked_team_id)
        .map((p) => ({
          matchId: p.match_id,
          teamId: p.picked_team_id!,
          round: p.round,
        }));

      setSaveStatus("saving");
      const result = await saveBracketPicks(leagueId, bracketId, pickData);
      setSaveStatus(result.error ? "error" : "saved");
    },
    [isLocked, leagueId, bracketId]
  );

  const handlePick = useCallback(
    (matchId: string, teamId: string, _round: BracketRound) => {
      if (isLocked) return;

      setPicks((prev) => {
        const next = cascadePick(prev, matchId, teamId, matches);
        // Schedule auto-save after user stops clicking
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => {
          startTransition(() => void doSave(next));
        }, AUTOSAVE_DELAY_MS);
        return next;
      });
      setSaveStatus("unsaved");
    },
    [isLocked, matches, doSave]
  );

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const handleManualSave = () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    startTransition(() => void doSave(picks));
  };

  const handleSubmit = () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    startTransition(async () => {
      await doSave(picks);
      const result = await submitBracket(leagueId, bracketId);
      if (!result.error) setSubmitDone(true);
    });
  };

  const isComplete = validateBracketComplete(picks, matches);
  const pickedCount = picks.filter((p) => p.picked_team_id).length;
  const remaining = TOTAL_PICKS - pickedCount;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          {isLocked ? (
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-400">
              🔒 Bracket locked
            </span>
          ) : (
            <span className="text-sm text-zinc-400">
              {remaining > 0
                ? `${remaining} pick${remaining === 1 ? "" : "s"} remaining`
                : "All picks made"}
            </span>
          )}

          {lockDeadline && !isLocked && (
            <LockCountdown deadline={lockDeadline} />
          )}
        </div>

        {!isLocked && (
          <div className="flex items-center gap-3">
            <SaveIndicator status={saveStatus} isPending={isPending} />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleManualSave}
              disabled={isPending || saveStatus === "saved"}
            >
              Save
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending || !isComplete || submitDone}
            >
              {submitDone ? "Submitted ✓" : "Submit Bracket"}
            </Button>
          </div>
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

function SaveIndicator({
  status,
  isPending,
}: {
  status: SaveStatus;
  isPending: boolean;
}) {
  if (isPending || status === "saving") {
    return <span className="text-xs text-zinc-400">Saving…</span>;
  }
  if (status === "saved") {
    return <span className="text-xs text-emerald-500">✓ Saved</span>;
  }
  if (status === "error") {
    return <span className="text-xs text-red-400">Save failed</span>;
  }
  // unsaved
  return <span className="text-xs text-amber-400">Unsaved changes</span>;
}

function LockCountdown({ deadline }: { deadline: string }) {
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const diff = Math.floor(
        (new Date(deadline).getTime() - Date.now()) / 1000
      );
      if (diff <= 0) {
        setLabel("Locking soon");
        return;
      }
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (d > 0) setLabel(`Locks in ${d}d ${h}h`);
      else if (h > 0) setLabel(`Locks in ${h}h ${m}m`);
      else setLabel(`Locks in ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!label) return null;
  return <span className="text-xs text-zinc-500">{label}</span>;
}
