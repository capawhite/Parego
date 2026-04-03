# CLAUDE.md — Parego

This file gives Claude Code context about the Parego project. Read it at the start of every session.

---

## What this project is

**Parego** is an arena-format chess tournament management web app. Organizers create and run tournaments; players join via QR code or a short code — no signup required to browse or join as a guest.

Live at: https://parego.onrender.com

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, RSC enabled) |
| Language | TypeScript (strict) |
| UI Components | shadcn/ui — "new-york" style |
| Icons | Lucide React |
| Styling | Tailwind CSS with CSS variables |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| DB Migrations | PLpgSQL in `/supabase` |
| Testing | Vitest |
| Deployment | Render (`render.yaml` in root) |

---

## Project structure

```
├── app/                  # Next.js App Router — pages, layouts, API routes
├── components/
│   └── ui/               # shadcn/ui primitives (Button, Dialog, Toggle, etc.)
├── hooks/tournament/     # Custom React hooks for tournament state/logic
├── lib/                  # Arena pairing algorithm, Supabase client, utilities
│   └── utils.ts          # cn() helper and shared utils
├── localization/         # i18n strings (EN + ES currently)
├── OldPairingAlgo/       # Archived previous pairing implementation — do not modify
├── public/               # Static assets
├── scripts/              # One-off data migration scripts
├── styles/               # Global CSS
├── supabase/             # DB schema and migration files
└── __tests__/            # Vitest test suite
```

### Path aliases
```
@/components  →  components/
@/lib         →  lib/
@/hooks       →  hooks/
@/components/ui  →  components/ui/
```

---

## Design system

### Brand colors
- **Primary:** Purple — used for CTAs, active tabs, badges, toggles
  - Main: `#7C3AED` (approx, check `app/globals.css` for exact CSS variables)
  - All colors are defined as CSS variables and consumed via Tailwind
- **Background:** Near-white (`#F5F3FF` / very light lavender)
- **Text:** Dark navy/black for headings, grey for secondary text
- **Danger/End actions:** Red (used on "End tournament" button)
- **Avoid:** Do not introduce new one-off color values — use the existing CSS variables

### Component conventions
- All UI primitives come from `components/ui/` (shadcn/ui) — prefer extending these over creating new ones
- Use `cn()` from `@/lib/utils` for conditional class merging
- Icons are from `lucide-react`
- Tailwind utility classes only — no inline styles, no custom CSS unless adding to `globals.css`

### Shadcn/ui config
- Style: `new-york`
- Base color: `neutral`
- CSS variables: enabled
- Add new shadcn components with: `npx shadcn@latest add <component>`

---

## Key UI screens

| Screen | Location | Notes |
|---|---|---|
| Home / tournament discovery | `app/page.tsx` (approx) | Geolocation-based list, join by code |
| Create tournament | `app/create/` (approx) | Name, visibility, time control, pairing algo |
| Tournament view — Players tab | `app/tournament/[id]/` | Player list, guest add, QR join link |
| Tournament view — Pairings tab | — | Current pairings by table, full-screen mode |
| Tournament view — Results tab | — | Enter results: White Wins / Draw / Black Wins |
| Tournament view — Standings tab | — | Points + Performance toggle |
| Tournament Settings modal | — | Scoring, player management, pairing rules |

---

## Known UI issues to fix (prioritized)

### 🔴 Critical
1. **Results buttons** — "White Wins / Draw / Black Wins" need to be larger, color-coded, and feel like real action buttons, not passive tags
2. **Pairings table headers** — burnt orange color clashes with purple brand; unify to purple or dark neutral
3. **Tournament header overflow** — title truncates and nav tabs disappear at laptop widths; fix overflow and tab responsiveness

### 🟡 Important
4. **Home page emptiness** — single tournament card in a sea of white; tighten layout, add subtle background or "how it works" section
5. **Settings modal density** — collapse advanced fields (Min Games Before Pause, Avoid Recent Rematches) behind an "Advanced" toggle
6. **Join button shown to organizer** — replace "Join tournament" with "Share" for the tournament creator

### 🟢 Polish
7. **Empty standings stats** — hide "0 games • 0.0 pts/game • Perf: 0.00" until there is real data
8. **Language switcher** — move EN/ES from bottom-right corner to the top navbar
9. **Create tournament CTA** — button looks muted/disabled even when form is valid; ensure full purple opacity when name field is filled

---

## Pairing algorithm

- Custom arena-format implementation, built from scratch
- Lives in `lib/`
- `OldPairingAlgo/` is the archived original — kept for reference only, do not touch
- Arena format: continuous pairing (not round-by-round), score-based matching, streak bonuses

---

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Supabase anon/public key
```

Copy `env.example` to `.env.local` for local development.

---

## Dev commands

```bash
npm run dev      # Start dev server at localhost:3000
npm test         # Run Vitest test suite
npm run build    # Production build
npx supabase db push  # Apply DB migrations
```

---

## Things to avoid

- Do not modify `OldPairingAlgo/` — it's an archive
- Do not introduce new color values outside the CSS variable system
- Do not add new UI libraries — extend shadcn/ui components instead
- Do not remove the `localization/` strings — the app supports EN and ES
- Do not commit `.env.local` or any real Supabase keys
