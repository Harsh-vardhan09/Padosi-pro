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

The API container runs `prisma migrate deploy` and the seed before it starts listening, so the
database is ready as soon as it reports healthy. Stop with `Ctrl+C`; `docker compose down -v` also
removes the database volume, and the next `up` rebuilds everything from scratch.

## Verify the schema and seed

Against the local Docker Postgres:

```bash
# 7 tables: users, email_otps, profiles, task_categories, tasks, user_tasks, _prisma_migrations
docker compose exec db psql -U padosi -d padosipro -c '\dt'

# which migrations have been applied
docker compose exec db psql -U padosi -d padosipro -c 'table _prisma_migrations'

# 6 categories, 28 tasks
docker compose exec db psql -U padosi -d padosipro -c "
  select c.sort_order, c.name as category, count(t.id) as tasks
  from task_categories c left join tasks t on t.category_id = c.id
  group by c.id, c.sort_order, c.name order by c.sort_order;"
```

Against whatever `backend/.env` points at (Supabase included), with no psql needed:

```bash
cd backend
npx prisma migrate status     # every migration applied?
npm run prisma:studio         # browse the tables in a browser
```

Expected: **6 categories / 28 tasks**. The seed is idempotent — it upserts, so re-running
`npm run db:seed` leaves the counts unchanged and refreshes any edited description.

## Database workflow

```bash
cd backend
npm run prisma:generate   # regenerate the typed client after editing the schema
npm run prisma:migrate    # create + apply a migration in development
npm run prisma:deploy     # apply existing migrations (CI, containers, Supabase)
npm run db:seed           # idempotent catalogue seed
npm run prisma:studio     # browse the data
npm run db:reset          # drop, re-migrate and re-seed (destructive)
```

The schema lives in [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma). Prisma cannot
express CHECK constraints, so the lowercase-email and `+91` mobile checks are appended by hand to
`prisma/migrations/*/migration.sql`.

### Pointing at Supabase

Supabase's direct host (`db.<ref>.supabase.co`) resolves to **IPv6 only**. On an IPv4-only network
it fails with `ENOTFOUND`, so use the **session pooler** connection string instead — port 5432, user
`postgres.<project-ref>`, host `aws-0-<region>.pooler.supabase.com`. Copy it from the Supabase
dashboard: *Connect → Session pooler*. Set `DB_SSL=true` alongside it. Avoid the transaction pooler
(6543) for migrations; it disables the prepared statements Prisma Migrate needs.

```bash
cd backend
npm run prisma:deploy
npm run db:seed
```

## Run it without Docker

```bash
npm run setup                      # installs backend + mobile deps

cp backend/.env.example backend/.env
docker compose up -d db            # or point DATABASE_URL at your own Postgres
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
[`backend/.env.example`](backend/.env.example). Real values never get committed. The server
validates all of them at boot and refuses to start with a message naming each bad variable.

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Plain Postgres connection string — local Docker or Supabase. |
| `DB_SSL` | `false` for local Docker, `true` for Supabase. |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Token signing key (min 16 chars) and lifetime, default `7d`. |
| `OTP_PEPPER` | Server-side secret mixed into the OTP hash (min 16 chars). |
| `MAIL_DRIVER` | `console` (default) logs the OTP; `emailjs` sends real mail and then requires the four `EMAILJS_*` values. |

With the default `MAIL_DRIVER=console`, OTPs are printed to `docker compose logs api` — no email
account needed to run the flow.
