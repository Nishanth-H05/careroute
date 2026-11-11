# CareRoute

> Real-time hospital bed & emergency resource availability for **Tumakuru**, Karnataka.

## What is this?

CareRoute is a free, public, information-only platform that shows live hospital bed availability across Tumakuru. No ads, no calls, no paid APIs.

| Route | Who | Purpose |
|---|---|---|
| `/` | Anyone | Search hospitals and bed availability |
| `/staff` | Hospital staff | Secure portal to update bed counts |

## Rules

See [SPEC.md](./SPEC.md) — read it before making any change.

## Tech stack

- **React 19 + TypeScript** via Vite 8
- **Tailwind CSS v4** (utility-first CSS)
- **React Router v7** (client-side routing)
- **Supabase** (Postgres + Auth + Realtime — free tier)
- **Leaflet + react-leaflet + OpenStreetMap** (free maps, no billing card)
- **vite-plugin-pwa** (installable PWA, network-first for bed data)

## Getting started

```bash
# 1. Clone the repo
git clone <repo-url>
cd careroute

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add your Supabase URL and anon key

# 4. Start the dev server
npm run dev
```

## Environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous (public) key |

> ⚠️ Never commit `.env`. It is in `.gitignore`. Commit `.env.example` only.

## Contributing

Follow the rules in SPEC.md. Make small, focused commits. Explain every new file in one line.
