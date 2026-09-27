# PadosiPro

> You don't manage tasks — we do.

Take-home monorepo: an Express + PostgreSQL API and an Expo (React Native) app.

## Layout

```
backend/            Node.js + TypeScript + Express API
mobile/             Expo (React Native) + TypeScript app, styled with Tailwind (NativeWind)
docker-compose.yml  Postgres 16 + the API, for a one-command local run
DESIGN.md           Architecture and decisions
CLAUDE.md           Project rules
```

## Run it (one command, no Supabase account)

```bash
docker compose up
```

- API: <http://localhost:4000>
- Health check: `curl http://localhost:4000/health` → `{"ok":true}`
- Postgres: `localhost:5432` (user `padosi`, password `padosi`, db `padosipro`)

Stop with `Ctrl+C`; `docker compose down -v` also removes the database volume.

## Run it without Docker

```bash
npm run setup                      # installs backend + mobile deps

cp backend/.env.example backend/.env
npm run dev                        # API on http://localhost:4000
```

`DATABASE_URL` in `backend/.env` can point at the Docker Postgres above or at a
Supabase project (Project Settings → Database → Connection string → URI). We talk
to Supabase as plain Postgres over that connection string — no `supabase-js`.

## Mobile app

```bash
npm run dev:mobile                 # or: cd mobile && npx expo start
```

Then scan the QR code with Expo Go, or press `a` / `i` for Android or iOS.
The app currently renders a single screen reading **PadosiPro**.

Styling is Tailwind, via [NativeWind](https://nativewind.dev) — real React Native views with
`className`, no WebView. Brand tokens live in [`mobile/global.css`](mobile/global.css), so
`text-primary` is the PadosiPro green:

```tsx
<Text className="text-3xl font-bold text-primary">PadosiPro</Text>
```

## Scripts

Run from the repo root; each delegates to `backend/` and `mobile/`.

| Script | What it does |
| --- | --- |
| `npm run setup` | Install dependencies in both packages |
| `npm run dev` | Start the API in watch mode |
| `npm run dev:mobile` | Start the Expo dev server |
| `npm run build` | Compile the API, typecheck the app |
| `npm test` | Run tests |
| `npm run lint` | Lint both packages |

## Environment

Every variable the server reads is listed with a comment in
[`backend/.env.example`](backend/.env.example). Real values never get committed.
