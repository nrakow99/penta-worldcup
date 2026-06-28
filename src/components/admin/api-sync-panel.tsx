"use client";

import { useState, useTransition } from "react";
import { syncWorldCupFromApi } from "@/lib/actions/sync-actions";
import { FREE_PLAN_SEASON_MESSAGE } from "@/lib/api-football/errors";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { ApiSyncLog } from "@/lib/types/database";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, AlertCircle, Info } from "lucide-react";

interface ApiSyncPanelProps {
  leagueId: string;
  configured: boolean;
  lastSyncedAt: string | null;
  callsUsedToday: number;
  dailyLimit: number;
  recentLogs: ApiSyncLog[];
}

export function ApiSyncPanel({
  leagueId,
  configured,
  lastSyncedAt,
  callsUsedToday,
  dailyLimit,
  recentLogs,
}: ApiSyncPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const remaining = dailyLimit - callsUsedToday;
  const canSync = configured && remaining >= 3;

  const lastLogWasFreePlan = recentLogs.some(
    (log) =>
      log.status === "error" &&
      log.message?.toLowerCase().includes("free plan")
  );

  return (
    <Card className="border-blue-900/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-400">
          <RefreshCw className="h-4 w-4" />
          Sync World Cup Data (API-Football)
        </CardTitle>
      </CardHeader>

      <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200/90">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p>
          {FREE_PLAN_SEASON_MESSAGE} Use <strong>CSV/JSON import</strong> below
          for 2026 data, or upgrade API-Football when ready.
        </p>
      </div>

      {!configured ? (
        <div className="flex items-start gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">API_FOOTBALL_KEY not configured</p>
            <p className="mt-1 text-xs text-zinc-500">
              Optional — add to .env.local for paid API access. CSV import and
              manual entry work without it.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-3 space-y-1 text-xs text-zinc-500">
            <p>
              API calls today:{" "}
              <span className="text-zinc-300">
                {callsUsedToday}/{dailyLimit}
              </span>{" "}
              ({remaining} remaining)
            </p>
            {lastSyncedAt && (
              <p>
                Last synced:{" "}
                <span className="text-zinc-300">
                  {formatDistanceToNow(new Date(lastSyncedAt), {
                    addSuffix: true,
                  })}
                </span>
              </p>
            )}
          </div>

          <Button
            size="sm"
            variant="secondary"
            disabled={isPending || !canSync}
            onClick={() => {
              setResult(null);
              startTransition(async () => {
                const res = await syncWorldCupFromApi(leagueId);
                if (res.error) {
                  setResult({
                    type: res.freePlanBlocked ? "info" : "error",
                    message: res.error,
                  });
                } else {
                  setResult({
                    type: "success",
                    message: res.message ?? "Sync complete",
                  });
                }
              });
            }}
          >
            {isPending ? "Syncing..." : "Try API Sync"}
          </Button>

          {!canSync && configured && remaining < 3 && (
            <p className="mt-2 text-xs text-amber-400">
              Not enough API quota remaining today.
            </p>
          )}
        </>
      )}

      {(result || lastLogWasFreePlan) && (
        <p
          className={`mt-3 text-sm ${
            result?.type === "success"
              ? "text-emerald-400"
              : result?.type === "info"
                ? "text-amber-300"
                : "text-red-400"
          }`}
        >
          {result?.message ??
            (lastLogWasFreePlan ? FREE_PLAN_SEASON_MESSAGE : null)}
        </p>
      )}

      {recentLogs.length > 0 && (
        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="mb-2 text-xs font-medium text-zinc-500">Recent syncs</p>
          <div className="space-y-1">
            {recentLogs.map((log) => (
              <div key={log.id} className="text-xs text-zinc-500">
                <span
                  className={
                    log.status === "success"
                      ? "text-emerald-500"
                      : log.status === "error"
                        ? "text-amber-500"
                        : "text-amber-500"
                  }
                >
                  {log.status}
                </span>
                {" · "}
                {log.calls_used} call(s) · {log.message?.slice(0, 100)}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
