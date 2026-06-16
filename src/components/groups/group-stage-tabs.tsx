"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import type {
  GroupMatch,
  GroupStanding,
  GroupTeam,
  WcGroup,
} from "@/lib/types/database";
import { StandingsTable } from "./standings-table";
import { FixtureList } from "./fixture-card";
import { GroupStageAdmin } from "./group-stage-admin";

type Tab = "groups" | "fixtures" | "results" | "knockout";

interface GroupStageTabsProps {
  leagueId: string;
  isAdmin: boolean;
  groups: WcGroup[];
  groupTeams: GroupTeam[];
  matches: GroupMatch[];
  standings: GroupStanding[];
  teams: { id: string; name: string; flag_emoji: string | null }[];
}

export function GroupStageTabs({
  leagueId,
  isAdmin,
  groups,
  groupTeams,
  matches,
  standings,
  teams,
}: GroupStageTabsProps) {
  const [tab, setTab] = useState<Tab>("groups");

  const upcoming = matches.filter((m) => m.status === "upcoming" || m.status === "live");
  const results = matches.filter((m) => m.status === "final");

  const tabs: { id: Tab; label: string }[] = [
    { id: "groups", label: "Groups" },
    { id: "fixtures", label: "Fixtures" },
    { id: "results", label: "Results" },
    { id: "knockout", label: "Knockout Bracket" },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-emerald-500 text-emerald-400"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "groups" && (
        <div className="space-y-4">
          {groups.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No groups set up yet.
              {isAdmin && " Use the admin panel below to initialize groups."}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((g) => (
                <StandingsTable
                  key={g.id}
                  groupName={g.name}
                  standings={standings.filter((s) => s.group_id === g.id)}
                />
              ))}
            </div>
          )}
          {isAdmin && (
            <GroupStageAdmin
              leagueId={leagueId}
              groups={groups}
              groupTeams={groupTeams}
              matches={matches}
              teams={teams}
            />
          )}
        </div>
      )}

      {tab === "fixtures" && (
        <FixtureList
          matches={upcoming}
          emptyMessage="No upcoming fixtures. Admin can add games in the panel below."
        />
      )}

      {tab === "results" && (
        <FixtureList
          matches={results}
          emptyMessage="No completed matches yet."
        />
      )}

      {tab === "knockout" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center">
          <p className="text-zinc-400">
            Round of 32 matchups are configured by the league admin.
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            Once matchups are confirmed, you can fill out your bracket from the
            league dashboard.
          </p>
        </div>
      )}
    </div>
  );
}
