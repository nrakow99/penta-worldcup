-- API-Football integration: external IDs, sync metadata, logs
-- Run in Supabase SQL Editor after 004

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS api_team_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_league_api_team
  ON public.teams(league_id, api_team_id)
  WHERE api_team_id IS NOT NULL;

ALTER TABLE public.group_matches
  ADD COLUMN IF NOT EXISTS api_fixture_id INTEGER,
  ADD COLUMN IF NOT EXISTS is_manual_override BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_matches_league_api_fixture
  ON public.group_matches(league_id, api_fixture_id)
  WHERE api_fixture_id IS NOT NULL;

DO $$ BEGIN
  CREATE TYPE api_sync_status AS ENUM ('success', 'error', 'partial');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE api_sync_type AS ENUM ('full', 'teams', 'fixtures', 'standings');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.api_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  sync_type api_sync_type NOT NULL DEFAULT 'full',
  status api_sync_status NOT NULL,
  calls_used INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_sync_logs_league ON public.api_sync_logs(league_id);
CREATE INDEX IF NOT EXISTS idx_api_sync_logs_created ON public.api_sync_logs(created_at);

ALTER TABLE public.api_sync_logs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.api_sync_logs TO authenticated;

DROP POLICY IF EXISTS "Members can view sync logs" ON public.api_sync_logs;
CREATE POLICY "Members can view sync logs" ON public.api_sync_logs
  FOR SELECT TO authenticated
  USING (public.is_league_member(league_id));

DROP POLICY IF EXISTS "Admins can insert sync logs" ON public.api_sync_logs;
CREATE POLICY "Admins can insert sync logs" ON public.api_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_league_admin(league_id));

-- Daily API call budget (global across all leagues in this project)
CREATE OR REPLACE FUNCTION public.get_api_calls_used_today()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(calls_used), 0)::INTEGER
  FROM api_sync_logs
  WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'UTC');
$$;

GRANT EXECUTE ON FUNCTION public.get_api_calls_used_today() TO authenticated;
