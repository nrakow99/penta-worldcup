-- Bracket Punishment League - Initial Schema
-- Run ONCE on a fresh Supabase project.
-- If you already ran this (or get "already exists" errors), skip it — you're done.
-- Only run new numbered migrations (e.g. 002_fix_signup_trigger.sql) after that.

-- Enums (skip if already created)
DO $$ BEGIN
  CREATE TYPE league_status AS ENUM ('open', 'locked', 'in_progress', 'finished');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE member_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bracket_round AS ENUM ('r32', 'r16', 'qf', 'sf', 'final', 'champion');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE match_slot AS ENUM ('a', 'b');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leagues
CREATE TABLE IF NOT EXISTS leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status league_status NOT NULL DEFAULT 'open',
  lock_deadline TIMESTAMPTZ,
  is_manually_locked BOOLEAN NOT NULL DEFAULT FALSE,
  total_goals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leagues_invite_code ON leagues(invite_code);
CREATE INDEX IF NOT EXISTS idx_leagues_admin_id ON leagues(admin_id);

-- League members
CREATE TABLE IF NOT EXISTS league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_league_members_league ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON league_members(user_id);

-- Teams (league-scoped, supports placeholders)
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_name TEXT,
  flag_emoji TEXT,
  is_placeholder BOOLEAN NOT NULL DEFAULT FALSE,
  placeholder_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_league ON teams(league_id);

-- Matches (bracket structure)
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  round bracket_round NOT NULL,
  match_number INTEGER NOT NULL,
  team_a_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  team_b_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  team_a_placeholder TEXT,
  team_b_placeholder TEXT,
  winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  next_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  next_match_slot match_slot,
  team_a_score INTEGER,
  team_b_score INTEGER,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, match_number)
);

CREATE INDEX IF NOT EXISTS idx_matches_league ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(league_id, round);

-- Brackets (one per user per league)
CREATE TABLE IF NOT EXISTS brackets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_complete BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_brackets_league ON brackets(league_id);
CREATE INDEX IF NOT EXISTS idx_brackets_user ON brackets(user_id);

-- Bracket picks
CREATE TABLE IF NOT EXISTS bracket_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id UUID NOT NULL REFERENCES brackets(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  picked_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  round bracket_round NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bracket_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_bracket_picks_bracket ON bracket_picks(bracket_id);

-- Actual results (admin-entered)
CREATE TABLE IF NOT EXISTS actual_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  winner_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_a_score INTEGER NOT NULL DEFAULT 0,
  team_b_score INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID NOT NULL REFERENCES profiles(id),
  UNIQUE(league_id, match_id)
);

-- Punishments
CREATE TABLE IF NOT EXISTS punishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  set_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id)
);

