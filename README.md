# Bracket Punishment League

A private World Cup 2026 bracket challenge app for you and your roommates. Fill out brackets starting at the Round of 32 — worst bracket at the end gets the punishment.

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS 4**
- **Supabase** (Auth + PostgreSQL)
- **Vercel** deployment ready

## Features

- User auth (sign up / sign in)
- Create or join private leagues with invite codes
- League dashboard with countdown, leaderboard, and status
- Bracket builder (Round of 32 → Champion)
- Admin controls for teams, matchups, results, and punishment
- Scoring with escalating point values per round
- Punishment logic with tiebreakers
- Trash talk comment wall
- Confetti on league completion

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor
3. Copy your project URL and anon key

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push to GitHub
2. Import the repo in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

## Scoring

| Round | Points |
|-------|--------|
| Round of 32 | 1 |
| Round of 16 | 2 |
| Quarterfinals | 4 |
| Semifinals | 8 |
| Final | 16 |
| Champion bonus | 10 |

## Punishment Tiebreakers

When brackets tie for last place:

1. Fewer correct finalists
2. Fewer correct semifinalists
3. Wrong champion pick
4. Furthest from total tournament goals
5. Random coin flip

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login & signup
│   ├── dashboard/          # User's leagues
│   └── league/             # League pages
├── components/
│   ├── admin/              # Admin panel
│   ├── bracket/            # Bracket tree & builder
│   ├── layout/             # Navbar
│   ├── league/             # Dashboard widgets
│   └── ui/                 # Shared UI components
└── lib/
    ├── actions/            # Server actions
    ├── bracket/            # Bracket logic
    ├── queries/            # Data fetching
    ├── scoring/            # Score & punishment calc
    ├── supabase/           # Supabase clients
    └── types/              # TypeScript types
supabase/
└── migrations/             # Database schema
```

## License

Private use — built for the roommates. 🏆💀
