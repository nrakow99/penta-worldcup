-- Rename r32_ready → bracket_open (clearer name for the simplified app).
-- Safe to run multiple times.

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leagues'
      AND column_name = 'r32_ready'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leagues'
      AND column_name = 'bracket_open'
  ) THEN
    UPDATE public.leagues SET bracket_open = r32_ready WHERE r32_ready = TRUE;
    ALTER TABLE public.leagues DROP COLUMN r32_ready;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leagues'
      AND column_name = 'r32_ready'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leagues'
      AND column_name = 'bracket_open'
  ) THEN
    ALTER TABLE public.leagues RENAME COLUMN r32_ready TO bracket_open;
  END IF;
END $$;

ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS bracket_open BOOLEAN NOT NULL DEFAULT FALSE;
