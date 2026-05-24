-- Fix league creation RLS (chicken-and-egg: creator can't SELECT league before league_members row exists)
-- Run this entire file in Supabase SQL Editor.

-- Ensure authenticated role can access tables
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Helper functions (add search_path for Supabase compatibility)
CREATE OR REPLACE FUNCTION public.is_league_member(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_admin(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leagues
    WHERE id = p_league_id AND admin_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_league_creator(p_league_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM leagues
    WHERE id = p_league_id AND admin_id = auth.uid()
  );
$$;

-- Auto-add creator as admin member when a league is created
CREATE OR REPLACE FUNCTION public.handle_new_league()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.league_members (league_id, user_id, role)
  VALUES (NEW.id, NEW.admin_id, 'admin')
  ON CONFLICT (league_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_league_created ON public.leagues;
CREATE TRIGGER on_league_created
  AFTER INSERT ON public.leagues
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_league();

-- ─── LEAGUES policies ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can view their leagues" ON public.leagues;
DROP POLICY IF EXISTS "Creators and members can view leagues" ON public.leagues;
CREATE POLICY "Creators and members can view leagues" ON public.leagues
  FOR SELECT
  TO authenticated
  USING (
    admin_id = auth.uid()
    OR public.is_league_member(id)
  );

DROP POLICY IF EXISTS "Authenticated users can create leagues" ON public.leagues;
CREATE POLICY "Authenticated users can create leagues" ON public.leagues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND admin_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admins can update leagues" ON public.leagues;
DROP POLICY IF EXISTS "Creators and admins can update leagues" ON public.leagues;
CREATE POLICY "Creators and admins can update leagues" ON public.leagues
  FOR UPDATE
  TO authenticated
  USING (
    admin_id = auth.uid()
    OR public.is_league_admin(id)
  )
  WITH CHECK (
    admin_id = auth.uid()
    OR public.is_league_admin(id)
  );

DROP POLICY IF EXISTS "Creators can delete leagues" ON public.leagues;
CREATE POLICY "Creators can delete leagues" ON public.leagues
  FOR DELETE
  TO authenticated
  USING (admin_id = auth.uid());

-- ─── LEAGUE_MEMBERS policies ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can view league members" ON public.league_members;
CREATE POLICY "Members can view league members" ON public.league_members
  FOR SELECT
  TO authenticated
  USING (
    public.is_league_member(league_id)
    OR public.is_league_creator(league_id)
  );

DROP POLICY IF EXISTS "Users can join leagues" ON public.league_members;
CREATE POLICY "Users can join leagues" ON public.league_members
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage members" ON public.league_members;
CREATE POLICY "Admins can manage members" ON public.league_members
  FOR DELETE
  TO authenticated
  USING (public.is_league_admin(league_id));