-- Comments (trash talk wall)
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_league ON comments(league_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      split_part(COALESCE(NEW.email, 'user'), '@', 1)
    )
  );
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS leagues_updated_at ON leagues;
CREATE TRIGGER leagues_updated_at BEFORE UPDATE ON leagues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS brackets_updated_at ON brackets;
CREATE TRIGGER brackets_updated_at BEFORE UPDATE ON brackets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS bracket_picks_updated_at ON bracket_picks;
CREATE TRIGGER bracket_picks_updated_at BEFORE UPDATE ON bracket_picks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS punishments_updated_at ON punishments;
CREATE TRIGGER punishments_updated_at BEFORE UPDATE ON punishments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate invite code helper
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE actual_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Helper: check league membership
CREATE OR REPLACE FUNCTION is_league_member(p_league_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_league_admin(p_league_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM leagues WHERE id = p_league_id AND admin_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = p_league_id AND user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_bracket_locked(p_league_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_manually_locked OR (lock_deadline IS NOT NULL AND lock_deadline <= NOW())
     FROM leagues WHERE id = p_league_id),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Leagues policies
DROP POLICY IF EXISTS "Members can view their leagues" ON leagues;
DROP POLICY IF EXISTS "Creators and members can view leagues" ON leagues;
CREATE POLICY "Creators and members can view leagues" ON leagues
  FOR SELECT TO authenticated
  USING (admin_id = auth.uid() OR is_league_member(id));

DROP POLICY IF EXISTS "Authenticated users can create leagues" ON leagues;
CREATE POLICY "Authenticated users can create leagues" ON leagues
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND admin_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update leagues" ON leagues;
DROP POLICY IF EXISTS "Creators and admins can update leagues" ON leagues;
CREATE POLICY "Creators and admins can update leagues" ON leagues
  FOR UPDATE TO authenticated
  USING (admin_id = auth.uid() OR is_league_admin(id))
  WITH CHECK (admin_id = auth.uid() OR is_league_admin(id));

DROP POLICY IF EXISTS "Creators can delete leagues" ON leagues;
CREATE POLICY "Creators can delete leagues" ON leagues
  FOR DELETE TO authenticated
  USING (admin_id = auth.uid());

-- League members policies
DROP POLICY IF EXISTS "Members can view league members" ON league_members;
CREATE POLICY "Members can view league members" ON league_members
  FOR SELECT TO authenticated
  USING (is_league_member(league_id) OR EXISTS (
    SELECT 1 FROM leagues WHERE id = league_id AND admin_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can join leagues" ON league_members;
CREATE POLICY "Users can join leagues" ON league_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage members" ON league_members;
CREATE POLICY "Admins can manage members" ON league_members FOR DELETE USING (is_league_admin(league_id));

-- Teams policies
DROP POLICY IF EXISTS "Members can view teams" ON teams;
CREATE POLICY "Members can view teams" ON teams FOR SELECT USING (is_league_member(league_id));

DROP POLICY IF EXISTS "Admins can manage teams" ON teams;
CREATE POLICY "Admins can manage teams" ON teams FOR ALL USING (is_league_admin(league_id));

-- Matches policies
DROP POLICY IF EXISTS "Members can view matches" ON matches;
CREATE POLICY "Members can view matches" ON matches FOR SELECT USING (is_league_member(league_id));

DROP POLICY IF EXISTS "Admins can manage matches" ON matches;
CREATE POLICY "Admins can manage matches" ON matches FOR ALL USING (is_league_admin(league_id));

-- Brackets policies
DROP POLICY IF EXISTS "Members can view own bracket always" ON brackets;
CREATE POLICY "Members can view own bracket always" ON brackets FOR SELECT
  USING (auth.uid() = user_id AND is_league_member(league_id));

DROP POLICY IF EXISTS "Members can view others brackets when locked" ON brackets;
CREATE POLICY "Members can view others brackets when locked" ON brackets FOR SELECT
  USING (auth.uid() != user_id AND is_league_member(league_id) AND is_bracket_locked(league_id));

DROP POLICY IF EXISTS "Members can create own bracket" ON brackets;
CREATE POLICY "Members can create own bracket" ON brackets FOR INSERT
  WITH CHECK (auth.uid() = user_id AND is_league_member(league_id));

DROP POLICY IF EXISTS "Members can update own unlocked bracket" ON brackets;
CREATE POLICY "Members can update own unlocked bracket" ON brackets FOR UPDATE
  USING (auth.uid() = user_id AND NOT is_bracket_locked(league_id));

-- Bracket picks policies
DROP POLICY IF EXISTS "View picks for visible brackets" ON bracket_picks;
CREATE POLICY "View picks for visible brackets" ON bracket_picks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM brackets b
    WHERE b.id = bracket_id
    AND is_league_member(b.league_id)
    AND (b.user_id = auth.uid() OR is_bracket_locked(b.league_id))
  ));

DROP POLICY IF EXISTS "Manage own picks when unlocked" ON bracket_picks;
CREATE POLICY "Manage own picks when unlocked" ON bracket_picks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM brackets b
    WHERE b.id = bracket_id
    AND b.user_id = auth.uid()
    AND NOT is_bracket_locked(b.league_id)
  ));

-- Actual results policies
DROP POLICY IF EXISTS "Members can view results" ON actual_results;
CREATE POLICY "Members can view results" ON actual_results FOR SELECT USING (is_league_member(league_id));

DROP POLICY IF EXISTS "Admins can manage results" ON actual_results;
CREATE POLICY "Admins can manage results" ON actual_results FOR ALL USING (is_league_admin(league_id));

-- Punishments policies
DROP POLICY IF EXISTS "Members can view punishment" ON punishments;
CREATE POLICY "Members can view punishment" ON punishments FOR SELECT USING (is_league_member(league_id));

DROP POLICY IF EXISTS "Admins can manage punishment" ON punishments;
CREATE POLICY "Admins can manage punishment" ON punishments FOR ALL USING (is_league_admin(league_id));

-- Comments policies
DROP POLICY IF EXISTS "Members can view comments" ON comments;
CREATE POLICY "Members can view comments" ON comments FOR SELECT USING (is_league_member(league_id));

DROP POLICY IF EXISTS "Members can post comments" ON comments;
CREATE POLICY "Members can post comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id AND is_league_member(league_id));

DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);
