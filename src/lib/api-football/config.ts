/** FIFA World Cup league ID in API-Football — update if API docs change */
export const WORLD_CUP_LEAGUE_ID = Number(
  process.env.API_FOOTBALL_WORLD_CUP_LEAGUE_ID ?? "1"
);

export const WORLD_CUP_SEASON = 2026;

export const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";

/** Free tier daily limit — stay under this */
export const API_FOOTBALL_DAILY_LIMIT = 100;

/** Minimum hours between full syncs per league (avoid accidental spam) */
export const API_FOOTBALL_MIN_SYNC_INTERVAL_HOURS = 1;

/** Estimated calls for a full sync (teams + fixtures pages + standings) */
export const API_FOOTBALL_FULL_SYNC_ESTIMATE = 5;

export function getApiFootballKey(): string | undefined {
  return process.env.API_FOOTBALL_KEY;
}

export function isApiFootballConfigured(): boolean {
  return Boolean(getApiFootballKey());
}
