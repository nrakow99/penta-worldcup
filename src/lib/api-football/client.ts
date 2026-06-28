import {
  API_FOOTBALL_BASE_URL,
  getApiFootballKey,
  WORLD_CUP_LEAGUE_ID,
  WORLD_CUP_SEASON,
} from "./config";
import type {
  ApiFootballFixturesResponse,
  ApiFootballResponse,
  ApiFootballStandingsResponse,
  ApiFootballTeamsResponse,
} from "./types";
import { normalizeApiFootballError } from "./errors";

export class ApiFootballError extends Error {
  constructor(
    message: string,
    public readonly callsUsed: number = 1
  ) {
    super(message);
    this.name = "ApiFootballError";
  }
}

/** Server-side only — never import in client components */
async function apiFetch<T>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<{ data: ApiFootballResponse<T>; callsUsed: number }> {
  const key = getApiFootballKey();
  if (!key) {
    throw new ApiFootballError("API_FOOTBALL_KEY is not configured", 0);
  }

  const url = new URL(path, API_FOOTBALL_BASE_URL);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      "x-apisports-key": key,
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new ApiFootballError(
      `API-Football HTTP ${res.status}: ${res.statusText}`,
      1
    );
  }

  const data = (await res.json()) as ApiFootballResponse<T>;

  if (data.errors) {
    const errMsg = Array.isArray(data.errors)
      ? data.errors.map((e) => e.message).join("; ")
      : Object.values(data.errors).join("; ");
    if (errMsg) {
      throw new ApiFootballError(normalizeApiFootballError(errMsg), 1);
    }
  }

  return { data, callsUsed: 1 };
}

export async function fetchWorldCupTeams() {
  return apiFetch<ApiFootballTeamsResponse>("/teams", {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  });
}

export async function fetchWorldCupFixtures(page = 1) {
  return apiFetch<ApiFootballFixturesResponse>("/fixtures", {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
    page,
  });
}

/** Fetch all fixture pages — counts 1 API call per page */
export async function fetchAllWorldCupFixtures(
  maxPages = 10
): Promise<{ fixtures: ApiFootballFixturesResponse["response"]; callsUsed: number }> {
  let page = 1;
  let totalPages = 1;
  const all: ApiFootballFixturesResponse["response"] = [];
  let callsUsed = 0;

  while (page <= totalPages && page <= maxPages) {
    const { data, callsUsed: callCost } = await fetchWorldCupFixtures(page);
    callsUsed += callCost;
    all.push(...(data.response ?? []));
    totalPages = data.paging?.total ?? 1;
    page++;
  }

  return { fixtures: all, callsUsed };
}

export async function fetchWorldCupStandings() {
  return apiFetch<ApiFootballStandingsResponse>("/standings", {
    league: WORLD_CUP_LEAGUE_ID,
    season: WORLD_CUP_SEASON,
  });
}

export function isGroupStageFixture(round: string): boolean {
  const r = round.toLowerCase();
  return r.includes("group");
}

/** Extract group letter from round strings like "Group A - 1" or "Group Stage - 1" */
export function parseGroupLetterFromRound(round: string): string | null {
  const match = round.match(/group\s+([a-h])/i);
  return match ? match[1].toUpperCase() : null;
}

export function parseGroupLetterFromStandingGroup(group: string): string | null {
  const match = group.match(/group\s+([a-h])/i) ?? group.match(/^([a-h])$/i);
  return match ? match[1].toUpperCase() : null;
}

export function mapFixtureStatus(
  short: string
): "upcoming" | "live" | "final" {
  const live = ["1H", "2H", "HT", "ET", "BT", "P", "LIVE", "INT"];
  const final = ["FT", "AET", "PEN", "AWD", "WO"];
  if (final.includes(short)) return "final";
  if (live.includes(short)) return "live";
  return "upcoming";
}
