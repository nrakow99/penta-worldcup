-- Group stage tracker + Round of 32 readiness flag
-- Run in Supabase SQL Editor after 001-003

DO $$ BEGIN
  CREATE TYPE group_match_status AS ENUM ('upcoming', 'live', 'final');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS r32_ready BOOLEAN NOT NULL DEFAULT FALSE;

-- Groups (World Cup groups A–H, league-scoped)
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, name)
);

CREATE INDEX IF NOT EXISTS idx_groups_league ON public.groups(league_id);

-- Teams assigned to a group
CREATE TABLE IF NOT EXISTS public.group_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_group_teams_group ON public.group_teams(group_id);

-- Group stage matches
CREATE TABLE IF NOT EXISTS public.group_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  home_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  away_team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  home_score INTEGER,
  away_score INTEGER,
  match_date TIMESTAMPTZ,
  status group_match_status NOT NULL DEFAULT 'upcoming',
  is_draw BOOLEAN NOT NULL DEFAULT FALSE,
  winner_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_matches_league ON public.group_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_group_matches_group ON public.group_matches(group_id);
CREATE INDEX IF NOT EXISTS idx_group_matches_date ON public.group_matches(match_date);

-- Cached standings (recalculated from final matches)
CREATE TABLE IF NOT EXISTS public.group_standings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  goals_for INTEGER NOT NULL DEFAULT 0,
  goals_against INTEGER NOT NULL DEFAULT 0,
  goal_difference INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(group_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_group_standings_group ON public.group_standings(group_id);

-- Recalculate standings for a group from final matches
CREATE OR REPLACE FUNCTION public.recalculate_group_standings(p_group_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_stats RECORD;
BEGIN
  DELETE FROM group_standings WHERE group_id = p_group_id;

  FOR v_team IN
    SELECT gt.team_id FROM group_teams gt WHERE gt.group_id = p_group_id
  LOOP
    SELECT
      COUNT(*) FILTER (WHERE gm.status = 'final') AS played,
      COUNT(*) FILTER (WHERE gm.status = 'final' AND gm.winner_team_id = v_team.team_id) AS won,
      COUNT(*) FILTER (WHERE gm.status = 'final' AND gm.is_draw = TRUE) AS drawn,
      COUNT(*) FILTER (WHERE gm.status = 'final' AND gm.winner_team_id IS NOT NULL AND gm.winner_team_id != v_team.team_id AND gm.is_draw = FALSE) AS lost,
      COALESCE(SUM(CASE WHEN gm.home_team_id = v_team.team_id THEN gm.home_score WHEN gm.away_team_id = v_team.team_id THEN gm.away_score ELSE 0 END) FILTER (WHERE gm.status = 'final'), 0) AS goals_for,
      COALESCE(SUM(CASE WHEN gm.home_team_id = v_team.team_id THEN gm.away_score WHEN gm.away_team_id = v_team.team_id THEN gm.home_score ELSE 0 END) FILTER (WHERE gm.status = 'final'), 0) AS goals_against
    INTO v_stats
    FROM group_matches gm
    WHERE gm.group_id = p_group_id
      AND (gm.home_team_id = v_team.team_id OR gm.away_team_id = v_team.team_id);

    INSERT INTO group_standings (
      group_id, team_id, played, won, drawn, lost,
      goals_for, goals_against, goal_difference, points, rank
    ) VALUES (
      p_group_id,
      v_team.team_id,
      COALESCE(v_stats.played, 0),
      COALESCE(v_stats.won, 0),
      COALESCE(v_stats.drawn, 0),
      COALESCE(v_stats.lost, 0),
      COALESCE(v_stats.goals_for, 0),
      COALESCE(v_stats.goals_against, 0),
      COALESCE(v_stats.goals_for, 0) - COALESCE(v_stats.goals_against, 0),
      COALESCE(v_stats.won, 0) * 3 + COALESCE(v_stats.drawn, 0),
      0
    );
  END LOOP;

  -- Assign ranks: points DESC, GD DESC, GF DESC
  WITH ranked AS (
    SELECT id,
      ROW_NUMBER() OVER (
        ORDER BY points DESC, goal_difference DESC, goals_for DESC
      ) AS new_rank
    FROM group_standings
    WHERE group_id = p_group_id
  )
  UPDATE group_standings gs
  SET rank = ranked.new_rank, updated_at = NOW()
  FROM ranked
  WHERE gs.id = ranked.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_group_standings(UUID) TO authenticated;

-- RLS
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_standings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_teams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_standings TO authenticated;

-- groups
DROP POLICY IF EXISTS "Members can view groups" ON public.groups;
CREATE POLICY "Members can view groups" ON public.groups
  FOR SELECT TO authenticated USING (public.is_league_member(league_id));

DROP POLICY IF EXISTS "Admins can manage groups" ON public.groups;
CREATE POLICY "Admins can manage groups" ON public.groups
  FOR ALL TO authenticated USING (public.is_league_admin(league_id));

-- group_teams
DROP POLICY IF EXISTS "Members can view group teams" ON public.group_teams;
CREATE POLICY "Members can view group teams" ON public.group_teams
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_id AND public.is_league_member(g.league_id)
  ));

DROP POLICY IF EXISTS "Admins can manage group teams" ON public.group_teams;
CREATE POLICY "Admins can manage group teams" ON public.group_teams
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_id AND public.is_league_admin(g.league_id)
  ));

-- group_matches
DROP POLICY IF EXISTS "Members can view group matches" ON public.group_matches;
CREATE POLICY "Members can view group matches" ON public.group_matches
  FOR SELECT TO authenticated USING (public.is_league_member(league_id));

DROP POLICY IF EXISTS "Admins can manage group matches" ON public.group_matches;
CREATE POLICY "Admins can manage group matches" ON public.group_matches
  FOR ALL TO authenticated USING (public.is_league_admin(league_id));

-- group_standings
DROP POLICY IF EXISTS "Members can view standings" ON public.group_standings;
CREATE POLICY "Members can view standings" ON public.group_standings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_id AND public.is_league_member(g.league_id)
  ));

DROP POLICY IF EXISTS "Admins can manage standings" ON public.group_standings;
CREATE POLICY "Admins can manage standings" ON public.group_standings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = group_id AND public.is_league_admin(g.league_id)
  ));
