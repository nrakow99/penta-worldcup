export const FREE_PLAN_SEASON_MESSAGE =
  "API-Football free plan does not include World Cup 2026 data. Use CSV/JSON import below, or upgrade your API-Football plan when 2026 becomes available.";

export function isFreePlanSeasonError(message: string): boolean {
  return /free plans do not have access to this season/i.test(message);
}

export function normalizeApiFootballError(raw: string): string {
  if (isFreePlanSeasonError(raw)) {
    return FREE_PLAN_SEASON_MESSAGE;
  }
  return raw;
}
