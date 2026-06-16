import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import type { GroupStanding } from "@/lib/types/database";
import { formatTeamName } from "@/lib/tournament/standings";

export function StandingsTable({
  groupName,
  standings,
}: {
  groupName: string;
  standings: GroupStanding[];
}) {
  const sorted = [...standings].sort((a, b) => a.rank - b.rank);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Group {groupName}</CardTitle>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="px-2 py-1.5 text-left">#</th>
              <th className="px-2 py-1.5 text-left">Team</th>
              <th className="px-1 py-1.5 text-center">P</th>
              <th className="px-1 py-1.5 text-center">W</th>
              <th className="px-1 py-1.5 text-center">D</th>
              <th className="px-1 py-1.5 text-center">L</th>
              <th className="px-1 py-1.5 text-center">GF</th>
              <th className="px-1 py-1.5 text-center">GA</th>
              <th className="px-1 py-1.5 text-center">GD</th>
              <th className="px-1 py-1.5 text-center font-bold">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr
                key={s.team_id}
                className={`border-b border-zinc-800/50 ${s.rank <= 2 ? "bg-emerald-500/5" : ""}`}
              >
                <td className="px-2 py-2 text-zinc-500">{s.rank}</td>
                <td className="px-2 py-2 font-medium text-zinc-200">
                  {formatTeamName(s.team)}
                </td>
                <td className="px-1 py-2 text-center text-zinc-400">{s.played}</td>
                <td className="px-1 py-2 text-center text-zinc-400">{s.won}</td>
                <td className="px-1 py-2 text-center text-zinc-400">{s.drawn}</td>
                <td className="px-1 py-2 text-center text-zinc-400">{s.lost}</td>
                <td className="px-1 py-2 text-center text-zinc-400">{s.goals_for}</td>
                <td className="px-1 py-2 text-center text-zinc-400">{s.goals_against}</td>
                <td className="px-1 py-2 text-center text-zinc-400">
                  {s.goal_difference > 0 ? "+" : ""}
                  {s.goal_difference}
                </td>
                <td className="px-1 py-2 text-center font-bold text-emerald-400">
                  {s.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
