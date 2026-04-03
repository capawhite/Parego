# Parego — Pair, play and Go

**Arena chess tournament management. No signup required to browse.**

🌐 **Live at [parego.onrender.com](https://parego.onrender.com)**

Parego is a web app for running arena-style chess tournaments. Organizers can create and manage tournaments; players can find, join, and follow games — all with minimal friction. Spectators and casual players can browse and join with just a code or QR scan, no account needed.

---

## Features

- **Tournament discovery** — geolocation-based listing of nearby tournaments, no account needed to browse
- **Instant join** — enter a tournament code or scan a QR code to participate
- **Arena pairing** — custom-built arena pairing algorithm (independent implementation, not based on Lichess or any existing engine)
- **Live standings** — real-time scoreboard and match results
- **Organizer dashboard** — create tournaments, manage rounds, enter results
- **Localization** — multi-language support
- **Auth via Supabase** — optional account for organizers; spectators and casual players need no signup

---

## Pairing system

Parego uses a custom **arena-format** pairing algorithm, built from scratch. In arena format:

- All players participate simultaneously for the duration of the event (not round-by-round elimination)
- Players are paired continuously as games finish — you don't wait for a round to end
- Scoring rewards wins and streaks; faster wins can earn bonus points
- Players are matched against others with similar scores to keep games competitive

The pairing logic lives in `lib/` (the `OldPairingAlgo/` directory contains the archived original implementation, kept for reference).

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| DB Migrations | PLpgSQL (managed in `/supabase`) |
| Styling | Tailwind CSS |
| Testing | Vitest |
| Deployment | Render |

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone

```bash
git clone https://github.com/capawhite/Parego.git
cd Parego
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp env.example .env.local
```

Edit `.env.local` and fill in your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

You can find these in your Supabase project under **Settings → API**.

### 4. Apply database migrations

```bash
npx supabase db push
```

Or apply the SQL files in `/supabase` manually via the Supabase dashboard SQL editor.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Running tests

```bash
npm test
```

Tests live in `__tests__/` and use [Vitest](https://vitest.dev).

---

## Project structure

```
├── app/                  # Next.js App Router pages and layouts
├── components/           # Reusable UI components
├── hooks/tournament/     # Custom React hooks for tournament logic
├── lib/                  # Arena pairing algorithm, utilities, Supabase client
├── localization/         # i18n strings
├── OldPairingAlgo/       # Archived previous pairing implementation (reference only)
├── public/               # Static assets
├── scripts/              # One-off scripts (data migrations, etc.)
├── styles/               # Global CSS
├── supabase/             # Database migrations and schema
└── __tests__/            # Test suite
```

---

## Deploying to Render

The `render.yaml` in the root defines the service configuration — Render will pick it up automatically when you connect the repository.

### Environment variables

Set the following in your Render service under **Environment**:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key |

---

## Contributing

Issues and pull requests are welcome. If you have a bug report or feature idea, open an issue first so we can discuss it before you invest time in a PR.

---

## License

MIT — see [LICENSE](./LICENSE) for details.
