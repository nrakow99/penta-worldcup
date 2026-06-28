export interface ApiFootballTeam {
  id: number;
  name: string;
  code: string | null;
  country: string;
  logo: string | null;
}

export interface ApiFootballFixtureStatus {
  short: string;
  long: string;
}

export interface ApiFootballFixture {
  id: number;
  date: string;
  status: ApiFootballFixtureStatus;
}

export interface ApiFootballFixtureTeam {
  id: number;
  name: string;
  winner: boolean | null;
}

export interface ApiFootballFixtureGoals {
  home: number | null;
  away: number | null;
}

export interface ApiFootballFixtureItem {
  fixture: ApiFootballFixture;
  league: {
    id: number;
    season: number;
    round: string;
  };
  teams: {
    home: ApiFootballFixtureTeam;
    away: ApiFootballFixtureTeam;
  };
  goals: ApiFootballFixtureGoals;
}

export interface ApiFootballStandingRow {
  rank: number;
  team: ApiFootballTeam;
  points: number;
  goalsDiff: number;
  group: string;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
}

export interface ApiFootballTeamsResponse {
  response: Array<{ team: ApiFootballTeam }>;
}

export interface ApiFootballFixturesResponse {
  response: ApiFootballFixtureItem[];
  paging?: { current: number; total: number };
}

export interface ApiFootballStandingsResponse {
  response: Array<{
    league: {
      standings: ApiFootballStandingRow[][];
    };
  }>;
}

export interface ApiFootballError {
  message: string;
}

export interface ApiFootballMeta {
  errors?: ApiFootballError[] | Record<string, string>;
}

export type ApiFootballResponse<T> = T & ApiFootballMeta;
