import type {
  GroupMatch,
  GroupStanding,
  GroupTeam,
  League,
  WcGroup,
} from "@/lib/types/database";

/** Pluggable provider for match data — swap for external API later */
export interface MatchDataProvider {
  getGroups(leagueId: string): Promise<WcGroup[]>;
  getGroupTeams(groupId: string): Promise<GroupTeam[]>;
  getMatches(leagueId: string): Promise<GroupMatch[]>;
  getStandings(leagueId: string): Promise<GroupStanding[]>;
}

export type GroupStageData = {
  groups: WcGroup[];
  groupTeams: GroupTeam[];
  matches: GroupMatch[];
  standings: GroupStanding[];
};

export const GROUP_NAMES = [
  "A", "B", "C", "D", "E", "F", "G", "H",
] as const;
