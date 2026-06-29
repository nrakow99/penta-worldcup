-- ============================================================
-- 006_cleanup_deprecated_tables.sql
-- Remove group-stage and API-Football tables that are no longer
-- referenced by any application code.  The app is now a pure
-- knockout bracket-prediction product.
--
-- Safe to run multiple times (all statements use IF EXISTS).
-- Run in Supabase SQL Editor after migrations 001–005.
-- ============================================================

-- ── 1. Drop deprecated tables (FK-safe order: children first) ──────────────

-- group_standings depends on groups + teams
DROP TABLE IF EXISTS public.group_standings CASCADE;

-- group_teams depends on groups + teams
DROP TABLE IF EXISTS public.group_teams CASCADE;

-- group_matches depends on groups + teams + leagues
DROP TABLE IF EXISTS public.group_matches CASCADE;

-- groups depends on leagues
DROP TABLE IF EXISTS public.groups CASCADE;

-- api_sync_logs depends on leagues
DROP TABLE IF EXISTS public.api_sync_logs CASCADE;

-- ── 2. Drop functions that only served the dropped tables ──────────────────

DROP FUNCTION IF EXISTS public.recalculate_group_standings(UUID);
DROP FUNCTION IF EXISTS public.get_api_calls_used_today();

-- ── 3. Drop enums that only belonged to the dropped tables ────────────────
-- (CASCADE also drops any remaining catalog references)

DROP TYPE IF EXISTS public.group_match_status CASCADE;
DROP TYPE IF EXISTS public.api_sync_status CASCADE;
DROP TYPE IF EXISTS public.api_sync_type CASCADE;

-- ── 4. Drop orphaned columns on active tables ─────────────────────────────
-- These were added in 005_api_football.sql and are never read by the app.

-- leagues.last_synced_at  (api-football sync timestamp, no longer used)
ALTER TABLE public.leagues DROP COLUMN IF EXISTS last_synced_at;

-- teams.api_team_id  (external API identifier, no longer used)
-- Dropping the column also drops the partial index idx_teams_league_api_team.
ALTER TABLE public.teams DROP COLUMN IF EXISTS api_team_id;

-- ── 5. RLS audit: confirm all active tables are properly secured ───────────
-- Every table below already has RLS enabled and correct policies from
-- migrations 001–003.  This section makes the current security posture
-- explicit and idempotent.

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all profiles"       ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON public.profiles;
CREATE POLICY "Users can view all profiles"  ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- leagues
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Creators and members can view leagues" ON public.leagues;
DROP POLICY IF EXISTS "Authenticated users can create leagues" ON public.leagues;
DROP POLICY IF EXISTS "Creators and admins can update leagues" ON public.leagues;
DROP POLICY IF EXISTS "Creators can delete leagues"           ON public.leagues;
CREATE POLICY "Creators and members can view leagues" ON public.leagues
  FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR public.is_league_member(id));
CREATE POLICY "Authenticated users can create leagues" ON public.leagues
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND admin_id = auth.uid());
CREATE POLICY "Creators and admins can update leagues" ON public.leagues
  FOR UPDATE TO authenticated
  USING  (admin_id = auth.uid() OR public.is_league_admin(id))
  WITH CHECK (admin_id = auth.uid() OR public.is_league_admin(id));
CREATE POLICY "Creators can delete leagues" ON public.leagues
  FOR DELETE TO authenticated
  USING (admin_id = auth.uid());

-- league_members
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view league members" ON public.league_members;
DROP POLICY IF EXISTS "Users can join leagues"          ON public.league_members;
DROP POLICY IF EXISTS "Admins can manage members"       ON public.league_members;
CREATE POLICY "Members can view league members" ON public.league_members
  FOR SELECT TO authenticated
  USING (public.is_league_member(league_id) OR public.is_league_creator(league_id));
CREATE POLICY "Users can join leagues" ON public.league_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage members" ON public.league_members
  FOR DELETE TO authenticated
  USING (public.is_league_admin(league_id));

-- teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Members can view teams"  ON public.teams FOR SELECT USING (public.is_league_member(league_id));
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL    USING (public.is_league_admin(league_id));

-- matches
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view matches" ON public.matches;
DROP POLICY IF EXISTS "Admins can manage matches" ON public.matches;
CREATE POLICY "Members can view matches"  ON public.matches FOR SELECT USING (public.is_league_member(league_id));
CREATE POLICY "Admins can manage matches" ON public.matches FOR ALL    USING (public.is_league_admin(league_id));

-- brackets
ALTER TABLE public.brackets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view own bracket always"        ON public.brackets;
DROP POLICY IF EXISTS "Members can view others brackets when locked" ON public.brackets;
DROP POLICY IF EXISTS "Members can create own bracket"             ON public.brackets;
DROP POLICY IF EXISTS "Members can update own unlocked bracket"    ON public.brackets;
-- Own bracket: always visible to owner who is a member
CREATE POLICY "Members can view own bracket always" ON public.brackets FOR SELECT
  USING (auth.uid() = user_id AND public.is_league_member(league_id));
-- Others' brackets: visible only after lock
CREATE POLICY "Members can view others brackets when locked" ON public.brackets FOR SELECT
  USING (auth.uid() <> user_id AND public.is_league_member(league_id) AND public.is_bracket_locked(league_id));
CREATE POLICY "Members can create own bracket" ON public.brackets FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_league_member(league_id));
CREATE POLICY "Members can update own unlocked bracket" ON public.brackets FOR UPDATE
  USING (auth.uid() = user_id AND NOT public.is_bracket_locked(league_id));

-- bracket_picks
ALTER TABLE public.bracket_picks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View picks for visible brackets" ON public.bracket_picks;
DROP POLICY IF EXISTS "Manage own picks when unlocked"  ON public.bracket_picks;
CREATE POLICY "View picks for visible brackets" ON public.bracket_picks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.brackets b
    WHERE b.id = bracket_id
      AND public.is_league_member(b.league_id)
      AND (b.user_id = auth.uid() OR public.is_bracket_locked(b.league_id))
  ));
CREATE POLICY "Manage own picks when unlocked" ON public.bracket_picks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.brackets b
    WHERE b.id = bracket_id
      AND b.user_id = auth.uid()
      AND NOT public.is_bracket_locked(b.league_id)
  ));

-- actual_results
ALTER TABLE public.actual_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view results" ON public.actual_results;
DROP POLICY IF EXISTS "Admins can manage results" ON public.actual_results;
CREATE POLICY "Members can view results"  ON public.actual_results FOR SELECT USING (public.is_league_member(league_id));
CREATE POLICY "Admins can manage results" ON public.actual_results FOR ALL    USING (public.is_league_admin(league_id));

-- punishments
ALTER TABLE public.punishments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view punishment"  ON public.punishments;
DROP POLICY IF EXISTS "Admins can manage punishment" ON public.punishments;
CREATE POLICY "Members can view punishment"  ON public.punishments FOR SELECT USING (public.is_league_member(league_id));
CREATE POLICY "Admins can manage punishment" ON public.punishments FOR ALL    USING (public.is_league_admin(league_id));

-- comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can view comments" ON public.comments;
DROP POLICY IF EXISTS "Members can post comments"   ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Members can view comments"     ON public.comments FOR SELECT USING (public.is_league_member(league_id));
CREATE POLICY "Members can post comments"     ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_league_member(league_id));
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- ── 6. Ensure grants still cover all active tables ────────────────────────
-- (GRANT ALL TABLES is idempotent; it covers tables created after the grant
--  was first issued in migration 003.)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
