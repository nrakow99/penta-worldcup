import type { MatchDataProvider } from "@/lib/tournament/types";

/**
 * Match data is read from Supabase (cached API-Football sync or manual admin entry).
 * To plug in live API reads later, implement MatchDataProvider against Supabase
 * and optionally add a background sync job — never call API-Football from the client.
 */
export type { MatchDataProvider };
